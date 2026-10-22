import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { score } from './score.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const SHOP = path.join(here, 'shop');
const expected = JSON.parse(fs.readFileSync(path.join(SHOP, 'expected.json'), 'utf8'));
const APP = path.join(SHOP, 'app');
const GOLDEN = path.join(SHOP, 'golden');

test('the golden rulebook scores perfectly', () => {
  const s = score(GOLDEN, expected, APP);
  assert.equal(s.recall, 1);
  assert.equal(s.precision, 1);
  assert.equal(s.citationValidity, 1);
  assert.equal(s.parseWarnings, 0);
  assert.deepEqual(s.policyChecks, { total: 5, withNature: 5, withRules: 5, technicalAsPolicy: 0 });
  assert.deepEqual(s.traps, { lyingComment: 'pass', deadCode: 'pass', technicalChoice: 'pass', testOnly: 'pass', clientTrusted: 'pass', contradictoryThresholds: 'pass', ruleInView: 'pass', dataContradiction: 'pass' });
});

test('a degraded rulebook scores lower', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rulebook-score-'));
  for (const f of fs.readdirSync(GOLDEN)) fs.copyFileSync(path.join(GOLDEN, f), path.join(tmp, f));
  const ord = path.join(tmp, 'ORD-orders.md');
  let text = fs.readFileSync(ord, 'utf8');
  text = text.replace('only up to 14 days', 'only up to 30 days');
  text = text.replace('src/orders/state.js:2-3', 'src/orders/state.js:200-300');
  text = text.slice(0, text.indexOf('### ORD-R004'));
  fs.writeFileSync(ord, text);
  fs.appendFileSync(ord, '\n### ORD-R009 · Old refund\n- **Kind:** rule · **Category:** timing\n- **Status:** active · **Confidence:** read\n\n**Rule.** Thirty days.\n\n**Evidence.**\n- enforcement — src/orders/refund.js:20-22\n');
  const s = score(tmp, expected, APP);
  assert.ok(s.recall < 1);
  assert.ok(s.citationValidity < 1);
  assert.equal(s.traps.lyingComment, 'fail');
  assert.equal(s.traps.deadCode, 'fail');
});

test('the traps seen on a real project fail when a rulebook falls into them', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rulebook-score-'));
  for (const f of fs.readdirSync(GOLDEN)) fs.copyFileSync(path.join(GOLDEN, f), path.join(tmp, f));
  const acc = path.join(tmp, 'ACC-accounts.md');
  fs.writeFileSync(acc, fs.readFileSync(acc, 'utf8').replace('**Confidence:** conflicting', '**Confidence:** read'));
  const ord = path.join(tmp, 'ORD-orders.md');
  let text = fs.readFileSync(ord, 'utf8');
  // the staff card loses the remark that the flag comes from the client; the view rule goes
  text = text.split('\n').filter((l) => !l.startsWith('**Context.** The discount is granted') && !l.startsWith('**Open questions.** Should the server check the staff')).join('\n');
  text = text.slice(0, text.indexOf('### ORD-R007'));
  // and a card describes code that only tests call
  text += [
    '### ORD-R009 · Loyal customers ship free',
    '- **Kind:** rule · **Category:** derivation',
    '- **Status:** active · **Confidence:** verified',
    '',
    '**Rule.** Ten orders give free delivery.',
    '',
    '**Evidence.**',
    '- enforcement — src/orders/loyalty.js:2-4 `hasFreeDelivery`',
    '',
  ].join('\n');
  fs.writeFileSync(ord, text);
  const s = score(tmp, expected, APP);
  assert.equal(s.traps.testOnly, 'fail');
  assert.equal(s.traps.clientTrusted, 'fail');
  assert.equal(s.traps.contradictoryThresholds, 'fail');
  assert.equal(s.traps.ruleInView, 'fail');
});

test('the data trap fails when the card ignores the data', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rulebook-score-'));
  for (const f of fs.readdirSync(GOLDEN)) fs.copyFileSync(path.join(GOLDEN, f), path.join(tmp, f));
  const prc = path.join(tmp, 'PRC-pricing.md');
  const text = fs.readFileSync(prc, 'utf8').split('\n')
    .filter((l) => !l.startsWith('- data — reference:') && !l.startsWith('**Open questions.** Should the book with id 2'))
    .join('\n').replace(' The reference data holds one book at 20 % (Dune, id 2).', '');
  fs.writeFileSync(prc, text);
  assert.equal(score(tmp, expected, APP).traps.dataContradiction, 'fail');
});
