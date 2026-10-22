import fs from 'node:fs';
import path from 'node:path';
import { loadProject, domainFiles } from '../project.js';
import { parseDomainFile } from '../parse/cards.js';
import { parseIndexMd } from '../parse/indexmd.js';
import { headSha } from '../git.js';
import { evidenceHref } from '../build/render.js';

// rulebook → Open Knowledge Format v0.2 (Google Cloud, knowledge-catalog/okf/SPEC.md).
// Deterministic: the same cards give the same bundle. The native card format stays the source.
const OKF_VERSION = '0.2';
const MARKER = '.rulebook-okf';
const STATUS = { candidate: 'draft', active: 'stable', changed: 'stable', retired: 'deprecated' };
const CHANGE = { created: 'Creation', changed: 'Update', retired: 'Deprecation', reanchored: 'Update' };

const q = (s) => JSON.stringify(String(s ?? ''));
const at = (date) => `${date}T00:00:00Z`;
const lower = (code) => code.toLowerCase();
const ruleLink = (card) => `[${card.id} · ${card.title}](/${lower(card.domain)}/${card.kind === 'policy' ? 'policies' : 'rules'}/${card.id}.md)`;

function frontmatter(fields) {
  const lines = ['---'];
  for (const [k, v] of fields) {
    if (v === undefined || v === null || v === '') continue;
    lines.push(String(v).startsWith('\n') ? `${k}:${v}` : `${k}: ${v}`);
  }
  lines.push('---', '');
  return lines.join('\n');
}

function evidenceText(ev) {
  if (ev.kind === 'data') return `data — ${ev.source}:${ev.table}${ev.filter ? ` \`${ev.filter}\`` : ''}`;
  const range = ev.end !== ev.start ? `${ev.start}-${ev.end}` : `${ev.start}`;
  return `${ev.kind} — ${ev.path}:${range}${ev.symbol ? ` \`${ev.symbol}\`` : ''}`;
}

function sourcesYaml(card, ctx, conceptRel) {
  if (!card.evidence.length) return null;
  const lines = [''];
  card.evidence.forEach((ev, i) => {
    let resource;
    if (ev.kind === 'data') {
      resource = `data source ${ev.source}: ${ev.table}${ev.filter ? ` where ${ev.filter}` : ''}`;
    } else if (ctx.repoUrl) {
      resource = evidenceHref(ctx.repoUrl, ctx.commit, ev);
    } else {
      // inside the repository: a path relative to the concept file, so it resolves where the
      // bundle lives; outside it: the repository path, never a path of this machine
      const lines = `#L${ev.start}${ev.end !== ev.start ? `-L${ev.end}` : ''}`;
      const inside = !path.relative(ctx.root, ctx.outAbs).startsWith('..') && !path.isAbsolute(path.relative(ctx.root, ctx.outAbs));
      const fromConcept = path.relative(path.dirname(path.join(ctx.outAbs, conceptRel)), path.join(ctx.root, ev.path)).replace(/\\/g, '/');
      resource = `${inside ? fromConcept : ev.path}${lines}`;
    }
    lines.push(`  - id: e${i + 1}`, `    resource: ${q(resource)}`, `    title: ${q(evidenceText(ev))}`);
  });
  return lines.join('\n');
}

function generatedAt(card, fallback) {
  if (card.meta.verifiedAt?.date) return card.meta.verifiedAt.date;
  const dates = card.history.map((h) => h.date).sort();
  return dates.at(-1) ?? fallback;
}

function ruleConcept(card, ctx, cardsById) {
  const rel = `${lower(card.domain)}/rules/${card.id}.md`;
  const date = generatedAt(card, ctx.today);
  const tags = [lower(card.domain), card.meta.category, card.meta.confidence].filter(Boolean);
  const audited = card.meta.audit === 'passed';
  const fm = frontmatter([
    ['type', 'Business Rule'],
    ['title', q(card.title)],
    ['description', card.sections.rule ? q(card.sections.rule) : null],
    ['tags', `[${tags.map(q).join(', ')}]`],
    ['status', STATUS[card.meta.status] ?? 'stable'],
    ['generated', `{ by: rulebook-cli/${ctx.version}, at: ${at(date)} }`],
    ['verified', audited ? `{ by: process:rulebook-blind-audit, at: ${at(date)} }` : null],
    ['sources', sourcesYaml(card, ctx, rel)],
    ['rulebook_id', card.id],
    ['category', card.meta.category],
    ['confidence', card.meta.confidence],
    ['implements', card.policy ?? card.meta.implements],
  ]);
  // the statement describes what the code does: it cites the code and configuration that decide
  const cite = card.evidence.map((ev, i) => (['enforcement', 'config'].includes(ev.kind) ? `[^e${i + 1}]` : '')).join('');
  const body = [];
  if (card.sections.rule) body.push('# Rule', '', `${card.sections.rule}${cite}`, '');
  const policy = cardsById.get(card.policy ?? card.meta.implements);
  if (policy) body.push(`Implements ${ruleLink(policy)}.`, '');
  if (card.sections.context) body.push('# Context', '', card.sections.context, '');
  if (card.sections.parameters) body.push('# Parameters', '', card.sections.parameters, '');
  if (card.evidence.length) body.push('# Evidence', '', ...card.evidence.map((ev, i) => `- ${evidenceText(ev)} [^e${i + 1}]`), '');
  if (card.edgeCases.length) {
    body.push('# Edge cases', '', ...card.edgeCases.map((e) => `- **${e.id}** ${e.text}${e.confidence ? ` — ${e.confidence}` : ''}${e.ref ? ` — ${e.ref}` : ''}`), '');
  }
  if (card.sections.openQuestions) body.push('# Open questions', '', card.sections.openQuestions, '');
  if (card.history.length) body.push('# History', '', ...card.history.map((h) => `- ${h.date} · ${h.sha} · ${h.change}${h.note ? ` · ${h.note}` : ''}`), '');
  if (card.evidence.length) body.push(...card.evidence.map((ev, i) => `[^e${i + 1}]: ${evidenceText(ev)}`), '');
  return [rel, `${fm}\n${body.join('\n')}`];
}

function policyConcept(card, rules, ctx) {
  const rel = `${lower(card.domain)}/policies/${card.id}.md`;
  const fm = frontmatter([
    ['type', 'Business Policy'],
    ['title', q(card.title)],
    ['description', card.sections.statement ? q(card.sections.statement) : null],
    ['tags', `[${q(lower(card.domain))}]`],
    ['status', 'stable'],
    ['generated', `{ by: rulebook-cli/${ctx.version}, at: ${at(rules.map((r) => generatedAt(r, ctx.today)).sort().at(-1) ?? ctx.today)} }`],
    ['rulebook_id', card.id],
    ['nature', card.meta.nature ? q(card.meta.nature) : null],
  ]);
  const body = [];
  if (card.sections.statement) body.push('# Statement', '', card.sections.statement, '');
  if (card.meta.nature) body.push('# Nature', '', card.meta.nature, '');
  if (card.sections.context) body.push('# Context', '', card.sections.context, '');
  if (rules.length) body.push('# Operating rules', '', ...rules.map((r) => `* ${ruleLink(r)}${r.sections.rule ? ` - ${r.sections.rule}` : ''}`), '');
  if (card.sections.openQuestions) body.push('# Open questions', '', card.sections.openQuestions, '');
  return [rel, `${fm}\n${body.join('\n')}`];
}

function overviewConcept(domain, file, coverage, ctx) {
  const rel = `${lower(domain.code)}/overview.md`;
  const fm = frontmatter([
    ['type', 'Business Domain'],
    ['title', q(domain.title)],
    ['description', domain.description ? q(domain.description) : null],
    ['tags', `[${q(lower(domain.code))}]`],
    ['status', file ? 'stable' : 'draft'],
    ['generated', `{ by: rulebook-cli/${ctx.version}, at: ${at(ctx.today)} }`],
    ['rulebook_code', domain.code],
  ]);
  const body = [];
  if (domain.description) body.push(domain.description, '');
  for (const d of domain.details ?? []) body.push(`# ${d.label}`, '', d.text, '');
  if (file?.domain?.scope) body.push('# Scope', '', file.domain.scope, '');
  if (coverage) body.push('# Coverage', '', `${coverage.covered + coverage.dismissed} of ${coverage.total} decision points examined (rulebook scan).`, '');
  if (!file) body.push('Not extracted yet.', '');
  return [rel, `${fm}\n${body.join('\n')}`];
}

export function okfBundle(project, { version, today, outAbs }) {
  const readText = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '');
  const domains = parseIndexMd(readText(path.join(project.dir, 'index.md')));
  const files = domainFiles(project.dir).map((f) => parseDomainFile(readText(path.join(project.dir, f)), f));
  for (const f of files) {
    if (f.domain && !domains.some((d) => d.code === f.domain.code)) domains.push({ ...f.domain, details: [] });
  }
  let scan = null;
  try { scan = JSON.parse(readText(path.join(project.dir, '.scan.json')) || 'null'); } catch { scan = null; }
  const ctx = { version, today, outAbs, root: project.root, repoUrl: project.config.repoUrl, commit: headSha(project.root) };
  const cards = files.flatMap((f) => f.cards);
  const byId = new Map(cards.map((c) => [c.id, c]));
  const out = new Map();
  const rootIndex = ['---', `okf_version: "${OKF_VERSION}"`, '---', '', '# Business domains', ''];

  for (const domain of domains) {
    const file = files.find((f) => f.domain?.code === domain.code);
    const own = file?.cards ?? [];
    const policies = own.filter((c) => c.kind === 'policy');
    const rules = own.filter((c) => c.kind === 'rule');
    const [ovRel, ovText] = overviewConcept(domain, file, scan?.domains?.[domain.code], ctx);
    out.set(ovRel, ovText);
    const dirIndex = [`# ${domain.title}`, '', `* [Overview](overview.md) - ${domain.description || domain.title}`, ''];
    if (policies.length) {
      dirIndex.push('# Business policies', '');
      for (const p of policies) {
        const [rel, text] = policyConcept(p, rules.filter((r) => (r.policy ?? r.meta.implements) === p.id), ctx);
        out.set(rel, text);
        dirIndex.push(`* [${p.id} · ${p.title}](policies/${p.id}.md)${p.sections.statement ? ` - ${p.sections.statement}` : ''}`);
      }
      dirIndex.push('');
    }
    if (rules.length) {
      dirIndex.push('# Operating rules', '');
      for (const r of rules) {
        const [rel, text] = ruleConcept(r, ctx, byId);
        out.set(rel, text);
        dirIndex.push(`* [${r.id} · ${r.title}](rules/${r.id}.md)${r.sections.rule ? ` - ${r.sections.rule}` : ''}`);
      }
      dirIndex.push('');
    }
    out.set(`${lower(domain.code)}/index.md`, `${dirIndex.join('\n')}`);
    rootIndex.push(`* [${domain.title}](${lower(domain.code)}/) - ${domain.description || (file ? '' : 'not extracted yet')}`.replace(/ - $/, ''));
  }
  out.set('index.md', `${rootIndex.join('\n')}\n`);

  const events = cards.flatMap((c) => c.history.map((h) => ({ ...h, card: c })));
  const byDate = new Map();
  for (const e of events.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.card.id.localeCompare(b.card.id)))) {
    if (!byDate.has(e.date)) byDate.set(e.date, []);
    byDate.get(e.date).push(`* **${CHANGE[e.change] ?? 'Update'}**: ${ruleLink(e.card)}${e.note ? ` — ${e.note}` : ''}`);
  }
  const log = ['# Rulebook update log', ''];
  for (const [date, lines] of byDate) log.push(`## ${date}`, ...lines, '');
  out.set('log.md', `${log.join('\n')}`);
  return out;
}

export function runExport(io, args, opts, version) {
  if (args[0] !== 'okf') {
    io.stderr.write('rulebook: usage: rulebook export okf [--out <dir>]\n');
    return 1;
  }
  let project;
  try { project = loadProject(io.cwd, opts.dir); } catch (err) { io.stderr.write(`rulebook: ${err.message}\n`); return 1; }
  if (!project) { io.stderr.write(`rulebook: no ${opts.dir}/ folder in this git repository\n`); return 1; }
  const outRel = (opts.out ?? `${project.dirName}/okf`).replace(/\\/g, '/');
  const outAbs = path.resolve(project.root, outRel);
  if (fs.existsSync(outAbs) && fs.readdirSync(outAbs).length) {
    if (!fs.existsSync(path.join(outAbs, MARKER))) {
      io.stderr.write(`rulebook: ${outRel} is not empty and was not written by rulebook export — choose another --out\n`);
      return 1;
    }
    fs.rmSync(outAbs, { recursive: true, force: true });
  }
  const epoch = Number(io.env?.SOURCE_DATE_EPOCH);
  const now = Number.isFinite(epoch) && io.env.SOURCE_DATE_EPOCH !== '' ? new Date(epoch * 1000) : (io.now ? io.now() : new Date());
  const today = now.toISOString().slice(0, 10);
  const bundle = okfBundle(project, { version, today, outAbs });
  for (const [rel, text] of bundle) {
    const abs = path.join(outAbs, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text.endsWith('\n') ? text : `${text}\n`);
  }
  fs.writeFileSync(path.join(outAbs, MARKER), `Written by rulebook-cli ${version}. This folder is replaced by every rulebook export okf.\n`);
  io.stdout.write(`rulebook: exported an OKF ${OKF_VERSION} bundle to ${outRel} (${bundle.size - 1 - [...bundle.keys()].filter((k) => k.endsWith('/index.md')).length} concepts)\n`);
  return 0;
}
