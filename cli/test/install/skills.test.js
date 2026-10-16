import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run, VERSION } from '../../src/cli.js';
import { makeRepo } from '../helpers/repo.js';
import { fakeIo } from '../helpers/io.js';

const SKILLS = ['rulebook-edge-cases', 'rulebook-extract', 'rulebook-map', 'rulebook-publish', 'rulebook-sync'];
const home = () => fs.mkdtempSync(path.join(os.tmpdir(), 'rulebook-home-'));
const stamp = (h, target, skill) => path.join(h, target, 'skills', skill, '.rulebook-version');

test('rulebook skills --yes installs every skill with a stamp in both default targets', async () => {
  const h = home();
  const io = fakeIo(os.tmpdir(), { env: { RULEBOOK_HOME: h } });
  assert.equal(await run(['skills', '--yes'], io), 0);
  for (const target of ['.agents', '.claude']) {
    assert.deepEqual(fs.readdirSync(path.join(h, target, 'skills')).sort(), SKILLS);
    assert.equal(fs.readFileSync(stamp(h, target, 'rulebook-map'), 'utf8').trim(), VERSION);
    assert.ok(fs.existsSync(path.join(h, target, 'skills', 'rulebook-map', 'references', 'card-template.md')));
  }
  assert.match(io.out, /installed 10 skill copies/);
});

test('without --yes only the plan is printed', async () => {
  const h = home();
  const io = fakeIo(os.tmpdir(), { env: { RULEBOOK_HOME: h } });
  await run(['skills'], io);
  assert.match(io.out, /\+ install rulebook-map →/);
  assert.match(io.out, /re-run with --yes to apply/);
  assert.equal(fs.existsSync(path.join(h, '.agents')), false);
});

test('a skill installed by another channel (no stamp) is never overwritten', async () => {
  const h = home();
  const mine = path.join(h, '.agents', 'skills', 'rulebook-map');
  fs.mkdirSync(mine, { recursive: true });
  fs.writeFileSync(path.join(mine, 'SKILL.md'), 'mine');
  const io = fakeIo(os.tmpdir(), { env: { RULEBOOK_HOME: h } });
  await run(['skills', '--yes', '--target', path.join(h, '.agents', 'skills')], io);
  assert.equal(fs.readFileSync(path.join(mine, 'SKILL.md'), 'utf8'), 'mine');
  assert.match(io.err, /rulebook-map in .* is managed elsewhere \(no \.rulebook-version\), left untouched/);
});

test('update refreshes stamped copies from an older version', async () => {
  const h = home();
  const env = { RULEBOOK_HOME: h, RULEBOOK_NO_UPDATE_CHECK: '1' };
  await run(['skills', '--yes'], fakeIo(os.tmpdir(), { env }));
  const skill = path.join(h, '.claude', 'skills', 'rulebook-sync');
  fs.writeFileSync(path.join(skill, 'SKILL.md'), 'stale');
  fs.writeFileSync(path.join(skill, '.rulebook-version'), '0.0.1\n');
  const io = fakeIo(makeRepo({ 'a.txt': 'x' }).dir, { env });
  await run(['update'], io);
  assert.notEqual(fs.readFileSync(path.join(skill, 'SKILL.md'), 'utf8'), 'stale');
  assert.equal(fs.readFileSync(path.join(skill, '.rulebook-version'), 'utf8').trim(), VERSION);
  assert.match(io.out, /refreshed 1 skill copy/);
});
