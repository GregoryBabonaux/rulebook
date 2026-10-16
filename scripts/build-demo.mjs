// Regenerates examples/demo/rulebook/rulebook.html with the CLI, in a throwaway git copy
// (the demo is not a repository of its own), at the date recorded in .published.json.
// tests/skills/demo.test.mjs checks the committed file matches what this produces.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const work = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rulebook-demo-')), 'rulebook');
fs.cpSync(path.join(root, 'examples/demo'), work, { recursive: true });
const sh = (cmd, args, env) => execFileSync(cmd, args, { cwd: work, stdio: 'pipe', env: { ...process.env, ...env } });
sh('git', ['init', '-q']);
sh('git', ['add', '-A']);
sh('git', ['-c', 'user.name=demo', '-c', 'user.email=demo@example.com', 'commit', '-qm', 'demo']);
const { current } = JSON.parse(fs.readFileSync(path.join(work, 'rulebook/.published.json'), 'utf8'));
const epoch = String(Date.parse(`${current}T12:00:00Z`) / 1000);
sh(process.execPath, [path.join(root, 'cli/bin/rulebook.js'), 'build', '--since', '2026-09-01'], { SOURCE_DATE_EPOCH: epoch });
fs.copyFileSync(path.join(work, 'rulebook/rulebook.html'), path.join(root, 'examples/demo/rulebook/rulebook.html'));
fs.rmSync(path.dirname(work), { recursive: true, force: true });
console.log('examples/demo/rulebook/rulebook.html rebuilt');
