import fs from 'node:fs';
import path from 'node:path';
import { loadProject } from '../project.js';
import { headSha } from '../git.js';
import { loadCards } from '../index/build.js';
import { parseIndexMd } from '../parse/indexmd.js';
import { matchesAny, globToRegExp } from '../check/globs.js';
import { TEST_PATH } from '../check/patterns.js';
import { repoTextFiles } from './files.js';
import { findPoints, domainGlobs, parseNotRules } from './points.js';
import { referencedFiles } from './follow.js';

const readText = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// How far the scan follows a domain's references into files no domain owns.
const FOLLOW_DEPTH = 2;

export function scanProject(project) {
  const domains = parseIndexMd(readText(path.join(project.dir, 'index.md')));
  const compiled = domainGlobs(domains).map((d) => ({ code: d.code, res: d.globs.map(globToRegExp) }));
  const domainsOf = (p) => compiled.filter((d) => d.res.some((re) => re.test(p))).map((d) => d.code);
  const hotspots = project.config.hotspots?.length ? project.config.hotspots : domainGlobs(domains).flatMap((d) => d.globs);

  const { cards } = loadCards(project);
  const ranges = new Map();
  for (const card of cards) {
    if (card.kind !== 'rule' || card.meta.status === 'retired') continue;
    const add = (p, s, e) => {
      if (!ranges.has(p)) ranges.set(p, []);
      ranges.get(p).push([s, e]);
    };
    for (const ev of card.evidence) add(ev.path, ev.start, ev.end);
    // a value cited in Parameters, or the line an edge case points at, is examined too
    const refs = [card.sections.parameters ?? '', ...card.edgeCases.map((e) => e.ref ?? '')].join(' ');
    for (const m of refs.matchAll(/([\w./-]+\.\w+):(\d+)(?:-(\d+))?/g)) add(m[1], +m[2], m[3] ? +m[3] : +m[2]);
  }
  const notRules = parseNotRules(readText(path.join(project.dir, 'not-rules.md')));

  const files = repoTextFiles(project.root).filter((f) => !TEST_PATH.test(f.path));
  const byPath = new Map(files.map((f) => [f.path, f]));
  const owner = new Map(files.map((f) => [f.path, domainsOf(f.path)]));
  const allPaths = new Set(byPath.keys());

  // Files no domain owns but a domain's code refers to (a view, a helper class), two steps deep.
  const reached = new Map();
  for (const { code } of compiled) {
    let frontier = files.filter((f) => owner.get(f.path).includes(code)).map((f) => f.path);
    const seen = new Set(frontier);
    for (let depth = 0; depth < FOLLOW_DEPTH && frontier.length; depth++) {
      const next = [];
      for (const p of frontier) {
        for (const r of referencedFiles(p, byPath.get(p).text, allPaths)) {
          if (seen.has(r) || !byPath.has(r) || owner.get(r).length) continue;
          seen.add(r);
          next.push(r);
          if (!reached.has(r)) reached.set(r, new Set());
          reached.get(r).add(code);
        }
      }
      frontier = next;
    }
  }

  const points = [];
  for (const f of files) {
    const from = reached.get(f.path);
    if (!matchesAny(f.path, hotspots) && !from) continue;
    for (const p of findPoints(f.path, f.text)) {
      const covered = (ranges.get(p.path) ?? []).some(([s, e]) => p.line >= s && p.line <= e);
      const status = covered ? 'covered' : notRules.has(p.key) ? 'dismissed' : 'review';
      points.push({ ...p, domains: owner.get(f.path), ...(from ? { reached: [...from].sort() } : {}), status });
    }
  }

  const summary = {};
  for (const d of domains) summary[d.code] = { total: 0, covered: 0, dismissed: 0, review: 0, reached: { total: 0, review: 0 } };
  let outside = 0;
  for (const p of points) {
    for (const code of p.reached ?? []) {
      summary[code].reached.total++;
      if (p.status === 'review') summary[code].reached.review++;
    }
    if (!p.domains.length) { outside++; continue; }
    for (const code of p.domains) {
      summary[code].total++;
      summary[code][p.status]++;
    }
  }
  return { version: 1, commit: headSha(project.root), domains: summary, outside, points };
}

function formatLines(result) {
  const out = [`rulebook: ${plural(result.points.length, 'decision point')} found by line patterns (a first pass, not a parser)`];
  for (const [code, s] of Object.entries(result.domains)) {
    const reached = s.reached.total ? ` · ${s.reached.total} reached outside its paths (${s.reached.review} to review)` : '';
    out.push(`${code} · ${plural(s.total, 'decision point')} · ${s.covered} covered · ${plural(s.dismissed, 'not rule')} · ${s.review} to review${reached}`);
  }
  if (result.outside) out.push(`${plural(result.outside, 'decision point')} outside any domain (no Code path in rulebook/index.md matches)`);
  return out.join('\n');
}

// Identical lines (the same guard repeated in every component) are read once.
function groupedLines(todo) {
  const groups = new Map();
  for (const p of todo) {
    const id = `${p.kind}\n${p.text}`;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(p);
  }
  return [...groups.values()].map((group) => {
    const [p] = group;
    const text = p.text.replace(/`/g, "'").slice(0, 140);
    if (group.length === 1) return `- ${p.kind} — ${p.path}:${p.line} \`${text}\` · key ${p.key}`;
    return `- ${p.kind} ×${group.length} — \`${text}\` · ${group.map((g) => `${g.path}:${g.line}`).join(', ')} · keys ${group.map((g) => g.key).join(' ')}`;
  });
}

function formatMarkdown(result, domain) {
  const out = [];
  const codes = domain ? [domain] : Object.keys(result.domains);
  for (const code of codes) {
    const todo = result.points.filter((p) => p.status === 'review' && p.domains.includes(code));
    const away = result.points.filter((p) => p.status === 'review' && !p.domains.length && (p.reached ?? []).includes(code));
    out.push(`## ${code} · ${todo.length + away.length} to review`, '', ...groupedLines(todo), '');
    if (away.length) out.push(`### Reached from ${code}'s code, outside its paths`, '', ...groupedLines(away), '');
  }
  return out.join('\n').trimEnd();
}

export function runScan(io, opts) {
  let project;
  try { project = loadProject(io.cwd, opts.dir); } catch (err) { io.stderr.write(`rulebook: ${err.message}\n`); return 1; }
  if (!project) { io.stderr.write(`rulebook: no ${opts.dir}/ folder in this git repository\n`); return 1; }
  const result = scanProject(project);
  if (opts.domain && !(opts.domain in result.domains)) {
    io.stderr.write(`rulebook: unknown domain "${opts.domain}" (domains: ${Object.keys(result.domains).join(', ')})\n`);
    return 1;
  }
  fs.writeFileSync(path.join(project.dir, '.scan.json'), `${JSON.stringify(result, null, 2)}\n`);
  if (opts.format === 'json') io.stdout.write(`${JSON.stringify(result)}\n`);
  else if (opts.format === 'md') io.stdout.write(`${formatMarkdown(result, opts.domain)}\n`);
  else io.stdout.write(`${formatLines(result)}\n`);
  return 0;
}
