// One version for the whole pack: cli/package.json, the Claude Code plugin manifests and the
// pinned CLI in the plugin hooks. `--check` fails on drift; `<version>` rewrites them all.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILES = {
  cli: 'cli/package.json',
  plugin: '.claude-plugin/plugin.json',
  marketplace: '.claude-plugin/marketplace.json',
  hooks: 'hooks/hooks.json',
};
const PIN = /rulebook-cli@(\d+\.\d+\.\d+)|--stamp (\d+\.\d+\.\d+)/g;

const readJson = (root, rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const writeJson = (root, rel, data) => fs.writeFileSync(path.join(root, rel), `${JSON.stringify(data, null, 2)}\n`);

export function readVersions(root) {
  const hooksText = fs.readFileSync(path.join(root, FILES.hooks), 'utf8');
  return {
    cli: readJson(root, FILES.cli).version,
    plugin: readJson(root, FILES.plugin).version,
    marketplace: readJson(root, FILES.marketplace).plugins.map((p) => p.version),
    hooks: [...hooksText.matchAll(PIN)].map((m) => m[1] ?? m[2]),
  };
}

export function check(root) {
  const v = readVersions(root);
  const problems = [];
  if (v.plugin !== v.cli) problems.push(`plugin ${v.plugin} != cli ${v.cli}`);
  for (const m of v.marketplace) if (m !== v.cli) problems.push(`marketplace ${m} != cli ${v.cli}`);
  for (const h of v.hooks) if (h !== v.cli) problems.push(`hooks.json pins ${h} != cli ${v.cli}`);
  if (!v.hooks.length) problems.push('hooks.json pins no version');
  return problems;
}

export function bump(root, version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`not a version: ${version}`);
  const cli = readJson(root, FILES.cli); cli.version = version; writeJson(root, FILES.cli, cli);
  const plugin = readJson(root, FILES.plugin); plugin.version = version; writeJson(root, FILES.plugin, plugin);
  const market = readJson(root, FILES.marketplace);
  for (const p of market.plugins) p.version = version;
  writeJson(root, FILES.marketplace, market);
  const hooksPath = path.join(root, FILES.hooks);
  fs.writeFileSync(hooksPath, fs.readFileSync(hooksPath, 'utf8')
    .replace(/rulebook-cli@\d+\.\d+\.\d+/g, `rulebook-cli@${version}`)
    .replace(/--stamp \d+\.\d+\.\d+/g, `--stamp ${version}`));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const arg = process.argv[2];
  if (arg === '--check') {
    const problems = check(root);
    if (problems.length) { console.error(`version drift:\n  ${problems.join('\n  ')}`); process.exit(1); }
    console.log(`all versions at ${readVersions(root).cli}`);
  } else if (arg) {
    bump(root, arg);
    console.log(`bumped to ${arg}`);
  } else {
    console.error('usage: versions.mjs --check | <version>');
    process.exit(1);
  }
}
