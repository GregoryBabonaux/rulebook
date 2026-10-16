import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// The committed demo must be exactly what `rulebook build` produces from its cards: the HTML is
// never hand-written. The build runs in a throwaway copy so the repository is left untouched.
test('the committed demo document is exactly what rulebook build produces', () => {
  // the project name is the folder name: keep the demo's own
  const work = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rulebook-demo-')), 'rulebook');
  fs.cpSync(path.join(root, 'examples/demo'), work, { recursive: true });
  const sh = (cmd, args) => execFileSync(cmd, args, { cwd: work, stdio: 'pipe' });
  sh('git', ['init', '-q']);
  sh('git', ['add', '-A']);
  sh('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'demo']);
  const committed = fs.readFileSync(path.join(work, 'rulebook/rulebook.html'), 'utf8');
  const { current } = JSON.parse(fs.readFileSync(path.join(work, 'rulebook/.published.json'), 'utf8'));
  const epoch = String(Date.parse(`${current}T12:00:00Z`) / 1000);
  execFileSync(process.execPath, [path.join(root, 'cli/bin/rulebook.js'), 'build', '--since', '2026-09-01'], { cwd: work, env: { ...process.env, SOURCE_DATE_EPOCH: epoch } });
  const built = fs.readFileSync(path.join(work, 'rulebook/rulebook.html'), 'utf8');
  // the commit sha is the only thing that legitimately differs between two builds of the same cards
  const strip = (s) => { s = s.replace(/\r\n/g, '\n'); const sha = s.match(/class="hero-meta">[^<]* · ([0-9a-f]{7,})</)?.[1]; return sha ? s.split(sha).join('SHA') : s; };
  assert.equal(strip(built), strip(committed));
  fs.rmSync(work, { recursive: true, force: true });
});
