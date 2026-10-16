import { readFileSync } from 'node:fs';
import { t } from './i18n.js';

const asset = (name) => readFileSync(new URL(`./${name}`, import.meta.url), 'utf8');

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function inline(s) {
  return escapeHtml(s).replace(/`([^`]+)`/g, '<code>$1</code>');
}

export const isHttpUrl = (url) => typeof url === 'string' && /^https?:\/\//i.test(url);

// Links go to the hosting platform at the exact lines, or, without a usable
// repoUrl, relative to the document (`base` = path from the document to the repo root).
export function evidenceHref(repoUrl, commit, ev, base = '..') {
  if (!isHttpUrl(repoUrl)) return `${base}/${ev.path}`;
  const root = repoUrl.replace(/\/+$/, '').replace(/\.git$/, '');
  const blob = /gitlab/i.test(root) ? '/-/blob/' : '/blob/';
  const lines = ev.end > ev.start ? `#L${ev.start}-L${ev.end}` : `#L${ev.start}`;
  return `${root}${blob}${commit}/${ev.path}${lines}`;
}

function tagFor(card, since, L) {
  if (card.meta.status === 'retired') return { type: 'retired', date: null };
  const latest = since.items.find((i) => i.id === card.id);
  return latest ? { type: latest.type, date: latest.date } : null;
}

function renderRule(card, data, L) {
  const tag = tagFor(card, data.since, L);
  const conf = card.meta.confidence ?? 'inferred';
  const evidence = card.evidence.map((ev) => {
    const file = ev.path.split('/').pop();
    return `<a href="${escapeHtml(evidenceHref(data.project.repoUrl, data.project.commit, ev, data.evidenceBase))}">${escapeHtml(`${file}:${ev.start}`)}</a>`;
  }).join(' · ');
  const search = [card.id, card.title, card.sections.rule, card.sections.context, ...card.edgeCases.map((e) => e.text)].join(' ').toLowerCase();
  return `<article class="rule${tag?.type === 'retired' ? ' is-retired' : ''}" id="${escapeHtml(card.id)}" data-kind="rule" data-category="${escapeHtml(card.meta.category ?? '')}" data-confidence="${escapeHtml(conf)}" data-status="${escapeHtml(card.meta.status)}" data-search="${escapeHtml(search)}">
  <div class="rule-head"><a class="rid" href="#${escapeHtml(card.id)}">${escapeHtml(card.id)}</a>${tag ? `<span class="tag tag-${tag.type}">${escapeHtml(L.tag[tag.type])}${tag.date ? ` ${L.on} ${escapeHtml(tag.date)}` : ''}</span>` : ''}</div>
  <h4 class="rule-title">${inline(card.title)}</h4>
  ${card.sections.rule ? `<p class="statement">${inline(card.sections.rule)}</p>` : ''}
  ${card.sections.context ? `<p class="context">${inline(card.sections.context)}</p>` : ''}
  ${card.sections.parameters ? `<p class="meta"><span class="label">${escapeHtml(L.parameters)}</span> ${inline(card.sections.parameters)}</p>` : ''}
  ${card.edgeCases.length ? `<div class="cases"><span class="label">${escapeHtml(L.edgeCases)}</span><ul>${card.edgeCases.map((e) => `<li id="${escapeHtml(e.id)}">${inline(e.text)}</li>`).join('')}</ul></div>` : ''}
  <p class="evidence"><span class="dot conf-${escapeHtml(conf)}" aria-hidden="true"></span>${escapeHtml(L.conf[conf] ?? conf)}${evidence ? ` · ${evidence}` : ''}</p>
  ${card.history.length ? `<details class="history"><summary>${escapeHtml(L.history)}</summary><ul>${card.history.map((h) => `<li>${escapeHtml(h.date)} · ${escapeHtml(L.change[h.change] ?? h.change)}${h.note ? ` · ${inline(h.note)}` : ''}</li>`).join('')}</ul></details>` : ''}
  ${card.sections.openQuestions ? `<aside class="question"><strong>${escapeHtml(L.toValidate)}</strong> ${inline(card.sections.openQuestions)}</aside>` : ''}
</article>`;
}

const renderDetails = (details) => (details?.length
  ? `<dl class="details">${details.map((d) => `<dt>${inline(d.label)}</dt><dd>${inline(d.text)}</dd>`).join('')}</dl>`
  : '');

// One hue per domain, carried by the sidebar, the sections, the map branches and the dashboard bars.
const DOMAIN_COLORS = ['#6366f1', '#14b8a6', '#f59e0b', '#ec4899', '#0ea5e9', '#8b5cf6', '#22c55e', '#ef4444', '#06b6d4', '#d946ef', '#84cc16', '#f97316'];
export const domainColor = (i) => DOMAIN_COLORS[i % DOMAIN_COLORS.length];

function renderDomain(domain, index, data, L) {
  const n = index + 1;
  const dom = `style="--dom:${domainColor(index)}"`;
  if (!domain.extracted) {
    return `<section class="domain is-empty" id="${escapeHtml(domain.code)}" ${dom}><h2>${n}. ${inline(domain.title)}</h2><p class="lede">${inline(domain.description)}</p>${renderDetails(domain.details)}<p class="muted">${escapeHtml(L.notExtracted)}</p></section>`;
  }
  const policies = domain.policies.map((p, i) => `<section class="policy" id="${escapeHtml(p.card.id)}" data-kind="policy" data-search="${escapeHtml([p.card.id, p.card.title, p.card.sections.statement].join(' ').toLowerCase())}">
  <h3>${n}.${i + 1} ${inline(p.card.title)}</h3>
  ${p.card.sections.statement ? `<p class="policy-statement"><span class="label">${escapeHtml(L.policy)}</span> ${inline(p.card.sections.statement)}</p>` : ''}
  ${p.card.sections.context ? `<p class="context">${inline(p.card.sections.context)}</p>` : ''}
  ${p.card.sections.openQuestions ? `<aside class="question"><strong>${escapeHtml(L.toValidate)}</strong> ${inline(p.card.sections.openQuestions)}</aside>` : ''}
  ${p.rules.map((r) => renderRule(r, data, L)).join('\n')}
</section>`).join('\n');
  const others = domain.otherRules.length
    ? `<section class="policy" data-kind="policy"><h3>${n}.${domain.policies.length + 1} ${escapeHtml(L.otherRules)}</h3>${domain.otherRules.map((r) => renderRule(r, data, L)).join('\n')}</section>`
    : '';
  return `<section class="domain" id="${escapeHtml(domain.code)}" ${dom}><h2>${n}. ${inline(domain.title)}</h2>${domain.description ? `<p class="lede">${inline(domain.description)}</p>` : ''}${renderDetails(domain.details)}${policies}${others}</section>`;
}

const CONFIDENCES = ['verified', 'read', 'inferred', 'conflicting'];
const allRules = (domain) => [...domain.policies.flatMap((p) => p.rules), ...domain.otherRules];

// What the interactive map needs: the tree (ids only) and every rule's card, once.
function mapModel(data) {
  const rules = {};
  const domains = data.domains.map((d, index) => {
    for (const card of allRules(d)) {
      const tag = tagFor(card, data.since);
      rules[card.id] = {
        title: card.title, rule: card.sections.rule ?? '', context: card.sections.context ?? '',
        confidence: card.meta.confidence ?? 'inferred', category: card.meta.category ?? '', status: card.meta.status,
        tag: tag?.type ?? null,
        evidence: card.evidence.map((ev) => ({ label: `${ev.path.split('/').pop()}:${ev.start}`, href: evidenceHref(data.project.repoUrl, data.project.commit, ev, data.evidenceBase) })),
        edgeCases: card.edgeCases.map((e) => ({ id: e.id, text: e.text, confidence: e.confidence })),
        history: card.history.map((h) => ({ date: h.date, change: h.change, note: h.note })),
        openQuestions: card.sections.openQuestions ?? '',
      };
    }
    return {
      code: d.code, title: d.title, description: d.description, extracted: d.extracted, details: d.details ?? [], color: domainColor(index),
      policies: d.policies.map((p) => ({ id: p.card.id, title: p.card.title, statement: p.card.sections.statement ?? '', rules: p.rules.map((r) => r.id) })),
      otherRules: d.otherRules.map((r) => r.id),
    };
  });
  return { name: data.project.name, domains, rules };
}

function renderDashboard(data, L) {
  const rules = data.domains.flatMap(allRules);
  const verified = rules.filter((r) => r.meta.confidence === 'verified').length;
  const pct = rules.length ? Math.round((verified / rules.length) * 100) : 0;
  const kpi = (value, label) => `<div class="kpi"><b>${escapeHtml(value)}</b><span>${escapeHtml(label)}</span></div>`;
  const bars = data.domains.map((d, index) => {
    const own = allRules(d);
    if (!d.extracted) return `<div class="bar-row" data-domain="${escapeHtml(d.code)}" style="--dom:${domainColor(index)}"><a href="#${escapeHtml(d.code)}">${inline(d.title)}</a><span class="bar empty"></span><span class="muted">${escapeHtml(L.notExtracted)}</span></div>`;
    const segs = CONFIDENCES.map((c) => {
      const n = own.filter((r) => (r.meta.confidence ?? 'inferred') === c).length;
      return n ? `<span class="seg conf-${c}" style="width:${Math.round((n / own.length) * 100)}%" title="${escapeHtml(`${L.conf[c]} · ${n}`)}"></span>` : '';
    }).join('');
    return `<div class="bar-row" data-domain="${escapeHtml(d.code)}" style="--dom:${domainColor(index)}"><a href="#${escapeHtml(d.code)}">${inline(d.title)}</a><span class="bar">${segs}</span><span class="muted">${own.length}</span></div>`;
  }).join('');
  const recent = data.since.items.slice(0, 8).map((i) => `<li><span class="tag tag-${i.type}">${escapeHtml(L.tag[i.type])}</span> <a href="#${escapeHtml(i.id)}">${escapeHtml(i.id)}</a> · ${inline(i.title)}</li>`).join('');
  const pending = data.toValidate.slice(0, 8).map((v) => `<li><span class="label">${escapeHtml(L.item[v.type])}</span> ${v.id ? `<a href="#${escapeHtml(v.id)}">${escapeHtml(v.id)}</a> · ` : ''}${inline(v.text)}</li>`).join('');
  return `<section class="view" id="view-dashboard" hidden>
  <div class="kpis">${kpi(`${data.counts.extracted} / ${data.counts.domains}`, L.kpiExtracted)}${kpi(String(rules.length), L.kpiRules)}${kpi(`${pct} %`, L.kpiVerified)}${kpi(String(data.toValidate.length), L.kpiToValidate)}</div>
  <h2 class="small">${escapeHtml(L.byDomain)}</h2>
  <div class="bars">${bars}</div>
  <p class="map-legend muted">${CONFIDENCES.map((k) => `<span><span class="dot conf-${k}"></span>${escapeHtml(L.conf[k])}</span>`).join(' ')}</p>
  <div class="dash-cols">
    <div><h2 class="small">${escapeHtml(L.recentChanges)}</h2>${recent ? `<ul class="plain">${recent}</ul>` : `<p class="muted">${escapeHtml(L.noRecentChanges)}</p>`}</div>
    <div><h2 class="small">${escapeHtml(L.toValidate)}</h2>${pending ? `<ul class="plain">${pending}</ul>` : `<p class="muted">${escapeHtml(L.nothingToValidate)}</p>`}</div>
  </div>
</section>`;
}

export function renderHtml(model, { evidenceBase = '..' } = {}) {
  const data = { ...model, evidenceBase };
  const L = t(data.project.language);
  const lang = data.project.language === 'fr' ? 'fr' : 'en';
  const ruleCount = (d) => d.policies.reduce((n, p) => n + p.rules.length, 0) + d.otherRules.length;
  const pending = data.toValidate.length ? `<p class="pending"><a href="#to-validate">${escapeHtml(L.pending(data.toValidate.length))}</a></p>` : '';
  const since = data.since.from
    ? `<section class="since" id="since"><h2 class="small">${escapeHtml(L.since(data.since.from))}</h2>${data.since.items.length
      ? `<ul>${data.since.items.map((i) => `<li><span class="tag tag-${i.type}">${escapeHtml(L.tag[i.type])}</span> <a href="#${escapeHtml(i.id)}">${escapeHtml(i.id)}</a> · ${inline(i.title)}${i.note ? ` — ${inline(i.note)}` : ''}</li>`).join('')}</ul>` : ''}${pending}</section>`
    : `<section class="since" id="since"><p class="muted">${escapeHtml(L.firstVersion)}</p>${pending}</section>`;
  const toc = `<nav class="toc" id="toc"><h2 class="small">${escapeHtml(L.toc)}</h2><ol>${data.domains.map((d) => `<li class="${d.extracted ? '' : 'muted'}"><a href="#${escapeHtml(d.code)}">${inline(d.title)}</a> <span class="muted">· ${escapeHtml(d.extracted ? L.rulesCount(ruleCount(d)) : L.notExtracted)}</span></li>`).join('')}</ol></nav>`;
  const toValidate = `<section class="to-validate" id="to-validate"><h2>${escapeHtml(L.toValidate)}</h2>${data.toValidate.length
    ? `<ul>${data.toValidate.map((v) => `<li><span class="label">${escapeHtml(L.item[v.type])}</span> ${v.id ? `<a href="#${escapeHtml(v.id)}">${escapeHtml(v.id)}</a> · ` : ''}${inline(v.text)}</li>`).join('')}</ul>`
    : `<p class="muted">${escapeHtml(L.nothingToValidate)}</p>`}</section>`;
  const controls = `<div class="controls" role="search">
  <input type="search" id="q" placeholder="${escapeHtml(L.search)}" aria-label="${escapeHtml(L.search)}">
  <select id="f-kind" aria-label="${escapeHtml(L.anyKind)}"><option value="">${escapeHtml(L.anyKind)}</option><option value="policy">${escapeHtml(L.kindPolicy)}</option><option value="rule">${escapeHtml(L.kindRule)}</option></select>
  <select id="f-confidence" aria-label="${escapeHtml(L.anyConfidence)}"><option value="">${escapeHtml(L.anyConfidence)}</option>${Object.entries(L.conf).map(([k, v]) => `<option value="${k}">${escapeHtml(v)}</option>`).join('')}</select>
  <select id="f-category" aria-label="${escapeHtml(L.anyCategory)}"><option value="">${escapeHtml(L.anyCategory)}</option>${Object.entries(L.category).map(([k, v]) => `<option value="${k}">${escapeHtml(v)}</option>`).join('')}</select>
  <select id="f-status" aria-label="${escapeHtml(L.anyStatus)}"><option value="">${escapeHtml(L.anyStatus)}</option>${Object.entries(L.status).map(([k, v]) => `<option value="${k}">${escapeHtml(v)}</option>`).join('')}</select>
  <span class="muted" id="shown" aria-live="polite"></span>
</div>`;
  const labels = {
    shown: L.shown('{n}'), noMatch: L.noMatch, conf: L.conf, tag: L.tag, change: L.change, otherRules: L.otherRules,
    edgeCases: L.edgeCases, history: L.history, toValidate: L.toValidate, policy: L.policy, notExtracted: L.notExtracted,
    openInDocument: L.openInDocument, close: L.close,
  };
  const json = JSON.stringify(labels).replace(/</g, '\\u003c');
  const mapJson = JSON.stringify(mapModel(data)).replace(/</g, '\\u003c');
  const body = data.counts.rules || data.counts.policies
    ? data.domains.map((d, i) => renderDomain(d, i, data, L)).join('\n')
    : `<p class="muted">${escapeHtml(L.empty)}</p>${data.domains.map((d, i) => renderDomain(d, i, data, L)).join('\n')}`;
  const views = `<nav class="views" role="tablist" aria-label="${escapeHtml(L.views)}">
  <button type="button" role="tab" data-view="document" aria-selected="true">${escapeHtml(L.viewDocument)}</button>
  <button type="button" role="tab" data-view="map" aria-selected="false">${escapeHtml(L.viewMap)}</button>
  <button type="button" role="tab" data-view="dashboard" aria-selected="false">${escapeHtml(L.viewDashboard)}</button>
</nav>`;
  const mapView = `<section class="view" id="view-map" hidden>
  <div class="map-frame wide">
    <div class="map-tools"><button type="button" data-zoom="in" aria-label="+">+</button><button type="button" data-zoom="out" aria-label="−">−</button><button type="button" data-zoom="fit" aria-label="${escapeHtml(L.fit)}">⤢</button><button type="button" data-zoom="reset" class="wide-btn">${escapeHtml(L.relayout)}</button><span class="muted">${escapeHtml(L.mapHint)}</span></div>
    <svg id="mindmap" role="img" aria-label="${escapeHtml(L.viewMap)}"><g id="mm-viewport"></g></svg>
    <aside class="map-panel" id="mm-panel" hidden></aside>
    <p class="map-legend muted">${Object.keys(L.conf).map((k) => `<span><span class="dot conf-${k}"></span>${escapeHtml(L.conf[k])}</span>`).join(' ')}</p>
  </div>
</section>`;

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(L.title)} · ${escapeHtml(data.project.name)}</title>
<style>
${asset('viewer.css')}
</style>
</head>
<body>
<div class="shell">
<aside class="sidebar">
  <div class="brand"><span class="brand-mark" aria-hidden="true"></span><div><strong>${escapeHtml(data.project.name)}</strong><span>${escapeHtml(L.title)}</span></div><button type="button" id="theme" class="theme" aria-label="${escapeHtml(L.theme)}">◐</button></div>
  ${views}
  ${controls}
  <nav class="side-domains" aria-label="${escapeHtml(L.toc)}">${data.domains.map((d, i) => `<a class="side-domain" href="#${escapeHtml(d.code)}" style="--dom:${domainColor(i)}"><span class="swatch"></span><span class="name">${inline(d.title)}</span><span class="count">${d.extracted ? ruleCount(d) : '—'}</span></a>`).join('')}</nav>
</aside>
<main class="page">
<header class="hero">
  <p class="hero-meta">${escapeHtml(data.project.builtAt)}${data.project.commit ? ` · ${escapeHtml(data.project.commit)}` : ''}</p>
  <h1>${escapeHtml(L.title)}</h1>
  <p class="lede">${escapeHtml(L.intro(data.counts.rules, data.counts.domains))}</p>
</header>
<noscript><p class="noscript">${escapeHtml(L.noScript)}</p></noscript>
<section class="view" id="view-document">
${since}
${toc}
<p class="muted no-match" id="no-match" hidden>${escapeHtml(L.noMatch)}</p>
${body}
${toValidate}
</section>
${mapView}
${renderDashboard(data, L)}
<footer class="footer muted"><p>${escapeHtml(L.footer(data.project.version, data.project.commit ?? '—'))} ${escapeHtml(L.coverage(data.counts.extracted, data.counts.domains))}</p></footer>
</main>
</div>
<script id="rulebook-labels" type="application/json">${json}</script>
<script id="rulebook-data" type="application/json">${mapJson}</script>
<script>
${asset('layout.js')}
${asset('viewer.js')}
${asset('mindmap.js')}
</script>
</body>
</html>
`;
}
