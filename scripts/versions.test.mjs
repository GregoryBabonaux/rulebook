import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readVersions, check, bump } from './versions.mjs';

function tree(cli = '0.1.0', plugin = '0.1.0') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rulebook-ver-'));
  const write = (rel, data) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), JSON.stringify(data, null, 2)); };
  write('cli/package.json', { name: 'rulebook-cli', version: cli });
  write('.claude-plugin/plugin.json', { name: 'rulebook', version: plugin });
  write('.claude-plugin/marketplace.json', { name: 'rulebook', plugins: [{ name: 'rulebook', source: './', version: plugin }] });
  write('hooks/hooks.json', { hooks: { Stop: [{ hooks: [{ type: 'command', command: `npx --yes rulebook-cli@${cli} hook claude stop --stamp ${cli} || true` }] }] } });
  return root;
}

test('readVersions finds every version, hooks included', () => {
  assert.deepEqual(readVersions(tree()), { cli: '0.1.0', plugin: '0.1.0', marketplace: ['0.1.0'], hooks: ['0.1.0', '0.1.0'] });
});

test('check reports drift and bump aligns everything', () => {
  const root = tree('0.1.0', '0.2.0');
  assert.match(check(root).join('\n'), /plugin 0\.2\.0 != cli 0\.1\.0/);
  bump(root, '0.3.0');
  assert.deepEqual(check(root), []);
  assert.deepEqual(readVersions(root), { cli: '0.3.0', plugin: '0.3.0', marketplace: ['0.3.0'], hooks: ['0.3.0', '0.3.0'] });
});
