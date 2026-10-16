// Checks a finished scenario workspace against the plan-4 pass criteria.
// Usage: node tests/skills/evaluate.mjs <map|extract|edge|sync|publish> <workspace>
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { score } from './score.mjs';
import { parseIndexMd } from '../../cli/src/parse/indexmd.js';
import { parseDomainFile } from '../../cli/src/parse/cards.js';
import { domainFiles } from '../../cli/src/project.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(here, '../../cli/bin/rulebook.js');
const expected = JSON.parse(fs.readFileSync(path.join(here, 'shop/expected.json'), 'utf8'));
const [kind, ws] = process.argv.slice(2);
const rb = path.join(ws, 'rulebook');
const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '');
const cli = (...args) => { try { return { code: 0, out: execFileSync(process.execPath, [CLI, ...args], { cwd: ws, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }; } catch (e) { return { code: e.status, out: `${e.stdout ?? ''}${e.stderr ?? ''}` }; } };
const changedOutside = () => execFileSync('git', ['status', '--porcelain'], { cwd: ws, encoding: 'utf8' }).split('\n').filter(Boolean)
  .map((l) => l.slice(3)).filter((p) => !p.startsWith('rulebook/') && !p.startsWith('"rulebook/'));
const cards = () => domainFiles(rb).flatMap((f) => parseDomainFile(read(path.join(rb, f)), f).cards);
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });

if (kind === 'map') {
  const domains = parseIndexMd(read(path.join(rb, 'index.md')));
  check('index.md lists 3-4 domains', domains.length >= 3 && domains.length <= 4, domains.map((d) => d.code).join(','));
  check('every domain has details', domains.length > 0 && domains.every((d) => d.details.length >= 2), domains.map((d) => `${d.code}:${d.details.length}`).join(','));
  check('rulebook.html built', fs.existsSync(path.join(rb, 'rulebook.html')));
  let cfg = {};
  try { cfg = JSON.parse(read(path.join(rb, 'config.json'))); } catch { /* reported below */ }
  check('config.json formatVersion 1', cfg.formatVersion === 1);
  check('config.json language set', typeof cfg.language === 'string');
  check('hotspots cover src', (cfg.hotspots ?? []).some((h) => h.startsWith('src')));
  check('no source file changed', changedOutside().length === 0, changedOutside().join(','));
}
if (kind === 'extract') {
  const s = score(rb, expected, ws);
  const ruleCards = cards().filter((c) => c.kind === 'rule');
  check('at least one rule card parsed', ruleCards.length > 0, String(ruleCards.length));
  const some = (ok) => ruleCards.length > 0 && ok;
  check('recall >= 0.85', s.recall >= 0.85, `${s.recall} missing ${s.missing}`);
  check('precision >= 0.8', s.precision >= 0.8, `${s.precision} extra ${s.extra}`);
  check('citations valid', s.citationValidity === 1, s.unresolved.join('; '));
  const idx = cli('index', '--strict');
  check('rulebook index --strict exits 0', idx.code === 0, idx.out.trim().split('\n').slice(-3).join(' | '));
  check('no parse warnings', s.parseWarnings === 0, String(s.parseWarnings));
  check('every policy has Nature', s.policyChecks.total > 0 && s.policyChecks.withNature === s.policyChecks.total, JSON.stringify(s.policyChecks));
  check('every policy has a rule', s.policyChecks.total > 0 && s.policyChecks.withRules === s.policyChecks.total);
  check('no technical choice as policy', some(s.policyChecks.technicalAsPolicy === 0));
  for (const [k, v] of Object.entries(s.traps)) check(`trap ${k}`, some(v === 'pass'));
  check('every card audited', some(ruleCards.every((c) => /^(passed|failed: .+)$/.test(c.meta.audit ?? ''))));
  check('no source file changed', changedOutside().length === 0, changedOutside().join(','));
}
if (kind === 'edge') {
  const all = cards();
  const acc = all.filter((c) => c.id.startsWith('ACC-R'));
  const edges = acc.flatMap((c) => c.edgeCases);
  const prc = all.find((c) => c.id === 'PRC-R002');
  check('lockout: 5th attempt case', edges.some((e) => /\b(5|fifth|5th)\b/i.test(e.text)), edges.map((e) => e.text).join(' / '));
  check('lockout: expiry instant case', edges.some((e) => /lock/i.test(e.text) && /(exact|instant|moment|precisely)/i.test(e.text) && /(expir|until|ends|over)/i.test(e.text)));
  check('coupon: expiry instant case', (prc?.edgeCases ?? []).some((e) => /expir/i.test(e.text)));
  const allEdges = all.flatMap((c) => c.edgeCases);
  check('Given/When/Then wording', allEdges.length > 0 && allEdges.every((e) => /given/i.test(e.text) && /when/i.test(e.text) && /then/i.test(e.text)));
  check('each case has a confidence', allEdges.every((e) => e.confidence));
  const idx = cli('index');
  check('no parse warnings', !/unknown|unreadable|unrecognised/.test(idx.out), idx.out.trim());
  check('no test or source file written', changedOutside().length === 0, changedOutside().join(','));
}
if (kind === 'sync') {
  const all = cards();
  const refund = all.find((c) => c.id === 'ORD-R001');
  check('refund statement now says 7 days', /\b7\b/.test(`${refund?.title} ${refund?.sections.rule}`) && !/\b14\b/.test(refund?.sections.rule ?? ''), refund?.sections.rule);
  check('refund history has a changed line', refund?.history.some((h) => h.change === 'changed'));
  const pwd = all.find((c) => c.id === 'ACC-R001');
  check('password rule kept, not retired', pwd && pwd.meta.status !== 'retired' && /12/.test(pwd.sections.rule ?? ''));
  check('password rule re-anchored', pwd?.evidence.some((e) => e.symbol === 'validatePassword') || pwd?.history.some((h) => h.change === 'reanchored'));
  const gift = all.find((c) => /gift/i.test(`${c.title} ${c.sections.rule}`));
  check('gift card rule added as candidate', gift && gift.meta.status === 'candidate', gift?.id);
  const idx = cli('index', '--strict');
  check('rulebook index --strict exits 0', idx.code === 0, idx.out.trim().split('\n').slice(-3).join(' | '));
  const inbox = read(path.join(rb, 'inbox.md'));
  check('processed entries deleted (no pending, not ticked)', !/^- \[ \]/m.test(inbox) && !/^- \[x\].*(ORD-R001|ACC-R001|giftcard)/m.test(inbox), inbox.split('\n').filter((l) => l.startsWith('- [')).join(' | '));
  const after = cli('check');
  check('check afterwards adds nothing', after.out.trim() === '', after.out.trim());
}
if (kind === 'publish') {
  check('rulebook.html built', fs.existsSync(path.join(rb, 'rulebook.html')));
  check('no source file changed', changedOutside().length === 0, changedOutside().join(','));
}

for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  — ${r.detail}` : ''}`);
console.log(`${results.filter((r) => r.ok).length}/${results.length} passed`);
