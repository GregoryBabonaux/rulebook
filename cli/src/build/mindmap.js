// Interactive map: horizontal tree project → domains → policies → rules → edge cases.
// Pan by dragging, zoom with the wheel or the buttons, click a node to open it, click a rule to
// read its card. The shared search and filters highlight matching rules and open their path.
(() => {
  const svg = document.getElementById('mindmap');
  if (!svg) return;
  const NS = svg.namespaceURI;
  const data = JSON.parse(document.getElementById('rulebook-data').textContent);
  const L = JSON.parse(document.getElementById('rulebook-labels').textContent);
  const viewport = document.getElementById('mm-viewport');
  const panel = document.getElementById('mm-panel');
  const frame = svg.closest('.map-frame');
  const COL = 250;
  const ROW = 32;
  const view = { x: 40, y: 40, k: 1 };

  const short = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
  const ruleNode = (id) => {
    const r = data.rules[id];
    return {
      id, kind: 'rule', label: `${id} · ${short(r.title, 34)}`, rule: r, open: false,
      children: r.edgeCases.map((e) => ({ id: e.id, kind: 'edge', label: short(e.text, 46), edge: e, children: [] })),
    };
  };
  const root = {
    id: '__root', kind: 'root', label: data.name, open: true,
    children: data.domains.map((d) => ({
      id: d.code, kind: 'domain', label: `${d.code} · ${d.title}`, extracted: d.extracted, domain: d, open: true,
      children: [
        ...d.policies.map((p) => ({ id: p.id, kind: 'policy', label: short(p.title, 34), policy: p, open: false, children: p.rules.map(ruleNode) })),
        ...(d.otherRules.length ? [{ id: `${d.code}-other`, kind: 'policy', label: L.otherRules, open: false, children: d.otherRules.map(ruleNode) }] : []),
      ],
    })),
  };

  // --- filters shared with the document view
  const field = (id) => document.getElementById(id);
  function matches(node) {
    if (node.kind !== 'rule') return false;
    const r = node.rule;
    const q = (field('q')?.value || '').trim().toLowerCase();
    const text = `${node.id} ${r.title} ${r.rule} ${r.context}`.toLowerCase();
    return (!q || q.split(/\s+/).every((t) => text.includes(t)))
      && (!field('f-confidence')?.value || r.confidence === field('f-confidence').value)
      && (!field('f-category')?.value || r.category === field('f-category').value)
      && (!field('f-status')?.value || r.status === field('f-status').value);
  }
  const filtering = () => ['q', 'f-confidence', 'f-category', 'f-status'].some((id) => (field(id)?.value || '').trim());
  function markMatches(node) {
    let any = matches(node);
    for (const child of node.children || []) any = markMatches(child) || any;
    node.hit = any;
    if (filtering() && any && node.kind !== 'rule') node.open = true;
    return any;
  }

  // --- drawing
  const el = (name, attrs, parent) => {
    const e = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (parent) parent.appendChild(e);
    return e;
  };
  function nodeClass(n) {
    const parts = ['mm-node', `mm-${n.kind}`];
    if (n.kind === 'domain' && !n.extracted) parts.push('mm-empty');
    if (n.rule?.tag) parts.push(`mm-tag-${n.rule.tag}`);
    if (filtering()) parts.push(n.hit ? 'mm-hit' : 'mm-dim');
    return parts.join(' ');
  }
  function draw() {
    markMatches(root);
    const { nodes } = tidyLayout(root, { colWidth: COL, rowHeight: ROW });
    viewport.textContent = '';
    const links = el('g', { class: 'mm-links' }, viewport);
    for (const p of nodes) {
      if (!p.parent) continue;
      const x1 = p.parent.x + 12; const y1 = p.parent.y; const x2 = p.x; const y2 = p.y; const mx = (x1 + x2) / 2;
      el('path', { d: `M${x1} ${y1} C${mx} ${y1},${mx} ${y2},${x2} ${y2}`, class: filtering() && !p.node.hit ? 'mm-dim' : '' }, links);
    }
    for (const p of nodes) {
      const n = p.node;
      const g = el('g', { class: nodeClass(n), transform: `translate(${p.x},${p.y})`, tabindex: '0', role: 'button' }, viewport);
      const conf = n.rule?.confidence || n.edge?.confidence;
      el('circle', { r: n.kind === 'edge' ? 3.5 : 5.5, class: conf ? `conf-${conf}` : 'mm-dot' }, g);
      const t = el('text', { x: 12, y: 4 }, g);
      const more = n.children?.length && !n.open ? ` ▸ ${n.children.length}` : '';
      t.textContent = n.kind === 'domain' && !n.extracted ? `${n.label} · ${L.notExtracted}` : `${n.label}${more}`;
      g.addEventListener('click', (ev) => { ev.stopPropagation(); activate(n); });
      g.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); activate(n); } });
    }
    apply();
  }
  function activate(n) {
    if (n.kind === 'rule') showRule(n);
    if (n.kind === 'domain') showDomain(n);
    if (n.children?.length) { n.open = !n.open; draw(); }
  }

  // --- side panel with the rule card
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const code = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');
  function openPanel(html) {
    panel.innerHTML = `<button type="button" class="mm-close" aria-label="${esc(L.close)}">×</button>${html}`;
    panel.hidden = false;
    frame.classList.add('with-panel');
    requestAnimationFrame(fit);
    panel.querySelector('.mm-close').addEventListener('click', () => { panel.hidden = true; frame.classList.remove('with-panel'); requestAnimationFrame(fit); });
  }
  function showDomain(n) {
    const d = n.domain;
    openPanel(`<p class="muted">${esc(d.code)}${d.extracted ? '' : ` · ${esc(L.notExtracted)}`}</p>
      <h3>${code(d.title)}</h3>
      ${d.description ? `<p class="context">${code(d.description)}</p>` : ''}
      ${d.details.length ? `<dl class="details">${d.details.map((x) => `<dt>${code(x.label)}</dt><dd>${code(x.text)}</dd>`).join('')}</dl>` : ''}
      <p><a href="#${esc(d.code)}">${esc(L.openInDocument)} →</a></p>`);
  }
  function showRule(n) {
    const r = n.rule;
    openPanel(`
      <p class="muted">${esc(n.id)}${r.category ? ` · ${esc(r.category)}` : ''}${r.tag ? ` · <span class="tag tag-${esc(r.tag)}">${esc(L.tag[r.tag])}</span>` : ''}</p>
      <h3>${code(r.title)}</h3>
      ${r.rule ? `<p class="statement">${code(r.rule)}</p>` : ''}
      ${r.context ? `<p class="context">${code(r.context)}</p>` : ''}
      <p class="evidence"><span class="dot conf-${esc(r.confidence)}"></span>${esc(L.conf[r.confidence] || r.confidence)}${r.evidence.length ? ` · ${r.evidence.map((e) => `<a href="${esc(e.href)}">${esc(e.label)}</a>`).join(' · ')}` : ''}</p>
      ${r.edgeCases.length ? `<p class="label">${esc(L.edgeCases)}</p><ul>${r.edgeCases.map((e) => `<li>${code(e.text)}</li>`).join('')}</ul>` : ''}
      ${r.openQuestions ? `<aside class="question"><strong>${esc(L.toValidate)}</strong> ${code(r.openQuestions)}</aside>` : ''}
      ${r.history.length ? `<p class="label">${esc(L.history)}</p><ul>${r.history.map((h) => `<li>${esc(h.date)} · ${esc(L.change[h.change] || h.change)}${h.note ? ` · ${code(h.note)}` : ''}</li>`).join('')}</ul>` : ''}
      <p><a href="#${esc(n.id)}" data-open-document>${esc(L.openInDocument)} →</a></p>`);
  }

  // --- pan and zoom
  const apply = () => viewport.setAttribute('transform', `translate(${view.x},${view.y}) scale(${view.k})`);
  function zoom(factor, cx, cy) {
    const k = Math.min(3, Math.max(0.2, view.k * factor));
    view.x = cx - ((cx - view.x) * k) / view.k;
    view.y = cy - ((cy - view.y) * k) / view.k;
    view.k = k;
    apply();
  }
  function fit() {
    const box = viewport.getBBox();
    const w = svg.clientWidth || 800; const h = svg.clientHeight || 500;
    const k = Math.min(1, Math.max(0.6, Math.min((w - 40) / (box.width || 1), (h - 40) / (box.height || 1))));
    view.k = k; view.x = (w - box.width * k) / 2 - box.x * k; view.y = (h - box.height * k) / 2 - box.y * k;
    apply();
  }
  svg.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const rect = svg.getBoundingClientRect();
    zoom(ev.deltaY < 0 ? 1.12 : 1 / 1.12, ev.clientX - rect.left, ev.clientY - rect.top);
  }, { passive: false });
  let drag = null;
  svg.addEventListener('pointerdown', (ev) => {
    if (ev.target.closest('.mm-node')) return;
    drag = { x: ev.clientX, y: ev.clientY, vx: view.x, vy: view.y };
    svg.setPointerCapture(ev.pointerId);
    svg.classList.add('dragging');
  });
  svg.addEventListener('pointermove', (ev) => {
    if (!drag) return;
    view.x = drag.vx + ev.clientX - drag.x;
    view.y = drag.vy + ev.clientY - drag.y;
    apply();
  });
  const stop = () => { drag = null; svg.classList.remove('dragging'); };
  svg.addEventListener('pointerup', stop);
  svg.addEventListener('pointercancel', stop);
  document.querySelectorAll('[data-zoom]').forEach((b) => b.addEventListener('click', () => {
    const w = svg.clientWidth / 2; const h = svg.clientHeight / 2;
    if (b.dataset.zoom === 'in') zoom(1.25, w, h);
    else if (b.dataset.zoom === 'out') zoom(0.8, w, h);
    else fit();
  }));

  for (const id of ['q', 'f-confidence', 'f-category', 'f-status']) field(id)?.addEventListener('input', draw);
  let fitted = false;
  document.addEventListener('rulebook:view', (ev) => {
    if (ev.detail !== 'map') return;
    draw();
    if (!fitted) { fit(); fitted = true; }
  });
})();
