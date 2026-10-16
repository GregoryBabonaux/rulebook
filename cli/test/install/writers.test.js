import test from 'node:test';
import assert from 'node:assert/strict';
import { upsertBlock, isOurs, mergeNestedHooks, mergeFlatHooks } from '../../src/install/writers.js';

const ours = (agent, event) => (c) => isOurs(c, agent, event);
const CMD1 = 'npx --yes rulebook-cli@0 hook claude post-edit --stamp 0.1.0';
const CMD2 = 'npx --yes rulebook-cli@0 hook claude post-edit --stamp 0.2.0';

test('upsertBlock appends then replaces between markers, keeping user content', () => {
  const a = upsertBlock('# Agents\n\nBe nice.\n', '<!-- s -->', '<!-- e -->', 'one');
  assert.equal(a, '# Agents\n\nBe nice.\n\n<!-- s -->\none\n<!-- e -->\n');
  const b = upsertBlock(a, '<!-- s -->', '<!-- e -->', 'two');
  assert.equal(b, '# Agents\n\nBe nice.\n\n<!-- s -->\ntwo\n<!-- e -->\n');
  assert.equal(upsertBlock('', '<!-- s -->', '<!-- e -->', 'x'), '<!-- s -->\nx\n<!-- e -->\n');
});

test('isOurs recognises our hook commands only', () => {
  assert.ok(isOurs(CMD1, 'claude', 'post-edit'));
  assert.ok(isOurs('node E:/x/rulebook/cli/bin/rulebook.js hook claude post-edit', 'claude', 'post-edit'));
  assert.ok(!isOurs(CMD1, 'claude', 'stop'));
  assert.ok(!isOurs('prettier --write', 'claude', 'post-edit'));
});

test('mergeNestedHooks keeps unrelated keys and hooks, then replaces ours on re-run', () => {
  const user = {
    permissions: { allow: ['Bash(ls)'] },
    env: { A: '1' },
    hooks: { PostToolUse: [{ matcher: 'Write', hooks: [{ type: 'command', command: 'prettier --write' }] }] },
  };
  const once = mergeNestedHooks(user, 'PostToolUse', 'Edit|Write|MultiEdit', CMD1, ours('claude', 'post-edit'));
  assert.deepEqual(once.permissions, user.permissions);
  assert.deepEqual(once.env, user.env);
  assert.equal(once.hooks.PostToolUse.length, 2);
  assert.deepEqual(once.hooks.PostToolUse[1], { matcher: 'Edit|Write|MultiEdit', hooks: [{ type: 'command', command: CMD1 }] });
  const twice = mergeNestedHooks(once, 'PostToolUse', 'Edit|Write|MultiEdit', CMD2, ours('claude', 'post-edit'));
  assert.equal(twice.hooks.PostToolUse.length, 2);
  assert.equal(twice.hooks.PostToolUse[1].hooks[0].command, CMD2);
  assert.equal(user.hooks.PostToolUse.length, 1, 'input not mutated');
  const stop = mergeNestedHooks({}, 'Stop', null, 'x hook claude stop', ours('claude', 'stop'));
  assert.deepEqual(stop, { hooks: { Stop: [{ hooks: [{ type: 'command', command: 'x hook claude stop' }] }] } });
});

test('mergeFlatHooks adds version, appends, then replaces ours', () => {
  const entry1 = { command: 'r hook cursor post-edit --stamp 0.1.0' };
  const entry2 = { command: 'r hook cursor post-edit --stamp 0.2.0' };
  const user = { version: 1, hooks: { postToolUse: [{ command: './fmt.sh' }] } };
  const once = mergeFlatHooks(user, 'postToolUse', entry1, ours('cursor', 'post-edit'));
  assert.deepEqual(once.hooks.postToolUse, [{ command: './fmt.sh' }, entry1]);
  const twice = mergeFlatHooks(once, 'postToolUse', entry2, ours('cursor', 'post-edit'));
  assert.deepEqual(twice.hooks.postToolUse, [{ command: './fmt.sh' }, entry2]);
  const copilot = mergeFlatHooks({}, 'postToolUse', { type: 'command', bash: 'r hook copilot post-edit', powershell: 'r hook copilot post-edit' }, ours('copilot', 'post-edit'));
  assert.equal(copilot.version, 1);
  const again = mergeFlatHooks(copilot, 'postToolUse', { type: 'command', bash: 'r hook copilot post-edit --stamp 2', powershell: 'x' }, ours('copilot', 'post-edit'));
  assert.equal(again.hooks.postToolUse.length, 1);
});
