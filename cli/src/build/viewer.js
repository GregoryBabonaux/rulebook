(() => {
  const labels = JSON.parse(document.getElementById('rulebook-labels').textContent);
  const root = document.documentElement;
  try { const saved = localStorage.getItem('rulebook-theme'); if (saved) root.dataset.theme = saved; } catch { /* storage may be blocked */ }
  document.getElementById('theme').addEventListener('click', () => {
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('rulebook-theme', root.dataset.theme); } catch { /* ignore */ }
  });

  // --- views: document, map, dashboard (the document stays the default and the no-JS view)
  root.classList.add('js');
  const tabs = [...document.querySelectorAll('.views [data-view]')];
  function show(name) {
    for (const t of tabs) t.setAttribute('aria-selected', String(t.dataset.view === name));
    root.dataset.view = name;
    for (const v of document.querySelectorAll('section.view')) v.hidden = v.id !== `view-${name}`;
    document.dispatchEvent(new CustomEvent('rulebook:view', { detail: name }));
    try { sessionStorage.setItem('rulebook-view', name); } catch { /* ignore */ }
  }
  for (const t of tabs) t.addEventListener('click', () => show(t.dataset.view));
  // a link to a card (#PAY-R012) always lands in the document view
  document.addEventListener('click', (ev) => {
    const a = ev.target.closest('a[href^="#"]');
    if (!a) return;
    const target = document.getElementById(a.getAttribute('href').slice(1));
    if (target && target.closest('#view-document')) { show('document'); requestAnimationFrame(() => target.scrollIntoView()); }
  });
  let initial = 'document';
  try { initial = sessionStorage.getItem('rulebook-view') || 'document'; } catch { /* ignore */ }
  if (location.hash && document.getElementById(location.hash.slice(1))?.closest('#view-document')) initial = 'document';
  show(tabs.some((t) => t.dataset.view === initial) ? initial : 'document');

  const q = document.getElementById('q');
  const kind = document.getElementById('f-kind');
  const confidence = document.getElementById('f-confidence');
  const category = document.getElementById('f-category');
  const status = document.getElementById('f-status');
  const shown = document.getElementById('shown');
  const noMatch = document.getElementById('no-match');
  const rules = [...document.querySelectorAll('article.rule')];
  const policies = [...document.querySelectorAll('section.policy')];
  const domains = [...document.querySelectorAll('section.domain:not(.is-empty)')];

  function apply() {
    const terms = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const matches = (el) => terms.every((term) => (el.dataset.search || '').includes(term));
    let count = 0;
    for (const r of rules) {
      const policy = r.closest('section.policy');
      const ok = kind.value !== 'policy'
        && (!confidence.value || r.dataset.confidence === confidence.value)
        && (!category.value || r.dataset.category === category.value)
        && (!status.value || r.dataset.status === status.value)
        && (matches(r) || (policy && matches(policy)));
      r.hidden = !ok;
      if (ok) count++;
    }
    for (const p of policies) {
      const anyRule = [...p.querySelectorAll('article.rule')].some((r) => !r.hidden);
      const selfMatch = kind.value !== 'rule' && !confidence.value && !category.value && !status.value && p.dataset.search && matches(p);
      p.hidden = !(anyRule || selfMatch);
    }
    const filtering = terms.length || kind.value || confidence.value || category.value || status.value;
    for (const d of domains) d.hidden = Boolean(filtering) && ![...d.querySelectorAll('section.policy')].some((p) => !p.hidden);
    shown.textContent = filtering ? labels.shown.replace('{n}', count) : '';
    noMatch.hidden = !filtering || count > 0 || policies.some((p) => !p.hidden);
  }
  for (const el of [q, kind, confidence, category, status]) el.addEventListener('input', apply);
})();
