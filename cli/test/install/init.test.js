import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { run, VERSION } from '../../src/cli.js';
import { detectAgents, planInit } from '../../src/install/init.js';
import { makeRepo } from '../helpers/repo.js';
import { fakeIo } from '../helpers/io.js';

const BIN = 'node /opt/rulebook.js';
const read = (repo, p) => fs.readFileSync(path.join(repo.dir, p), 'utf8');
const exists = (repo, p) => fs.existsSync(path.join(repo.dir, p));

test('detectAgents looks for agent folders and files', () => {
  const repo = makeRepo({ '.claude/x': '', '.cursor/y': '', 'GEMINI.md': '' });
  assert.deepEqual(detectAgents(repo.dir), ['claude', 'gemini', 'cursor']);
});

test('init without --yes only prints the plan', async () => {
  const repo = makeRepo({ 'a.txt': 'x' });
  const io = fakeIo(repo.dir);
  assert.equal(await run(['init', '--agents', 'claude', '--bin', BIN], io), 0);
  assert.match(io.out, /\+ create \.claude\/settings\.json/);
  assert.match(io.out, /re-run with --yes to apply/);
  assert.equal(exists(repo, '.claude/settings.json'), false);
});

test('init --yes writes adapters, AGENTS.md, pre-commit and config; second run changes nothing', async () => {
  const repo = makeRepo({ 'AGENTS.md': '# Agents\n\nBe nice.\n' });
  const io = fakeIo(repo.dir);
  assert.equal(await run(['init', '--agents', 'claude,codex,gemini,copilot,cursor,vibe', '--bin', BIN, '--yes'], io), 0);
  const claude = JSON.parse(read(repo, '.claude/settings.json'));
  assert.equal(claude.hooks.PostToolUse[0].hooks[0].command, `${BIN} hook claude post-edit --stamp ${VERSION}`);
  assert.equal(claude.hooks.Stop[0].hooks[0].command, `${BIN} hook claude stop --stamp ${VERSION}`);
  assert.equal(JSON.parse(read(repo, '.codex/hooks.json')).hooks.PostToolUse[0].matcher, 'apply_patch|Edit|Write');
  assert.equal(JSON.parse(read(repo, '.gemini/settings.json')).hooks.AfterTool[0].matcher, 'write_file|replace');
  assert.equal(JSON.parse(read(repo, '.github/hooks/rulebook.json')).hooks.postToolUse[0].bash, `${BIN} hook copilot post-edit --stamp ${VERSION}`);
  assert.equal(JSON.parse(read(repo, '.cursor/hooks.json')).hooks.postToolUse[0].command, `${BIN} hook cursor post-edit --stamp ${VERSION}`);
  assert.match(read(repo, '.vibe/hooks.toml'), /event = "post_tool"\ncommand = "node \/opt\/rulebook\.js hook vibe post-edit --stamp/);
  const agentsMd = read(repo, 'AGENTS.md');
  assert.match(agentsMd, /^# Agents\n\nBe nice\.\n\n<!-- rulebook:start -->/);
  assert.match(agentsMd, new RegExp(`<!-- rulebook ${VERSION.replace(/\./g, '\\.')} -->`));
  assert.equal(read(repo, 'AGENTS.md.rulebook.bak'), '# Agents\n\nBe nice.\n');
  const hook = read(repo, '.git/hooks/pre-commit');
  assert.match(hook, /^#!\/bin\/sh\n/);
  assert.match(hook, new RegExp(`${BIN} check --staged --stamp ${VERSION.replace(/\./g, '\\.')} \\|\\| true`));
  const config = JSON.parse(read(repo, 'rulebook/config.json'));
  assert.deepEqual(config, { formatVersion: 1, language: 'en', repoUrl: null, hotspots: [], bin: BIN });
  assert.match(io.out, /Codex: approve the rulebook hooks once with \/hooks/);

  const again = fakeIo(repo.dir);
  await run(['init', '--agents', 'claude,codex,gemini,copilot,cursor,vibe', '--bin', BIN, '--yes'], again);
  assert.match(again.out, /nothing to change/);
});

test('init merges into existing settings without losing user keys', async () => {
  const user = { permissions: { allow: ['Bash(ls)'] }, hooks: { PostToolUse: [{ matcher: 'Write', hooks: [{ type: 'command', command: 'prettier --write' }] }] } };
  const repo = makeRepo({ '.claude/settings.json': JSON.stringify(user, null, 2) });
  await run(['init', '--agents', 'claude', '--bin', BIN, '--yes'], fakeIo(repo.dir));
  const merged = JSON.parse(read(repo, '.claude/settings.json'));
  assert.deepEqual(merged.permissions, user.permissions);
  assert.equal(merged.hooks.PostToolUse.length, 2);
  assert.deepEqual(JSON.parse(read(repo, '.claude/settings.json.rulebook.bak')), user);
});

test('an unparseable JSON config is left untouched with a warning', async () => {
  const repo = makeRepo({ '.claude/settings.json': '{ // comments are not JSON\n}' });
  const io = fakeIo(repo.dir);
  await run(['init', '--agents', 'claude', '--bin', BIN, '--yes'], io);
  assert.equal(read(repo, '.claude/settings.json'), '{ // comments are not JSON\n}');
  assert.match(io.err, /cannot parse \.claude\/settings\.json, left untouched/);
});

test('an existing pre-commit keeps its content and core.hooksPath is respected', async () => {
  const repo = makeRepo({ '.husky/pre-commit': '#!/bin/sh\nnpx lint-staged\n' });
  repo.git('config', 'core.hooksPath', '.husky');
  await run(['init', '--bin', BIN, '--yes'], fakeIo(repo.dir));
  const hook = read(repo, '.husky/pre-commit');
  assert.match(hook, /^#!\/bin\/sh\nnpx lint-staged\n\n# >>> rulebook/);
  assert.equal(exists(repo, '.git/hooks/pre-commit'), false);
});

test('existing config keeps its keys and only gains bin and formatVersion', () => {
  const repo = makeRepo({ 'rulebook/config.json': JSON.stringify({ language: 'fr', hotspots: ['app/**'] }) });
  const { changes } = planInit(repo.dir, { agents: [], bin: BIN, version: '0.1.0' });
  const cfg = changes.find((c) => c.path === 'rulebook/config.json');
  assert.deepEqual(JSON.parse(cfg.after), { language: 'fr', hotspots: ['app/**'], formatVersion: 1, bin: BIN });
});

test('unknown and partial agents are reported', async () => {
  const io = fakeIo(makeRepo({ 'a.txt': 'x' }).dir);
  await run(['init', '--agents', 'kiro,foo', '--bin', BIN], io);
  assert.match(io.err, /kiro: partial support \(AGENTS\.md and pre-commit only\)/);
  assert.match(io.err, /unknown agent "foo"/);
});
