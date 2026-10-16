import test from 'node:test';
import assert from 'node:assert/strict';
import { parseUnifiedDiff, getDiff } from '../../src/git/diff.js';
import { makeRepo } from '../helpers/repo.js';

const SAMPLE = `diff --git a/app/a.php b/app/a.php
index 111..222 100644
--- a/app/a.php
+++ b/app/a.php
@@ -12 +12 @@ class A
-    return $x <= 14;
+    return $x <= 7;
@@ -20,0 +21,2 @@
+    throw new Forbidden();
+    // end
diff --git a/db/schema.sql b/db/schema.sql
--- a/db/schema.sql
+++ b/db/schema.sql
@@ -3,2 +3 @@
--- legacy comment
--- other
+-- new comment
diff --git a/old.js b/old.js
deleted file mode 100644
--- a/old.js
+++ /dev/null
@@ -1 +0,0 @@
-x
diff --git a/src/before.js b/src/after.js
similarity index 90%
rename from src/before.js
rename to src/after.js
`;

test('parses modified files with -U0 hunks', () => {
  const [a] = parseUnifiedDiff(SAMPLE);
  assert.equal(a.path, 'app/a.php');
  assert.equal(a.status, 'modified');
  assert.deepEqual(a.hunks[0], { oldStart: 12, oldLines: 1, newStart: 12, newLines: 1, removed: ['    return $x <= 14;'], added: ['    return $x <= 7;'] });
  assert.deepEqual(a.hunks[1], { oldStart: 20, oldLines: 0, newStart: 21, newLines: 2, removed: [], added: ['    throw new Forbidden();', '    // end'] });
});

test('removed lines starting with "--" are hunk content, not file headers', () => {
  const sql = parseUnifiedDiff(SAMPLE)[1];
  assert.equal(sql.path, 'db/schema.sql');
  assert.deepEqual(sql.hunks[0].removed, ['-- legacy comment', '-- other']);
  assert.deepEqual(sql.hunks[0].added, ['-- new comment']);
});

test('deleted and renamed files', () => {
  const files = parseUnifiedDiff(SAMPLE);
  assert.deepEqual([files[2].path, files[2].status], ['old.js', 'deleted']);
  assert.deepEqual([files[3].oldPath, files[3].path, files[3].hunks.length], ['src/before.js', 'src/after.js', 0]);
});

test('CRLF diff text parses like LF', () => {
  assert.deepEqual(parseUnifiedDiff(SAMPLE.replace(/\n/g, '\r\n')), parseUnifiedDiff(SAMPLE));
});

test('getDiff worktree includes tracked edits and untracked files', () => {
  const repo = makeRepo({ 'a.js': 'one\ntwo\n', '.gitignore': 'ignored.js\n' });
  repo.write('a.js', 'one\nTWO\n');
  repo.write('new.js', 'throw x;\n');
  repo.write('ignored.js', 'nope\n');
  const files = getDiff(repo.dir, { kind: 'worktree' });
  assert.deepEqual(files.map((f) => [f.path, f.status]), [['a.js', 'modified'], ['new.js', 'added']]);
  assert.deepEqual(files[1].hunks[0], { oldStart: 0, oldLines: 0, newStart: 1, newLines: 1, removed: [], added: ['throw x;'] });
});

test('getDiff staged and since scopes', () => {
  const repo = makeRepo({ 'a.js': 'one\n' });
  const first = repo.git('rev-parse', 'HEAD').trim();
  repo.write('a.js', 'one\ntwo\n');
  repo.git('add', 'a.js');
  assert.equal(getDiff(repo.dir, { kind: 'staged' })[0].hunks[0].added[0], 'two');
  repo.commit('second');
  assert.equal(getDiff(repo.dir, { kind: 'since', sha: first })[0].path, 'a.js');
});

test('getDiff works in a repository with no commit yet', () => {
  const repo = makeRepo();
  repo.write('a.js', 'x\n');
  assert.deepEqual(getDiff(repo.dir, { kind: 'worktree' }).map((f) => f.path), ['a.js']);
});

test('paths with spaces (trailing tab) and C-quoted paths are cleaned', () => {
  const text = 'diff --git a/my file.js b/my file.js\n--- a/my file.js\t\n+++ b/my file.js\t\n@@ -1 +1 @@\n-a\n+b\n'
    + 'diff --git "a/q\\"x.js" "b/q\\"x.js"\n--- "a/q\\"x.js"\n+++ "b/q\\"x.js"\n@@ -1 +1 @@\n-a\n+b\n'
    + 'diff --git "a/caf\\303\\251.js" "b/caf\\303\\251.js"\n--- "a/caf\\303\\251.js"\n+++ "b/caf\\303\\251.js"\n@@ -1 +1 @@\n-a\n+b\n';
  assert.deepEqual(parseUnifiedDiff(text).map((f) => f.path), ['my file.js', 'q"x.js', 'café.js']);
});

test('a CRLF-only rewrite of a tracked file produces no hunks', () => {
  const repo = makeRepo({ 'src/other.js': 'if (x) throw new Error();\nok();\n' });
  repo.write('src/other.js', 'if (x) throw new Error();\r\nok();\r\n');
  const files = getDiff(repo.dir, { kind: 'worktree' });
  assert.deepEqual(files.flatMap((f) => f.hunks), []);
});

test('untracked nested repos, directories and binary files do not break getDiff', () => {
  const repo = makeRepo({ 'a.js': 'one\n' });
  repo.write('nested/inner.js', 'x\n');
  repo.git('-C', 'nested', 'init', '-q');
  repo.write('img.bin', 'throw\u0000\u0001');
  repo.write('b.js', 'throw y;\n');
  assert.deepEqual(getDiff(repo.dir, { kind: 'worktree' }).map((f) => f.path), ['b.js']);
});
