import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkProject } from '../../src/check/run.js';
import { parseOptions, run } from '../../src/cli.js';
import { makeRepo } from '../helpers/repo.js';
import { fakeIo } from '../helpers/io.js';
import { baseFiles, POLICY_SRC } from '../helpers/fixture.js';

test('checkProject returns detections, added entries and notice lines', async () => {
  const repo = makeRepo(baseFiles());
  await run(['index'], fakeIo(repo.dir));
  repo.commit('index');
  repo.write('app/Policies/OrderPolicy.php', POLICY_SRC.replace('<= 14', '<= 7'));
  const r = checkProject(repo.dir, { now: new Date(2026, 9, 15, 14, 2) });
  assert.equal(r.detections[0].rule, 'PAY-R012');
  assert.equal(r.added.length, 1);
  assert.deepEqual(r.notices, ['rulebook: PAY-R012 may have changed (OrderPolicy.php) → rulebook/inbox.md']);
  assert.equal(checkProject(repo.dir).added.length, 0);
});

test('checkProject returns null outside a rulebook project', () => {
  assert.equal(checkProject(fs.mkdtempSync(path.join(os.tmpdir(), 'rulebook-none-'))), null);
});

test('parseOptions understands install flags', () => {
  const o = parseOptions(['--agents', 'claude,codex', '--yes', '--dry-run', '--bin', 'node x.js', '--quiet']);
  assert.deepEqual([o.agents, o.yes, o.dryRun, o.bin, o.quiet], [['claude', 'codex'], true, true, 'node x.js', true]);
  assert.deepEqual([parseOptions([]).agents, parseOptions([]).yes, parseOptions([]).bin], [null, false, null]);
});
