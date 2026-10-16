import fs from 'node:fs';
import path from 'node:path';
import { git } from '../git.js';

const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const HUNK = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;
const MAX_UNTRACKED_BYTES = 1024 * 1024;

export function parseUnifiedDiff(text) {
  const files = [];
  let file = null;
  let hunk = null;
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (line.startsWith('diff --git ')) {
      file = { path: null, oldPath: null, status: 'modified', hunks: [] };
      files.push(file);
      hunk = null;
      continue;
    }
    if (!file) continue;
    if (hunk === null) {
      if (line.startsWith('new file mode')) { file.status = 'added'; continue; }
      if (line.startsWith('deleted file mode')) { file.status = 'deleted'; continue; }
      if (line.startsWith('rename from ')) { file.oldPath = line.slice('rename from '.length); continue; }
      if (line.startsWith('rename to ')) { file.path = line.slice('rename to '.length); continue; }
      if (line.startsWith('--- ')) {
        const p = line.slice(4);
        if (p !== '/dev/null') file.oldPath ??= p.replace(/^a\//, '');
        continue;
      }
      if (line.startsWith('+++ ')) {
        const p = line.slice(4);
        if (p !== '/dev/null') file.path = p.replace(/^b\//, '');
        continue;
      }
    }
    const m = line.match(HUNK);
    if (m) {
      hunk = {
        oldStart: +m[1], oldLines: m[2] === undefined ? 1 : +m[2],
        newStart: +m[3], newLines: m[4] === undefined ? 1 : +m[4],
        removed: [], added: [],
      };
      file.hunks.push(hunk);
      continue;
    }
    if (!hunk) continue;
    if (line.startsWith('+')) hunk.added.push(line.slice(1));
    else if (line.startsWith('-')) hunk.removed.push(line.slice(1));
  }
  for (const f of files) {
    f.path ??= f.oldPath;
    f.oldPath ??= f.path;
  }
  return files.filter((f) => f.path);
}

function untrackedAsAdded(root) {
  const out = git(root, ['-c', 'core.quotepath=false', 'ls-files', '--others', '--exclude-standard']) ?? '';
  return out.split('\n').filter(Boolean).flatMap((p) => {
    const abs = path.join(root, p);
    if (fs.statSync(abs).size > MAX_UNTRACKED_BYTES) return [];
    const lines = fs.readFileSync(abs, 'utf8').replace(/\r\n?/g, '\n').split('\n');
    if (lines.at(-1) === '') lines.pop();
    return [{ path: p, oldPath: p, status: 'added', hunks: [{ oldStart: 0, oldLines: 0, newStart: 1, newLines: lines.length, removed: [], added: lines }] }];
  });
}

export function getDiff(root, scope = { kind: 'worktree' }) {
  const base = ['-c', 'core.quotepath=false', 'diff', '-U0', '--no-color', '--no-ext-diff', '-M'];
  let args;
  if (scope.kind === 'staged') args = [...base, '--cached'];
  else if (scope.kind === 'since') args = [...base, scope.sha];
  else args = [...base, git(root, ['rev-parse', '--verify', '-q', 'HEAD']) ? 'HEAD' : EMPTY_TREE];
  const files = parseUnifiedDiff(git(root, args) ?? '');
  if (scope.kind === 'worktree') files.push(...untrackedAsAdded(root));
  return files;
}
