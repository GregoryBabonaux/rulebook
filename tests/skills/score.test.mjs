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
  assert.deepEqual(s.traps, { lyingComment: 'pass', deadCode: 'pass', technicalChoice: 'pass' });
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
