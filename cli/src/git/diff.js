import fs from 'node:fs';
import path from 'node:path';
import { git } from '../git.js';

const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const HUNK = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;
const MAX_UNTRACKED_BYTES = 1024 * 1024;

const C_ESCAPES = { n: 10, t: 9, r: 13, '"': 34, '\\': 92, a: 7, b: 8, f: 12, v: 11 };

// git C-quotes paths with special characters: "a/caf\303\251.js"
function unquote(p) {
  if (!(p.length > 1 && p.startsWith('"') && p.endsWith('"'))) return p;
  const s = p.slice(1, -1);
  const bytes = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '\\') { bytes.push(...Buffer.from(s[i], 'utf8')); continue; }
    const n = s[++i];
    if (/[0-7]/.test(n)) { bytes.push(parseInt(s.slice(i, i + 3), 8)); i += 2; continue; }
    bytes.push(C_ESCAPES[n] ?? n.charCodeAt(0));
  }
  return Buffer.from(bytes).toString('utf8');
}

// git appends a TAB to ---/+++ paths that contain spaces
function cleanPath(raw, side) {
  const p = unquote(raw.replace(/\t$/, ''));
  return p.startsWith(`${side}/`) ? p.slice(2) : p;
}

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
      if (line.startsWith('rename from ')) { file.oldPath = unquote(line.slice('rename from '.length)); continue; }
      if (line.startsWith('rename to ')) { file.path = unquote(line.slice('rename to '.length)); continue; }
      if (line.startsWith('--- ')) {
        const p = line.slice(4);
        if (p !== '/dev/null') file.oldPath ??= cleanPath(p, 'a');
        continue;
      }
      if (line.startsWith('+++ ')) {
        const p = line.slice(4);
        if (p !== '/dev/null') file.path = cleanPath(p, 'b');
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
  return out.split('\n').filter((p) => p && !p.endsWith('/')).flatMap((p) => {
    let buf;
    try {
      const abs = path.join(root, p);
      const stat = fs.statSync(abs);
      if (!stat.isFile() || stat.size > MAX_UNTRACKED_BYTES) return [];
      buf = fs.readFileSync(abs);
    } catch {
      return [];
    }
    if (buf.subarray(0, 8000).includes(0)) return [];
    const lines = buf.toString('utf8').replace(/\r\n?/g, '\n').split('\n');
    if (lines.at(-1) === '') lines.pop();
    return [{ path: p, oldPath: p, status: 'added', hunks: [{ oldStart: 0, oldLines: 0, newStart: 1, newLines: lines.length, removed: [], added: lines }] }];
  });
}

export function getDiff(root, scope = { kind: 'worktree' }) {
  const base = ['-c', 'core.quotepath=false', 'diff', '-U0', '--no-color', '--no-ext-diff', '--ignore-cr-at-eol', '-M'];
  let args;
  if (scope.kind === 'staged') args = [...base, '--cached'];
  else if (scope.kind === 'since') args = [...base, scope.sha];
  else args = [...base, git(root, ['rev-parse', '--verify', '-q', 'HEAD']) ? 'HEAD' : EMPTY_TREE];
  const files = parseUnifiedDiff(git(root, args) ?? '');
  if (scope.kind === 'worktree') files.push(...untrackedAsAdded(root));
  return files;
}
