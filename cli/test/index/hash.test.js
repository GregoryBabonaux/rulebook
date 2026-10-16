import test from 'node:test';
import assert from 'node:assert/strict';
import { splitLines, fingerprint, findRange, hashText } from '../../src/index/hash.js';

const SRC = ['a', 'function refund() {', '  return x <= 14;', '}', 'z'];

test('hashText returns 12 hex chars', () => {
  assert.match(hashText('hello'), /^[0-9a-f]{12}$/);
});

test('fingerprint ignores indentation, inner spacing, blank lines and CRLF', () => {
  const fp = fingerprint(SRC, 2, 4);
  assert.equal(fp.size, 3);
  assert.deepEqual(fingerprint(splitLines(SRC.join('\r\n')), 2, 4), fp);
  assert.deepEqual(fingerprint(['a', 'function   refund() {', '', '\treturn x <= 14;', '}'], 2, 5), fp);
});

test('findRange relocates a drifted range and prefers the match nearest the hint', () => {
  const fp = fingerprint(SRC, 2, 4);
  assert.deepEqual(findRange(['// new', '// lines', ...SRC], fp, 2), { start: 4, end: 6 });
  assert.deepEqual(findRange([...SRC, ...SRC], fp, 7), { start: 7, end: 9 });
  assert.equal(findRange(['nothing'], fp, 1), null);
});

test('a blank line inserted inside the range still matches', () => {
  const fp = fingerprint(SRC, 2, 4);
  assert.deepEqual(findRange(['a', 'function refund() {', '', '  return x <= 14;', '}', 'z'], fp, 2), { start: 2, end: 5 });
});

test('findRange stays fast on a large file when the range is gone', () => {
  const block = Array.from({ length: 61 }, (_, i) => `    $rule${i} = check($order, ${i});`);
  const fp = fingerprint(block, 1, 61);
  const big = Array.from({ length: 20000 }, (_, i) => `    $line${i} = compute($order, ${i});`);
  const t0 = performance.now();
  assert.equal(findRange(big, fp, 10000), null);
  assert.ok(performance.now() - t0 < 250, `took ${Math.round(performance.now() - t0)} ms`);
});
