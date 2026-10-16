import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { formatHookOutput } from '../../src/hook/formats.js';
import { run } from '../../src/cli.js';
import { makeRepo } from '../helpers/repo.js';
import { fakeIo } from '../helpers/io.js';
import { baseFiles, POLICY_SRC } from '../helpers/fixture.js';

const L = ['rulebook: PAY-R012 may have changed (OrderPolicy.php) → rulebook/inbox.md'];

test('formats per agent', () => {
  assert.equal(formatHookOutput('claude', 'post-edit', []), '');
  assert.deepEqual(JSON.parse(formatHookOutput('claude', 'post-edit', L)), { hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: L[0] } });
  assert.deepEqual(JSON.parse(formatHookOutput('claude', 'stop', L)), { systemMessage: L[0] });
  assert.deepEqual(JSON.parse(formatHookOutput('codex', 'post-edit', L)), { hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: L[0] } });
  assert.deepEqual(JSON.parse(formatHookOutput('gemini', 'post-edit', L)), { hookSpecificOutput: { hookEventName: 'AfterTool', additionalContext: L[0] } });
  assert.deepEqual(JSON.parse(formatHookOutput('copilot', 'post-edit', L)), { additionalContext: L[0] });
  assert.deepEqual(JSON.parse(formatHookOutput('cursor', 'post-edit', L)), { additional_context: L[0] });
  assert.deepEqual(JSON.parse(formatHookOutput('vibe', 'post-edit', L)), { hook_specific_output: { additional_context: L[0] } });
  assert.equal(formatHookOutput('git', 'pre-commit', [...L, 'x']), `${L[0]}\nx`);
});

async function changedRepo() {
  const repo = makeRepo(baseFiles());
  await run(['index'], fakeIo(repo.dir));
  repo.commit('index');
  repo.write('app/Policies/OrderPolicy.php', POLICY_SRC.replace('<= 14', '<= 7'));
  return repo;
}

test('hook uses the payload cwd and answers in the agent format, once', async () => {
  const repo = await changedRepo();
  const io = fakeIo(os.tmpdir(), { stdin: JSON.stringify({ cwd: repo.dir, tool_name: 'Edit' }) });
  assert.equal(await run(['hook', 'claude', 'post-edit', '--stamp', '0.1.0'], io), 0);
  assert.equal(JSON.parse(io.out).hookSpecificOutput.additionalContext, L[0]);
  const again = fakeIo(os.tmpdir(), { stdin: JSON.stringify({ cwd: repo.dir }) });
  await run(['hook', 'claude', 'stop'], again);
  assert.equal(again.out, '');
});

test('hook falls back to io.cwd on empty, non-JSON or cwd-less stdin', async () => {
  for (const stdin of ['', 'not json', '{"tool":"x"}']) {
    const repo = await changedRepo();
    const io = fakeIo(repo.dir, { stdin });
    assert.equal(await run(['hook', 'cursor', 'post-edit'], io), 0);
    assert.match(io.out, /additional_context/);
  }
});

test('hook never fails: corrupt index, no repo, unknown agent', async () => {
  const repo = await changedRepo();
  fs.writeFileSync(path.join(repo.dir, 'rulebook/.index.json'), '{ nope');
  const io = fakeIo(repo.dir, { stdin: '' });
  assert.equal(await run(['hook', 'claude', 'post-edit'], io), 0);
  assert.equal(io.out + io.err, '');
  const dbg = fakeIo(repo.dir, { stdin: '', env: { RULEBOOK_DEBUG: '1', RULEBOOK_NO_UPDATE_CHECK: '1' } });
  await run(['hook', 'claude', 'post-edit'], dbg);
  assert.match(dbg.err, /hook skipped/);
  const none = fakeIo(fs.mkdtempSync(path.join(os.tmpdir(), 'rulebook-x-')), { stdin: '' });
  assert.equal(await run(['hook', 'nobody', 'whatever'], none), 0);
  assert.equal(none.out, '');
});

test('unknown agent prints plain text lines', async () => {
  const repo = await changedRepo();
  const io = fakeIo(repo.dir, { stdin: '' });
  await run(['hook', 'kiro', 'post-edit'], io);
  assert.equal(io.out, `${L[0]}\n`);
});
