import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFile, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { updateNotice, cacheFile, readCache, writeCache, isNewer } from '../../src/update/notice.js';
import { run, VERSION } from '../../src/cli.js';
import { fakeIo } from '../helpers/io.js';
import { makeRepo } from '../helpers/repo.js';
import { baseFiles } from '../helpers/fixture.js';

const tmpEnv = () => ({ RULEBOOK_CACHE_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'rulebook-cache-')) });
const NOW = new Date('2026-10-16T09:00:00Z');
const WORKER = fileURLToPath(new URL('../../src/update/worker.js', import.meta.url));

test('isNewer compares semver triples', () => {
  assert.ok(isNewer('0.2.0', '0.1.9'));
  assert.ok(isNewer('1.0.0', '0.9.9'));
  assert.ok(!isNewer('0.1.0', '0.1.0'));
  assert.ok(!isNewer('0.1.0', '0.2.0'));
});

test('disabled without env, with CI, or with RULEBOOK_NO_UPDATE_CHECK', () => {
  const spawned = [];
  const spawnCheck = (...a) => spawned.push(a);
  assert.equal(updateNotice({ env: undefined, now: NOW, current: '0.1.0', spawnCheck }), null);
  assert.equal(updateNotice({ env: { ...tmpEnv(), CI: 'true' }, now: NOW, current: '0.1.0', spawnCheck }), null);
  assert.equal(updateNotice({ env: { ...tmpEnv(), RULEBOOK_NO_UPDATE_CHECK: '1' }, now: NOW, current: '0.1.0', spawnCheck }), null);
  assert.equal(spawned.length, 0);
});

test('a stale cache spawns one background check; a fresh one does not', () => {
  const env = tmpEnv();
  const spawned = [];
  const spawnCheck = (...a) => spawned.push(a);
  updateNotice({ env, now: NOW, current: '0.1.0', spawnCheck });
  updateNotice({ env, now: new Date(NOW.getTime() + 3600e3), current: '0.1.0', spawnCheck });
  assert.equal(spawned.length, 1);
  assert.equal(spawned[0][0], cacheFile(env));
  updateNotice({ env, now: new Date(NOW.getTime() + 25 * 3600e3), current: '0.1.0', spawnCheck });
  assert.equal(spawned.length, 2);
});

test('a newer cached version is announced once per day', () => {
  const env = tmpEnv();
  writeCache(cacheFile(env), { checkedAt: NOW.getTime(), latest: '0.4.0' });
  const args = { env, now: NOW, current: '0.1.0', spawnCheck: () => {} };
  assert.equal(updateNotice(args), 'rulebook 0.4.0 available — npx rulebook-cli@latest update');
  assert.equal(updateNotice(args), null);
  assert.equal(updateNotice({ ...args, now: new Date(NOW.getTime() + 24 * 3600e3) }), 'rulebook 0.4.0 available — npx rulebook-cli@latest update');
});

test('a corrupt cache file is ignored', () => {
  const env = tmpEnv();
  fs.writeFileSync(cacheFile(env), '{ nope');
  assert.deepEqual(readCache(cacheFile(env)), {});
  assert.equal(updateNotice({ env, now: NOW, current: '0.1.0', spawnCheck: () => {} }), null);
});

test('the worker fetches the latest version into the cache', async () => {
  const server = http.createServer((req, res) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ version: '9.9.9' })); });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const env = tmpEnv();
  try {
    await new Promise((resolve, reject) => {
      execFile(process.execPath, [WORKER, cacheFile(env), `http://127.0.0.1:${server.address().port}/`], (err) => (err ? reject(err) : resolve()));
    });
  } finally {
    server.close();
  }
  assert.equal(readCache(cacheFile(env)).latest, '9.9.9');
});

test('the worker gives up silently when the registry is unreachable', () => {
  const env = tmpEnv();
  execFileSync(process.execPath, [WORKER, cacheFile(env), 'http://127.0.0.1:9/']);
  assert.equal(readCache(cacheFile(env)).latest, undefined);
});

test('check prints the notice after its notices', async () => {
  const repo = makeRepo(baseFiles());
  const env = tmpEnv();
  writeCache(cacheFile(env), { checkedAt: Date.now(), latest: '99.0.0' });
  const io = fakeIo(repo.dir, { env });
  await run(['check'], io);
  assert.equal(io.out, 'rulebook 99.0.0 available — npx rulebook-cli@latest update\n');
  assert.ok(isNewer('99.0.0', VERSION));
});
