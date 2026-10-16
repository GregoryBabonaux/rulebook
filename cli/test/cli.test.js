import test from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../src/cli.js';
import { fakeIo } from './helpers/io.js';

test('--version prints the package version', async () => {
  const io = fakeIo(process.cwd());
  assert.equal(await run(['--version'], io), 0);
  assert.equal(io.out, '0.1.0\n');
});

test('unknown command fails with the command list', async () => {
  const io = fakeIo(process.cwd());
  assert.equal(await run(['frobnicate'], io), 1);
  assert.match(io.err, /unknown command "frobnicate"/);
  assert.match(io.err, /index, scan, check, build, hook, init, doctor, update/);
});

test('--help lists every command with a one-line description', async () => {
  const io = fakeIo(process.cwd());
  assert.equal(await run(['--help'], io), 0);
  for (const cmd of ['index', 'scan', 'check', 'build', 'hook', 'init', 'doctor', 'update', 'skills']) {
    assert.match(io.out, new RegExp(`^  ${cmd} `, 'm'));
  }
});
