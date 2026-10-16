import { readFileSync } from 'node:fs';
import { t } from './i18n.js';

const asset = (name) => readFileSync(new URL(`./${name}`, import.meta.url), 'utf8');

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function inline(s) {
  return escapeHtml(s).replace(/`([^`]+)`/g, '<code>$1</code>');
}

export function evidenceHref(repoUrl, commit, ev) {
  if (!repoUrl) return `../${ev.path}`;
  const base = repoUrl.replace(/\/+$/, '');
  const blob = /gitlab/i.test(base) ? '/-/blob/' : '/blob/';
  const lines = ev.end > ev.start ? `#L${ev.start}-L${ev.end}` : `#L${ev.start}`;
  return `${base}${blob}${commit}/${ev.path}${lines}`;
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
    return `<a href="${escapeHtml(evidenceHref(data.project.repoUrl, data.project.commit, ev))}">${escapeHtml(`${file}:${ev.start}`)}</a>`;
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
  ${card.history.length ? `<details class="history"><summary>${escapeHtml(L.history)}</summary><ul>${card.history.map((h) => `<li>${escapeHtml(h.date)} · ${escapeHtml(h.change)}${h.note ? ` · ${inline(h.note)}` : ''}</li>`).join('')}</ul></details>` : ''}
  ${card.sections.openQuestions ? `<aside class="question"><strong>${escapeHtml(L.toValidate)}</strong> ${inline(card.sections.openQuestions)}</aside>` : ''}
</article>`;
}

function renderDomain(domain, index, data, L) {
  const n = index + 1;
  if (!domain.extracted) {
    return `<section class="domain is-empty" id="${escapeHtml(domain.code)}"><h2>${n}. ${inline(domain.title)}</h2><p class="lede">${inline(domain.description)}</p><p class="muted">${escapeHtml(L.notExtracted)}</p></section>`;
  }
  const policies = domain.policies.map((p, i) => `<section class="policy" id="${escapeHtml(p.card.id)}" data-kind="policy" data-search="${escapeHtml([p.card.id, p.card.title, p.card.sections.statement].join(' ').toLowerCase())}">
  <h3>${n}.${i + 1} ${inline(p.card.title)}</h3>
  ${p.card.sections.statement ? `<p class="policy-statement"><span class="label">${escapeHtml(L.policy)}</span> ${inline(p.card.sections.statement)}</p>` : ''}
  ${p.rules.map((r) => renderRule(r, data, L)).join('\n')}
</section>`).join('\n');
  const others = domain.otherRules.length
    ? `<section class="policy" data-kind="policy"><h3>${n}.${domain.policies.length + 1} ${escapeHtml(L.otherRules)}</h3>${domain.otherRules.map((r) => renderRule(r, data, L)).join('\n')}</section>`
    : '';
  return `<section class="domain" id="${escapeHtml(domain.code)}"><h2>${n}. ${inline(domain.title)}</h2>${domain.description ? `<p class="lede">${inline(domain.description)}</p>` : ''}${policies}${others}</section>`;
}

export function renderHtml(data) {
  const L = t(data.project.language);
  const lang = data.project.language === 'fr' ? 'fr' : 'en';
  const ruleCount = (d) => d.policies.reduce((n, p) => n + p.rules.length, 0) + d.otherRules.length;
  const since = data.since.from
    ? `<section class="since" id="since"><h2 class="small">${escapeHtml(L.since(data.since.from))}</h2>${data.since.items.length
      ? `<ul>${data.since.items.map((i) => `<li><span class="tag tag-${i.type}">${escapeHtml(L.tag[i.type])}</span> <a href="#${escapeHtml(i.id)}">${escapeHtml(i.id)}</a> · ${inline(i.title)}${i.note ? ` — ${inline(i.note)}` : ''}</li>`).join('')}</ul>` : ''}</section>`
    : `<section class="since" id="since"><p class="muted">${escapeHtml(L.firstVersion)}</p></section>`;
  const toc = `<nav class="toc" id="toc"><h2 class="small">${escapeHtml(L.toc)}</h2><ol>${data.domains.map((d) => `<li class="${d.extracted ? '' : 'muted'}"><a href="#${escapeHtml(d.code)}">${inline(d.title)}</a> <span class="muted">· ${escapeHtml(d.extracted ? L.rulesCount(ruleCount(d)) : L.notExtracted)}</span></li>`).join('')}</ol></nav>`;
  const toValidate = `<section class="to-validate" id="to-validate"><h2>${escapeHtml(L.toValidate)}</h2>${data.toValidate.length
    ? `<ul>${data.toValidate.map((v) => `<li><span class="label">${escapeHtml(L.item[v.type])}</span> ${v.id ? `<a href="#${escapeHtml(v.id)}">${escapeHtml(v.id)}</a> · ` : ''}${inline(v.text)}</li>`).join('')}</ul>`
    : `<p class="muted">${escapeHtml(L.nothingToValidate)}</p>`}</section>`;
  const controls = `<div class="controls" role="search">
  <input type="search" id="q" placeholder="${escapeHtml(L.search)}" aria-label="${escapeHtml(L.search)}">
  <select id="f-kind" aria-label="${escapeHtml(L.anyKind)}"><option value="">${escapeHtml(L.anyKind)}</option><option value="policy">${escapeHtml(L.kindPolicy)}</option><option value="rule">${escapeHtml(L.kindRule)}</option></select>
  <select id="f-confidence" aria-label="${escapeHtml(L.anyConfidence)}"><option value="">${escapeHtml(L.anyConfidence)}</option>${Object.entries(L.conf).map(([k, v]) => `<option value="${k}">${escapeHtml(v)}</option>`).join('')}</select>
  <span class="muted" id="shown" aria-live="polite"></span>
</div>`;
  const labels = { shown: L.shown('{n}'), noMatch: L.noMatch };
  const json = JSON.stringify(labels).replace(/</g, '\\u003c');
  const body = data.counts.rules || data.counts.policies
    ? data.domains.map((d, i) => renderDomain(d, i, data, L)).join('\n')
    : `<p class="muted">${escapeHtml(L.empty)}</p>${data.domains.map((d, i) => renderDomain(d, i, data, L)).join('\n')}`;

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
<main class="page">
<header class="masthead">
  <p class="muted">${escapeHtml(data.project.name)} · ${escapeHtml(data.project.builtAt)} · ${escapeHtml(data.project.commit ?? '')}</p>
  <div class="title-row"><h1>${escapeHtml(L.title)}</h1><button type="button" id="theme" class="theme" aria-label="${escapeHtml(L.theme)}">◐</button></div>
  <p class="lede">${escapeHtml(L.intro(data.counts.rules, data.counts.domains))}</p>
</header>
${since}
${toc}
${controls}
<p class="muted no-match" id="no-match" hidden>${escapeHtml(L.noMatch)}</p>
${body}
${toValidate}
<footer class="footer muted"><p>${escapeHtml(L.footer(data.project.version, data.project.commit ?? '—'))} ${escapeHtml(L.coverage(data.counts.extracted, data.counts.domains))}</p></footer>
</main>
<script id="rulebook-labels" type="application/json">${json}</script>
<script>
${asset('viewer.js')}
</script>
</body>
</html>
`;
}
