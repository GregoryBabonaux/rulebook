// prepack: copy skills/ into cli/skills/ so the npm package carries them (`rulebook skills`).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dest = path.join(root, 'cli', 'skills');
fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(path.join(root, 'skills'), dest, { recursive: true });
console.log(`bundled ${fs.readdirSync(dest).length} skills into cli/skills`);
