import fs from 'node:fs';
import path from 'node:path';
import { git } from '../git.js';
import { IGNORED_PATH } from '../check/patterns.js';

const MAX_BYTES = 512 * 1024;

// Text files of the repository (tracked and untracked, honouring .gitignore), minus docs,
// agent folders, dependencies, lockfiles, binaries and very large files. Paths use "/".
export function repoTextFiles(root) {
  const out = git(root, ['ls-files', '-co', '--exclude-standard', '-z']) ?? '';
  const files = [];
  for (const rel of out.split('\0')) {
    if (!rel || IGNORED_PATH.test(rel) || rel.startsWith('rulebook/')) continue;
    const abs = path.join(root, rel);
    let stat;
    try { stat = fs.statSync(abs); } catch { continue; }
    if (!stat.isFile() || stat.size > MAX_BYTES) continue;
    const text = fs.readFileSync(abs, 'utf8');
    if (text.includes('\0')) continue;
    files.push({ path: rel.replace(/\\/g, '/'), text });
  }
  return files;
}
