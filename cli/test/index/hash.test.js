import test from 'node:test';
import assert from 'node:assert/strict';
import { splitLines, hashRange, findRange, hashText } from '../../src/index/hash.js';

const SRC = ['a', 'function refund() {', '  return x <= 14;', '}', 'z'];

test('hashText returns 12 hex chars', () => {
  assert.match(hashText('hello'), /^[0-9a-f]{12}$/);
});

test('hashRange ignores indentation, inner spacing, blank lines and CRLF', () => {
  const h = hashRange(SRC, 2, 4);
  const crlf = splitLines(SRC.join('\r\n'));
  assert.equal(hashRange(crlf, 2, 4), h);
  assert.equal(hashRange(['a', 'function   refund() {', '', '\treturn x <= 14;', '}'], 2, 5), h);
});

test('findRange relocates a drifted range and prefers the match nearest the hint', () => {
  const h = hashRange(SRC, 2, 4);
  const drifted = ['// new', '// lines', ...SRC];
  assert.equal(findRange(drifted, h, 3, 2), 4);
  const twice = [...SRC, ...SRC];
  assert.equal(findRange(twice, h, 3, 7), 7);
  assert.equal(findRange(['nothing'], h, 3, 1), null);
});
