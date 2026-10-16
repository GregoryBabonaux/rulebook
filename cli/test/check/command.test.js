import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run } from '../../src/cli.js';
import { fakeIo } from '../helpers/io.js';
import { makeRepo } from '../helpers/repo.js';
import { baseFiles, POLICY_SRC } from '../helpers/fixture.js';

async function indexedRepo() {
  const repo = makeRepo(baseFiles());
  await run(['index'], fakeIo(repo.dir));
  repo.commit('index');
  return repo;
}
const check = async (repo, args = []) => {
  const io = fakeIo(repo.dir);
  const code = await run(['check', ...args], io);
  return { code, out: io.out, err: io.err };
};
const POLICY = 'app/Policies/OrderPolicy.php';

test('changing a rule prints one notice and writes the inbox', async () => {
  const repo = await indexedRepo();
  repo.write(POLICY, POLICY_SRC.replace('<= 14', '<= 7'));
  const r = await check(repo);
  assert.equal(r.code, 0);
  assert.equal(r.out, 'rulebook: PAY-R012 may have changed (OrderPolicy.php) → rulebook/inbox.md\n');
  assert.match(repo.read('rulebook/inbox.md'), /- \[ \] 2026-10-15 14:02 · modified\? · PAY-R012 · app\/Policies\/OrderPolicy\.php:9-13 · key [0-9a-f]{12}/);
});

test('repeated checks during a session stay quiet and never duplicate entries', async () => {
  const repo = await indexedRepo();
  repo.write(POLICY, POLICY_SRC.replace('<= 14', '<= 7'));
  await check(repo);
  repo.write(POLICY, POLICY_SRC.replace('<= 14', '<= 5'));
  const second = await check(repo);
  assert.equal(second.out, '');
  assert.equal(repo.read('rulebook/inbox.md').match(/^- \[ \]/gm).length, 1);
});

test('line drift and CRLF-only rewrites report nothing', async () => {
  const repo = await indexedRepo();
  repo.write(POLICY, `// moved\n// down\n${POLICY_SRC}`);
  assert.equal((await check(repo)).out, '');
  repo.write(POLICY, POLICY_SRC.replace(/\n/g, '\r\n'));
  assert.equal((await check(repo)).out, '');
  assert.equal(fs.existsSync(path.join(repo.dir, 'rulebook/inbox.md')), false);
});

test('removing the rule reports removed?', async () => {
  const repo = await indexedRepo();
  repo.write(POLICY, POLICY_SRC.split('\n').slice(0, 7).concat(['}', '']).join('\n'));
  assert.equal((await check(repo)).out, 'rulebook: PAY-R012 may have been removed (OrderPolicy.php) → rulebook/inbox.md\n');
});

test('an untracked file with a guard reports a possible new rule', async () => {
  const repo = await indexedRepo();
  repo.write('app/Services/Coupon.php', '<?php\n\nif ($coupon->expired()) throw new Gone();\n');
  assert.equal((await check(repo)).out, 'rulebook: possible new rule in app/Services/Coupon.php:1 → rulebook/inbox.md\n');
});

test('--staged reads the staged content', async () => {
  const repo = await indexedRepo();
  repo.write(POLICY, POLICY_SRC.replace('<= 14', '<= 7'));
  repo.git('add', POLICY);
  repo.write(POLICY, POLICY_SRC);
  assert.match((await check(repo, ['--staged'])).out, /PAY-R012 may have changed/);
});

test('--since compares with a past commit', async () => {
  const repo = await indexedRepo();
  const base = repo.git('rev-parse', 'HEAD').trim();
  repo.write(POLICY, POLICY_SRC.replace('<= 14', '<= 7'));
  repo.commit('shorten window');
  assert.match((await check(repo, ['--since', base])).out, /PAY-R012 may have changed/);
});

test('--format json and --strict', async () => {
  const repo = await indexedRepo();
  repo.write(POLICY, POLICY_SRC.replace('<= 14', '<= 7'));
  const r = await check(repo, ['--format', 'json', '--strict']);
  assert.equal(r.code, 1);
  const payload = JSON.parse(r.out);
  assert.equal(payload.detections[0].rule, 'PAY-R012');
  assert.equal(payload.added.length, 1);
});

test('hostile environments: no git, no rulebook, corrupt index -> exit 0', async () => {
  const nogit = fakeIo(fs.mkdtempSync(path.join(os.tmpdir(), 'rulebook-nogit-')));
  assert.equal(await run(['check'], nogit), 0);
  assert.equal(nogit.out + nogit.err, '');

  const bare = makeRepo({ 'a.js': 'throw x;\n' });
  assert.equal((await check(bare)).code, 0);

  const repo = await indexedRepo();
  fs.writeFileSync(path.join(repo.dir, 'rulebook/.index.json'), '{ not json');
  repo.write(POLICY, POLICY_SRC.replace('<= 14', '<= 7'));
  const r = await check(repo);
  assert.equal(r.code, 0);
  assert.match(r.err, /^rulebook: check skipped \(/);
  assert.equal((await check(repo, ['--strict'])).code, 2);
});

test('a blank line added inside a rule range is not a change', async () => {
  const repo = await indexedRepo();
  repo.write(POLICY, POLICY_SRC.replace('    {\n        return $order', '    {\n\n        return $order'));
  assert.equal((await check(repo)).out, '');
});

test('two distinct new rules in one file give two entries; unrelated edits add nothing', async () => {
  const repo = await indexedRepo();
  const svc = 'app/Services/Coupon.php';
  repo.write(svc, '<?php\nfunction a() {\n  return 1;\n}\nfunction b() {\n  return 2;\n}\n');
  repo.commit('service');
  repo.write(svc, '<?php\nfunction a() {\n  if ($x) throw new Gone();\n  return 1;\n}\nfunction b() {\n  return 2;\n}\n');
  assert.match((await check(repo)).out, /possible new rule in app\/Services\/Coupon\.php:3/);
  repo.write(svc, '<?php\nfunction a() {\n  if ($x) throw new Gone();\n  return 1;\n}\nfunction b() {\n  abort_if($y, 403);\n  return 2;\n}\n');
  assert.match((await check(repo)).out, /possible new rule in app\/Services\/Coupon\.php:7/);
  repo.write(svc, '<?php\nfunction a() {\n  if ($x) throw new Gone();\n  return 10;\n}\nfunction b() {\n  abort_if($y, 403);\n  return 2;\n}\n');
  assert.equal((await check(repo)).out, '');
  assert.equal(repo.read('rulebook/inbox.md').match(/^- \[ \]/gm).length, 2);
});

test('a ticked detection does not come back on the next edit of the same file', async () => {
  const repo = await indexedRepo();
  repo.write('app/Services/Coupon.php', '<?php\n\nif ($coupon->expired()) throw new Gone();\n');
  await check(repo);
  const inbox = path.join(repo.dir, 'rulebook/inbox.md');
  fs.writeFileSync(inbox, fs.readFileSync(inbox, 'utf8').replace('- [ ]', '- [x]'));
  repo.write('app/Services/Coupon.php', '<?php\n// tidy\nif ($coupon->expired()) throw new Gone();\n');
  assert.equal((await check(repo)).out, '');
});
