import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { run, VERSION } from '../../src/cli.js';
import { makeRepo } from '../helpers/repo.js';
import { fakeIo } from '../helpers/io.js';
import { baseFiles } from '../helpers/fixture.js';

const BIN = 'node /opt/rulebook.js';

test('doctor reports a healthy installation', async () => {
  const repo = makeRepo(baseFiles());
  await run(['init', '--agents', 'claude', '--bin', BIN, '--yes'], fakeIo(repo.dir));
  await run(['index'], fakeIo(repo.dir));
  const io = fakeIo(repo.dir);
  assert.equal(await run(['doctor'], io), 0);
  assert.match(io.out, new RegExp(`✓ rulebook-cli ${VERSION.replace(/\./g, '\\.')}`));
  assert.match(io.out, /✓ format 1/);
  assert.match(io.out, /✓ 3 cards, all evidence resolvable/);
  assert.match(io.out, /✓ claude: hooks installed/);
  assert.match(io.out, /✓ pre-commit hook installed/);
  const quiet = fakeIo(repo.dir);
  await run(['doctor', '--quiet'], quiet);
  assert.equal(quiet.out, '');
});

test('doctor flags missing format, stale stamps, missing adapters and unresolved evidence', async () => {
  const files = baseFiles();
  files['.cursor/rules.md'] = 'x';
  const repo = makeRepo(files);
  await run(['init', '--agents', 'claude', '--bin', BIN, '--yes'], fakeIo(repo.dir));
  const settings = path.join(repo.dir, '.claude/settings.json');
  fs.writeFileSync(settings, fs.readFileSync(settings, 'utf8').replaceAll(`--stamp ${VERSION}`, '--stamp 0.0.1'));
  const cfgPath = path.join(repo.dir, 'rulebook/config.json');
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  delete cfg.formatVersion;
  fs.writeFileSync(cfgPath, JSON.stringify(cfg));
  fs.rmSync(path.join(repo.dir, 'tests/RefundTest.php'));
  const io = fakeIo(repo.dir);
  await run(['doctor', '--quiet'], io);
  assert.match(io.out, /! config\.json has no formatVersion \(expected 1\)/);
  assert.match(io.out, /! claude: hooks from rulebook 0\.0\.1 — run rulebook update/);
  assert.match(io.out, /! cursor: detected but no rulebook hooks — run rulebook init/);
  assert.match(io.out, /! 1 evidence anchor\(s\) unresolved — run rulebook index/);
});

test('doctor reports a format newer than supported, and runs outside a project', async () => {
  const repo = makeRepo({ 'rulebook/config.json': JSON.stringify({ formatVersion: 99 }) });
  const io = fakeIo(repo.dir);
  await run(['doctor', '--quiet'], io);
  assert.match(io.out, /! format 99 is newer than this CLI supports \(1\) — run: npx rulebook-cli@latest update/);
  const bare = fakeIo(makeRepo({ 'a.txt': 'x' }).dir);
  assert.equal(await run(['doctor', '--quiet'], bare), 0);
  assert.match(bare.out, /! no rulebook\/ folder/);
});

test('update refreshes installed adapters with the stored bin and prints skill channels', async () => {
  const repo = makeRepo(baseFiles());
  await run(['init', '--agents', 'claude,cursor', '--bin', BIN, '--yes'], fakeIo(repo.dir));
  const settings = path.join(repo.dir, '.claude/settings.json');
  fs.writeFileSync(settings, fs.readFileSync(settings, 'utf8').replaceAll(`--stamp ${VERSION}`, '--stamp 0.0.1'));
  const io = fakeIo(repo.dir);
  assert.equal(await run(['update'], io), 0);
  const json = JSON.parse(fs.readFileSync(settings, 'utf8'));
  assert.equal(json.hooks.PostToolUse.length, 1);
  assert.equal(json.hooks.PostToolUse[0].hooks[0].command, `${BIN} hook claude post-edit --stamp ${VERSION} || true`);
  assert.match(io.out, /updated for claude, cursor/);
  assert.match(io.out, /claude plugin update rulebook@rulebook/);
  assert.match(io.out, /npx skills update/);
});
