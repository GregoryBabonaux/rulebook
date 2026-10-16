// Creates a throwaway git workspace for a skill scenario.
// Usage: node tests/skills/workspace.mjs <dest> [--golden] [--index]
//   --golden  copy the golden rulebook into <dest>/rulebook
//   --index   also run `rulebook index` and commit, so `rulebook check` has a baseline
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const [dest, ...flags] = process.argv.slice(2);
if (!dest) { console.error('usage: workspace.mjs <dest> [--golden] [--index]'); process.exit(1); }
fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(path.join(here, 'shop/app'), dest, { recursive: true });
if (flags.includes('--golden')) fs.cpSync(path.join(here, 'shop/golden'), path.join(dest, 'rulebook'), { recursive: true });
const git = (...args) => execFileSync('git', args, { cwd: dest, stdio: 'ignore' });
git('init', '-q', '-b', 'main');
git('config', 'user.email', 'eval@example.com');
git('config', 'user.name', 'eval');
git('config', 'core.autocrlf', 'false');
if (flags.includes('--index')) execFileSync(process.execPath, [path.join(here, '../../cli/bin/rulebook.js'), 'index'], { cwd: dest, stdio: 'ignore' });
git('add', '-A');
git('commit', '-q', '-m', 'fixture');
console.log(dest);
