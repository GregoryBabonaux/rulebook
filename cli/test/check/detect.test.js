import test from 'node:test';
import assert from 'node:assert/strict';
import { detect } from '../../src/check/detect.js';
import { globToRegExp, matchesAny } from '../../src/check/globs.js';
import { isRuleBearing } from '../../src/check/patterns.js';
import { splitLines, fingerprint } from '../../src/index/hash.js';
import { POLICY_SRC } from '../helpers/fixture.js';

const PATH = 'app/Policies/OrderPolicy.php';
const anchor = { rule: 'PAY-R012', kind: 'enforcement', path: PATH, symbol: 'OrderPolicy::refund', lines: [9, 13], ...fingerprint(splitLines(POLICY_SRC), 9, 13) };
const index = { version: 1, verifiedAt: 'abc', anchors: [anchor] };
const modified = (hunks) => [{ path: PATH, oldPath: PATH, status: 'modified', hunks }];
const hunk = (newStart, added, removed = []) => ({ oldStart: newStart, oldLines: removed.length, newStart, newLines: added.length, removed, added });
const reader = (text) => (p) => (p === PATH ? text : null);

test('globs', () => {
  assert.ok(globToRegExp('app/Rules/**').test('app/Rules/Deep/Min.php'));
  assert.ok(globToRegExp('**/*Policy.php').test('OrderPolicy.php'));
  assert.ok(globToRegExp('**/*Policy.php').test('app/x/OrderPolicy.php'));
  assert.ok(!globToRegExp('app/*.php').test('app/x/y.php'));
  assert.ok(matchesAny('db/migrations/1.sql', ['src/**', 'db/**']));
});

test('rule-bearing patterns ignore comments', () => {
  assert.ok(isRuleBearing('    throw new ValidationException("x");'));
  assert.ok(isRuleBearing("    'email' => 'required|email',"));
  assert.ok(isRuleBearing('    abort_if($user->isBanned(), 403);'));
  assert.ok(!isRuleBearing('    // throw later'));
  assert.ok(!isRuleBearing('    $total = $a + $b;'));
});

test('editing inside an anchored range reports modified?', () => {
  const text = POLICY_SRC.replace('<= 14', '<= 7');
  const d = detect({ index, diffs: modified([hunk(12, ['            && $order->delivered_at->diffInDays(now()) <= 7;'], ['x'])]), readFile: reader(text) });
  assert.equal(d.length, 1);
  assert.deepEqual({ type: d[0].type, rule: d[0].rule, path: d[0].path, lines: d[0].lines }, { type: 'modified?', rule: 'PAY-R012', path: PATH, lines: [9, 13] });
  assert.match(d[0].key, /^[0-9a-f]{12}$/);
});

test('line drift above the anchor reports nothing', () => {
  const text = `// header\n// header\n${POLICY_SRC}`;
  assert.deepEqual(detect({ index, diffs: modified([hunk(1, ['// header', '// header'])]), readFile: reader(text) }), []);
});

test('removing the symbol reports removed?', () => {
  const text = POLICY_SRC.split('\n').slice(0, 7).concat(['}', '']).join('\n');
  const d = detect({ index, diffs: modified([hunk(8, [], ['x'])]), readFile: reader(text) });
  assert.deepEqual(d.map((x) => [x.type, x.rule]), [['removed?', 'PAY-R012']]);
});

test('a deleted file reports removed?', () => {
  const d = detect({ index, diffs: [{ path: PATH, oldPath: PATH, status: 'deleted', hunks: [] }], readFile: () => null });
  assert.deepEqual(d.map((x) => x.type), ['removed?']);
});

test('a renamed file keeps its anchors', () => {
  const d = detect({ index, diffs: [{ path: 'app/Policies/Renamed.php', oldPath: PATH, status: 'modified', hunks: [] }], readFile: () => POLICY_SRC });
  assert.deepEqual(d, []);
});

test('rule-bearing code outside any anchor reports new?', () => {
  const svc = 'app/Services/Coupon.php';
  const d = detect({ index, diffs: [{ path: svc, oldPath: svc, status: 'modified', hunks: [hunk(3, ['  if ($c->expired()) throw new Gone();'])] }], readFile: () => 'a\nb\n  if ($c->expired()) throw new Gone();\n' });
  assert.deepEqual(d.map((x) => [x.type, x.rule, x.path, x.lines]), [['new?', null, svc, [3, 3]]]);
});

test('any non-blank change in a hotspot reports new?, plain code elsewhere does not', () => {
  const hot = 'app/Rules/Min.php';
  const diffs = [
    { path: hot, oldPath: hot, status: 'added', hunks: [hunk(1, ['return $v > 3;'])] },
    { path: 'app/Util.php', oldPath: 'app/Util.php', status: 'added', hunks: [hunk(1, ['return $v > 3;'])] },
  ];
  const d = detect({ index, diffs, readFile: () => 'return $v > 3;\n', hotspots: ['app/Rules/**'] });
  assert.deepEqual(d.map((x) => x.path), [hot]);
});

test('test files and the rulebook folder never produce new?', () => {
  const diffs = ['tests/FooTest.php', 'rulebook/PAY-payments.md'].map((p) => ({ path: p, oldPath: p, status: 'added', hunks: [hunk(1, ['throw new X();'])] }));
  assert.deepEqual(detect({ index, diffs, readFile: () => 'throw new X();\n', hotspots: ['**'] }), []);
});

test('an edit inside an anchor does not also produce new?', () => {
  const text = POLICY_SRC.replace('<= 14;', '<= 14 || throw new Late();');
  const d = detect({ index, diffs: modified([hunk(12, ['            && $order->delivered_at->diffInDays(now()) <= 14 || throw new Late();'], ['x'])]), readFile: reader(text) });
  assert.deepEqual(d.map((x) => x.type), ['modified?']);
});

test('two anchors of the same rule in one file give one detection', () => {
  const twin = { ...anchor, lines: [4, 7], hash: 'deadbeef0000' };
  const d = detect({ index: { ...index, anchors: [anchor, twin] }, diffs: modified([hunk(12, ['x'], ['y'])]), readFile: reader(POLICY_SRC.replace('<= 14', '<= 7')) });
  assert.equal(d.filter((x) => x.rule === 'PAY-R012').length, 1);
});

test('documentation, agent folders and lockfiles never produce new?', () => {
  const paths = ['.claude/skills/x/references/cli.md', '.agents/skills/y/SKILL.md', '.github/hooks/rulebook.json', 'docs/guide.md', 'AGENTS.md', 'skills-lock.json', 'node_modules/a/index.js', 'vendor/b/c.php', 'README.txt'];
  const diffs = paths.map((p) => ({ path: p, oldPath: p, status: 'added', hunks: [hunk(1, ['throw new X(); // required'])] }));
  assert.deepEqual(detect({ index, diffs, readFile: () => 'throw new X();\n', hotspots: ['src/**'] }), []);
});

test('an explicit hotspot still wins over the default ignore list', () => {
  const diffs = [{ path: 'docs/rules.md', oldPath: 'docs/rules.md', status: 'added', hunks: [hunk(1, ['A refund is refused after 14 days.'])] }];
  assert.equal(detect({ index, diffs, readFile: () => 'x\n', hotspots: ['docs/**'] }).length, 1);
});
