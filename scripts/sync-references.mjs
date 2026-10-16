// Copies references/ into every skills/<name>/references/ (the spec's option (a):
// each skill stays installable on its own). `--check` fails when a copy drifted.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const skillDirs = (root) => {
  const dir = path.join(root, 'skills');
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((d) => fs.existsSync(path.join(dir, d, 'SKILL.md'))) : [];
};
const listFiles = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => fs.statSync(path.join(dir, f)).isFile()).sort() : []);

export function sync(root) {
  const src = path.join(root, 'references');
  for (const skill of skillDirs(root)) {
    const dest = path.join(root, 'skills', skill, 'references');
    fs.rmSync(dest, { recursive: true, force: true });
    fs.mkdirSync(dest, { recursive: true });
    for (const f of listFiles(src)) fs.copyFileSync(path.join(src, f), path.join(dest, f));
  }
}

export function check(root) {
  const src = path.join(root, 'references');
  const expected = listFiles(src);
  return skillDirs(root).filter((skill) => {
    const dest = path.join(root, 'skills', skill, 'references');
    const actual = listFiles(dest);
    if (actual.join('\n') !== expected.join('\n')) return true;
    return expected.some((f) => !fs.readFileSync(path.join(src, f)).equals(fs.readFileSync(path.join(dest, f))));
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  if (process.argv.includes('--check')) {
    const drifted = check(root);
    if (drifted.length) { console.error(`references out of sync in: ${drifted.join(', ')} — run npm run sync`); process.exit(1); }
    console.log('references in sync');
  } else {
    sync(root);
    console.log(`references copied into ${skillDirs(root).length} skill(s)`);
  }
}
