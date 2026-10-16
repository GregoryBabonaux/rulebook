import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export function makeRepo(files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rulebook-'));
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'test');
  git('config', 'core.autocrlf', 'false');
  const write = (rel, text) => {
    const p = path.join(dir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, text);
  };
  const commit = (msg = 'commit') => {
    git('add', '-A');
    git('commit', '-q', '-m', msg);
  };
  for (const [rel, text] of Object.entries(files)) write(rel, text);
  if (Object.keys(files).length) commit('init');
  return { dir, git, write, commit, read: (rel) => fs.readFileSync(path.join(dir, rel), 'utf8') };
}
