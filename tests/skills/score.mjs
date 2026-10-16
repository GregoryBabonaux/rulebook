// Scores a produced rulebook/ against a fixture's expected.json, using the CLI's own parser.
// Usage: node tests/skills/score.mjs <rulebookDir> <expected.json> [appRoot]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDomainFile } from '../../cli/src/parse/cards.js';
import { domainFiles } from '../../cli/src/project.js';
import { buildIndex } from '../../cli/src/index/build.js';

const norm = (p) => p.replace(/\\/g, '/').replace(/^\.\//, '');
const overlaps = (ev, anchor) => norm(ev.path) === anchor.file && ev.start <= anchor.lines[1] && ev.end >= anchor.lines[0];
const matchesRule = (card, rule) => card.evidence.some((ev) => rule.anchors.some((a) => overlaps(ev, a)));

export function score(rulebookDir, expected, appRoot = path.dirname(rulebookDir)) {
  const cards = [];
  let parseWarnings = 0;
  for (const f of domainFiles(rulebookDir)) {
    const parsed = parseDomainFile(fs.readFileSync(path.join(rulebookDir, f), 'utf8'), f);
    cards.push(...parsed.cards);
    parseWarnings += parsed.warnings.length;
  }
  const rules = cards.filter((c) => c.kind === 'rule' && c.meta.status !== 'retired');
  const policies = cards.filter((c) => c.kind === 'policy');

  const matchedExpected = expected.rules.filter((r) => rules.some((c) => matchesRule(c, r)));
  const matchingProduced = rules.filter((c) => expected.rules.some((r) => matchesRule(c, r)));
  const { index, unresolved } = buildIndex(appRoot, rules, null);
  const totalEvidence = index.anchors.length + unresolved.length;

  const cardsFor = (key) => {
    const rule = expected.rules.find((r) => r.key === key);
    return rules.filter((c) => matchesRule(c, rule));
  };
  const statementOf = (c) => `${c.title} ${c.sections.rule ?? ''}`;
  const { lyingComment, deadCode, technicalChoice } = expected.traps;
  const refundCards = cardsFor(lyingComment.rule);
  const trapFiles = new Set(expected.rules.find((r) => r.key === lyingComment.rule).anchors.map((a) => a.file));
  const rulesCitingTrapFiles = rules.filter((c) => c.evidence.some((ev) => trapFiles.has(norm(ev.path))));
  const technicalCards = cardsFor(technicalChoice.rule);
  const implementingRules = (p) => rules.filter((r) => r.policy === p.id || r.meta.implements === p.id);

  return {
    recall: matchedExpected.length / expected.rules.length,
    precision: rules.length ? matchingProduced.length / rules.length : 0,
    citationValidity: totalEvidence ? index.anchors.length / totalEvidence : 1,
    parseWarnings,
    missing: expected.rules.filter((r) => !matchedExpected.includes(r)).map((r) => r.key),
    extra: rules.filter((c) => !matchingProduced.includes(c)).map((c) => c.id),
    unresolved: unresolved.map((u) => `${u.rule} ${u.path} (${u.reason})`),
    policyChecks: {
      total: policies.length,
      withNature: policies.filter((p) => p.meta.nature).length,
      withRules: policies.filter((p) => implementingRules(p).length > 0).length,
      technicalAsPolicy: technicalCards.filter((c) => c.policy || c.meta.implements).length,
    },
    traps: {
      // the code decides, never the comment: the card that states the window follows the code,
      // and no card states the commented value (cards may be split finer, e.g. "never delivered")
      lyingComment: refundCards.some((c) => statementOf(c).includes(lyingComment.mustMention))
        && !rulesCitingTrapFiles.some((c) => new RegExp(`\\b${lyingComment.mustNotMention}\\b`).test(statementOf(c))) ? 'pass' : 'fail',
      deadCode: rules.some((c) => c.evidence.some((ev) => overlaps(ev, deadCode))) ? 'fail' : 'pass',
      technicalChoice: technicalCards.every((c) => !c.policy && !c.meta.implements) ? 'pass' : 'fail',
    },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [dir, expectedPath, appRoot] = process.argv.slice(2);
  const result = score(path.resolve(dir), JSON.parse(fs.readFileSync(expectedPath, 'utf8')), appRoot ? path.resolve(appRoot) : undefined);
  console.log(JSON.stringify(result, null, 2));
  const r = (n) => Math.round(n * 100) / 100;
  console.log(`recall ${r(result.recall)} · precision ${r(result.precision)} · citations ${r(result.citationValidity)} · warnings ${result.parseWarnings} · traps ${Object.entries(result.traps).map(([k, v]) => `${k}:${v}`).join(' ')}`);
}
