// prepack: copy skills/ (and README, LICENSE) into cli/ so the npm package carries them (`rulebook skills`).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dest = path.join(root, 'cli', 'skills');
fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(path.join(root, 'skills'), dest, { recursive: true });
for (const f of ['README.md', 'LICENSE']) fs.copyFileSync(path.join(root, f), path.join(root, 'cli', f));
console.log(`bundled ${fs.readdirSync(dest).length} skills into cli/skills`);
