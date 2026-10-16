# rulebook — Plan 2: agent adapters, `init`, `hook`, `doctor`, `update`, update notice

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `rulebook check` into coding agents, so the companion runs on its own after edits and at the end of a turn:
- `rulebook init` writes project-level hook adapters, the AGENTS.md block and the git pre-commit hook;
- `rulebook hook <agent> <event>` answers in each agent's hook format;
- `doctor` and `update` keep an installation healthy and current;
- a once-a-day update notice runs off the hot path.

**Architecture:** This plan adds the modules below to the zero-dependency CLI from plan 1. `check` is refactored into a reusable `checkProject()` that both `check` and `hook` call.

| Module | Role |
|---|---|
| `src/check/run.js` | Shared check core |
| `src/hook/` | Output formats per agent, and the hook runner |
| `src/install/` | File writers, adapter table, `init`, `doctor`, `update` |
| `src/update/` | Notice, cache and detached registry worker |

**Tech Stack:** Node ≥ 20 ESM, zero dependencies, `node:test`, git.

**Spec:** `E:\Dev\rulebook\docs\specs\2026-10-15-rulebook-design.md` (§5.3, §6, §8.2). It builds on plan 1 (`docs/plans/2026-10-15-plan-1-core-cli.md`), merged in `main`.

## Global Constraints

Plan 1's constraints still hold. This plan adds the following.

**Hooks must never break an agent**
- `rulebook hook …` **always exits 0**.
- It writes nothing on stdout when there is nothing to say.
- It writes errors to stderr only when `RULEBOOK_DEBUG` is set.

**Every generated file is stamped with the CLI version** (`--stamp <x.y.z>` in commands, `<!-- rulebook <x.y.z> -->` in Markdown). `doctor` and `update` rely on it.

**`init` behaviour**
- It never writes without `--yes`. Without it, it prints the plan and exits 0. `--dry-run` also prints only.
- It creates a `<file>.rulebook.bak` backup the first time it modifies an existing file.
- It never rewrites a JSON file it cannot parse. It warns and skips it.
- It is idempotent: a second run with the same version changes nothing.
- The default hook binary is `npx --yes rulebook-cli@0`, overridable with `--bin "<command>"`. The chosen bin is saved as `bin` in `rulebook/config.json`.

**Adapters**
- Full adapters: Claude Code, Codex, Gemini CLI, Copilot, Cursor and Mistral Vibe.
- Kiro, OpenCode and Windsurf get only the universal layers (AGENTS.md and pre-commit). `doctor` reports them as partial.
- The per-agent hook formats live in **one table** (`src/hook/formats.js` and `src/install/agents.js`) with their doc URLs. Only Claude Code is verified end to end (Task 7). The others follow their docs as of 2026-10-15.

**Update notice**
- It never makes a network call in the foreground.
- It is disabled by `RULEBOOK_NO_UPDATE_CHECK`, by `CI`, or when `io.env` is absent (tests).
- Its text is exactly `rulebook <x.y.z> available — npx rulebook-cli@latest update`, at most once per calendar day.

**Format version:** `SUPPORTED_FORMAT = 1`. `init` writes `formatVersion: 1` in a new `rulebook/config.json`.

## Review Focus

1. **Existing user hook configs.** Merging into a `.claude/settings.json` that already has other hooks, permissions and env must keep every other key byte-for-byte equivalent (JSON-equal). *(Task 3, Task 4)*
2. **Re-running `init` or `update` after a version bump.** It must replace our entry, never duplicate it. *(Task 3, Task 5)*
3. **Hook stdin variations.** Empty stdin, non-JSON stdin, a payload whose `cwd` points elsewhere, and a payload with no `cwd` must all be handled: exit 0, never a crash. *(Task 2)*
4. **An existing pre-commit hook (husky, or a custom script).** Our block must be appended between markers, the user's content kept, and `core.hooksPath` respected. *(Task 4)*
5. **A stale or corrupt update cache.** An unreadable cache file must not break `check` or hooks, and the notice must not repeat within a day. *(Task 6)*

---

### Task 1: Extract the shared check core and add `env`/`stdin` to `Io`

**Files:**
- Create: `cli/src/check/run.js`
- Modify: `cli/src/cli.js` (`runCheck` uses `checkProject`; `parseOptions` gains `--agents`, `--yes`, `--dry-run`, `--bin`, `--quiet`)
- Modify: `cli/bin/rulebook.js` (pass `env` and `stdin`)
- Test: `cli/test/check/run.test.js`

**Interfaces:**
- Produces `checkProject(cwd, { scope = {kind:'worktree'}, dir = 'rulebook', now = new Date() } = {}): null | { project, detections, added, notices: string[] }`. It returns `null` outside git or when there is no `rulebook/` folder. It throws on a corrupt index or config, and callers catch.
- `Io` gains two optional fields: `env?: Record<string,string>` and `stdin?: string`.
- `parseOptions` gains these fields:
  - `agents: string[] | null`
  - `yes: boolean`
  - `dryRun: boolean`
  - `bin: string | null`
  - `quiet: boolean`

- [ ] **Step 1: Write the failing test**

`cli/test/check/run.test.js`:
```js
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd cli && npm test`
Expected: FAIL with `Cannot find module '.../src/check/run.js'`.

- [ ] **Step 3: Implement `cli/src/check/run.js`**

```js
import fs from 'node:fs';
import path from 'node:path';
import { loadProject } from '../project.js';
import { git } from '../git.js';
import { readIndex } from '../index/build.js';
import { getDiff } from '../git/diff.js';
import { detect } from './detect.js';
import { appendDetections, formatNotice } from '../inbox/inbox.js';

export function checkProject(cwd, { scope = { kind: 'worktree' }, dir = 'rulebook', now = new Date() } = {}) {
  const project = loadProject(cwd, dir);
  if (!project) return null;
  const index = readIndex(project.dir);
  const diffs = getDiff(project.root, scope);
  const readFile = scope.kind === 'staged'
    ? (p) => git(project.root, ['show', `:${p}`])
    : (p) => { try { return fs.readFileSync(path.join(project.root, p), 'utf8'); } catch { return null; } };
  const detections = detect({ index, diffs, readFile, hotspots: project.config.hotspots, rulebookDir: project.dirName });
  const inboxRel = `${project.dirName}/inbox.md`;
  const added = appendDetections(path.join(project.dir, 'inbox.md'), detections, now);
  return { project, detections, added, notices: added.map((d) => formatNotice(d, inboxRel)) };
}
```

- [ ] **Step 4: Rewrite `runCheck` and `parseOptions` in `cli/src/cli.js`**

Replace `runCheck` with:
```js
function runCheck(io, opts) {
  try {
    const result = checkProject(io.cwd, { scope: opts.scope, dir: opts.dir, now: io.now ? io.now() : new Date() });
    if (!result) return 0;
    if (opts.format === 'json') {
      io.stdout.write(`${JSON.stringify({ detections: result.detections, added: result.added.map((d) => d.key) })}\n`);
    } else {
      for (const line of result.notices) io.stdout.write(`${line}\n`);
    }
    return opts.strict && result.detections.length ? 1 : 0;
  } catch (err) {
    io.stderr.write(`rulebook: check skipped (${err.message})\n`);
    return opts.strict ? 2 : 0;
  }
}
```
Remove the now-unused imports (`fs`, `path`, `git`, `readIndex`, `getDiff`, `detect`, `appendDetections`, `formatNotice`). Keep `readFileSync` for `package.json`, and add `import { checkProject } from './check/run.js';`.

In `parseOptions`, initialise `agents: null, yes: false, dryRun: false, bin: null, quiet: false`, and add:
```js
    else if (a === '--agents') o.agents = (args[++i] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--yes') o.yes = true;
    else if (a === '--dry-run') o.dryRun = true;
    else if (a === '--bin') o.bin = args[++i] ?? null;
    else if (a === '--quiet') o.quiet = true;
```

- [ ] **Step 5: Pass `env` and `stdin` from `cli/bin/rulebook.js`**

```js
#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { run } from '../src/cli.js';

function readStdin() {
  if (process.argv[2] !== 'hook' || process.stdin.isTTY) return '';
  try { return readFileSync(0, 'utf8'); } catch { return ''; }
}

process.exitCode = await run(process.argv.slice(2), {
  cwd: process.cwd(),
  stdout: process.stdout,
  stderr: process.stderr,
  env: process.env,
  stdin: readStdin(),
});
```

- [ ] **Step 6: Let `fakeIo` take extra fields**

Spreading `fakeIo()` would freeze its `out`/`err` getters, so extras are assigned instead. Replace the first line of `cli/test/helpers/io.js` and its `return` with:
```js
export function fakeIo(cwd, extra = {}) {
  const out = [];
  const err = [];
  const io = {
    cwd,
    stdout: { write: (s) => out.push(s) },
    stderr: { write: (s) => err.push(s) },
    now: () => new Date(2026, 9, 15, 14, 2),
    get out() { return out.join(''); },
    get err() { return err.join(''); },
  };
  return Object.assign(io, extra);
}
```

- [ ] **Step 7: Run all tests**

Run: `cd cli && npm test`
Expected: all pass (66).

- [ ] **Step 8: Commit**

```bash
git add cli
git commit -m "refactor(cli): shared checkProject core; Io gains env and stdin; install flags"
```

---

### Task 2: `rulebook hook <agent> <event>`

**Files:**
- Create: `cli/src/hook/formats.js`, `cli/src/hook/run.js`
- Modify: `cli/src/cli.js` (dispatch `hook`; command list in the unknown-command message)
- Modify: `cli/test/cli.test.js` (command list)
- Test: `cli/test/hook/hook.test.js`

**Interfaces:**
- Consumes: `checkProject` (Task 1).
- Produces:
  - `HOOK_FORMATS`;
  - `formatHookOutput(agent, event, lines: string[]): string`, which returns `''` when `lines` is empty, JSON for known (agent, event) pairs, and plain text otherwise;
  - `runHook(io, agent, event, opts): 0`.
- CLI: `rulebook hook <agent> <event> [--dir d] [--stamp v]`.

- [ ] **Step 1: Write the failing tests**

`cli/test/hook/hook.test.js`:
```js
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
```

Update `cli/test/cli.test.js`: the unknown-command assertion becomes `assert.match(io.err, /index, check, hook, init, doctor, update/);`.

- [ ] **Step 2: Run them to verify they fail**

Run: `cd cli && npm test`
Expected: FAIL with `Cannot find module '.../src/hook/formats.js'`.

- [ ] **Step 3: Implement `cli/src/hook/formats.js`**

```js
// Hook output per agent and event. Sources (as of 2026-10-15):
// claude  https://code.claude.com/docs/en/hooks           (verified end to end)
// codex   https://learn.chatgpt.com/docs/hooks
// gemini  https://geminicli.com/docs/hooks/reference/
// copilot https://docs.github.com/en/copilot/reference/hooks-configuration
// cursor  https://cursor.com/docs/agent/hooks
// vibe    https://docs.mistral.ai/vibe/code/cli/hooks
const claudeLike = (eventName) => (text) => ({ hookSpecificOutput: { hookEventName: eventName, additionalContext: text } });
const systemMessage = (text) => ({ systemMessage: text });

export const HOOK_FORMATS = {
  claude: { 'post-edit': claudeLike('PostToolUse'), stop: systemMessage },
  codex: { 'post-edit': claudeLike('PostToolUse'), stop: systemMessage },
  gemini: { 'post-edit': claudeLike('AfterTool') },
  copilot: { 'post-edit': (text) => ({ additionalContext: text }) },
  cursor: { 'post-edit': (text) => ({ additional_context: text }) },
  vibe: { 'post-edit': (text) => ({ hook_specific_output: { additional_context: text } }) },
};

export function formatHookOutput(agent, event, lines) {
  if (!lines.length) return '';
  const text = lines.join('\n');
  const format = HOOK_FORMATS[agent]?.[event];
  return format ? JSON.stringify(format(text)) : text;
}
```

- [ ] **Step 4: Implement `cli/src/hook/run.js`**

```js
import { checkProject } from '../check/run.js';
import { formatHookOutput } from './formats.js';

function payloadCwd(stdin) {
  try {
    const payload = JSON.parse(stdin);
    return typeof payload?.cwd === 'string' && payload.cwd ? payload.cwd : null;
  } catch {
    return null;
  }
}

export function runHook(io, agent, event, opts, extraLines = () => []) {
  try {
    const cwd = payloadCwd(io.stdin ?? '') ?? io.cwd;
    const result = checkProject(cwd, { dir: opts.dir, now: io.now ? io.now() : new Date() });
    const lines = [...(result ? result.notices : []), ...extraLines()];
    const out = formatHookOutput(agent, event, lines);
    if (out) io.stdout.write(`${out}\n`);
  } catch (err) {
    if (io.env?.RULEBOOK_DEBUG) io.stderr.write(`rulebook: hook skipped (${err.message})\n`);
  }
  return 0;
}
```

- [ ] **Step 5: Dispatch `hook` in `cli/src/cli.js`**

In `run`, replace `const opts = parseOptions(rest);` with:
```js
  const positional = cmd === 'hook' ? rest.slice(0, 2) : [];
  const opts = parseOptions(cmd === 'hook' ? rest.slice(2) : rest);
```
Before the unknown-command fallback, add:
```js
  if (cmd === 'hook') return runHook(io, positional[0] ?? '', positional[1] ?? '', opts);
```
Change the fallback message to `Commands: index, check, hook, init, doctor, update`. Import `runHook` from `./hook/run.js`.

- [ ] **Step 6: Run all tests**

Run: `cd cli && npm test`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add cli
git commit -m "feat(cli): rulebook hook answers in each agent's hook format"
```

---

### Task 3: Config file writers

**Files:**
- Create: `cli/src/install/writers.js`
- Test: `cli/test/install/writers.test.js`

**Interfaces:**
- Produces:
  - `upsertBlock(text, start, end, body): string`, which replaces the text between the markers, or appends the block;
  - `isOurs(command, agent, event): boolean`;
  - `mergeNestedHooks(json, event, matcher | null, command, ours): object`, for the Claude, Codex and Gemini shape `{hooks:{Event:[{matcher?, hooks:[{type,command}]}]}}`;
  - `mergeFlatHooks(json, event, entry, ours): object`, for the Copilot and Cursor shape `{version:1, hooks:{event:[entry]}}`.
- Every merge works on a deep copy and never mutates its input.

- [ ] **Step 1: Write the failing tests**

`cli/test/install/writers.test.js`:
```js
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
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd cli && npm test`
Expected: FAIL with `Cannot find module '.../src/install/writers.js'`.

- [ ] **Step 3: Implement `cli/src/install/writers.js`**

```js
export function upsertBlock(text, start, end, body) {
  const block = `${start}\n${body}\n${end}`;
  const i = text.indexOf(start);
  const j = text.indexOf(end, i + 1);
  if (i !== -1 && j !== -1) return text.slice(0, i) + block + text.slice(j + end.length);
  if (!text) return `${block}\n`;
  return `${text}${text.endsWith('\n') ? '' : '\n'}\n${block}\n`;
}

export function isOurs(command, agent, event) {
  return /rulebook/.test(command) && command.includes(` hook ${agent} ${event}`);
}

export function mergeNestedHooks(json, event, matcher, command, ours) {
  const out = structuredClone(json ?? {});
  out.hooks ??= {};
  const list = (out.hooks[event] ??= []);
  for (const group of list) {
    for (const h of group.hooks ?? []) {
      if (ours(h.command ?? '')) { h.command = command; return out; }
    }
  }
  list.push({ ...(matcher ? { matcher } : {}), hooks: [{ type: 'command', command }] });
  return out;
}

export function mergeFlatHooks(json, event, entry, ours) {
  const out = structuredClone(json ?? {});
  out.version ??= 1;
  out.hooks ??= {};
  const list = (out.hooks[event] ??= []);
  const idx = list.findIndex((h) => ours(h.command ?? h.bash ?? ''));
  if (idx >= 0) list[idx] = entry; else list.push(entry);
  return out;
}
```

- [ ] **Step 4: Run all tests**

Run: `cd cli && npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add cli
git commit -m "feat(cli): idempotent writers for hook configs and marked blocks"
```

---

### Task 4: Adapter table and `rulebook init`

**Files:**
- Create: `cli/src/install/agents.js`, `cli/src/install/init.js`
- Modify: `cli/src/project.js` (export `SUPPORTED_FORMAT = 1`)
- Modify: `cli/src/cli.js` (dispatch `init`; export `VERSION`)
- Test: `cli/test/install/init.test.js`

**Interfaces:**
- Consumes: the writers (Task 3), `git()` (plan 1).
- Produces:
  - `ADAPTERS: { agent, detect: string[], file, kind: 'json'|'text', apply(current, cmd): object|string, note?: string }[]`;
  - `PARTIAL_AGENTS = ['kiro', 'opencode', 'windsurf']`;
  - `hookCommand(bin, agent, event, version): string`;
  - `detectAgents(root): string[]`;
  - `planInit(root, { agents, bin, version }): { changes: {path, before: string|null, after: string, mode?: number}[], warnings: string[], notes: string[] }`;
  - `applyChanges(root, changes): void`;
  - `runInit(io, opts): number`;
  - `DEFAULT_BIN = 'npx --yes rulebook-cli@0'`.
- `rulebook/config.json` created by `init`: `{ "formatVersion": 1, "language": "en", "repoUrl": null, "hotspots": [], "bin": <bin> }`. For an existing config, only `bin` is set or updated (and `formatVersion` added if missing). All other keys are preserved.

- [ ] **Step 1: Write the failing tests**

`cli/test/install/init.test.js`:
```js
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
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd cli && npm test`
Expected: FAIL. `VERSION` is not exported, and `src/install/init.js` is missing.

- [ ] **Step 3: Implement `cli/src/install/agents.js`**

```js
import { isOurs, mergeNestedHooks, mergeFlatHooks, upsertBlock } from './writers.js';

export const DEFAULT_BIN = 'npx --yes rulebook-cli@0';
export const PARTIAL_AGENTS = ['kiro', 'opencode', 'windsurf'];

export function hookCommand(bin, agent, event, version) {
  return `${bin} hook ${agent} ${event} --stamp ${version}`;
}

const ours = (agent, event) => (command) => isOurs(command, agent, event);
const nested = (agent, steps) => (json, cmd) =>
  steps.reduce((acc, [event, matcher, hookEvent]) => mergeNestedHooks(acc, event, matcher, cmd(hookEvent), ours(agent, hookEvent)), json);

export const ADAPTERS = [
  {
    agent: 'claude', detect: ['.claude', 'CLAUDE.md'], file: '.claude/settings.json', kind: 'json',
    apply: nested('claude', [['PostToolUse', 'Edit|Write|MultiEdit', 'post-edit'], ['Stop', null, 'stop']]),
  },
  {
    agent: 'gemini', detect: ['.gemini', 'GEMINI.md'], file: '.gemini/settings.json', kind: 'json',
    apply: nested('gemini', [['AfterTool', 'write_file|replace', 'post-edit']]),
  },
  {
    agent: 'codex', detect: ['.codex'], file: '.codex/hooks.json', kind: 'json',
    apply: nested('codex', [['PostToolUse', 'apply_patch|Edit|Write', 'post-edit'], ['Stop', null, 'stop']]),
    note: 'Codex: approve the rulebook hooks once with /hooks',
  },
  {
    agent: 'copilot', detect: ['.github/copilot-instructions.md', '.github/hooks'], file: '.github/hooks/rulebook.json', kind: 'json',
    apply: (json, cmd) => mergeFlatHooks(json, 'postToolUse',
      { type: 'command', bash: cmd('post-edit'), powershell: cmd('post-edit'), timeoutSec: 15 }, ours('copilot', 'post-edit')),
  },
  {
    agent: 'cursor', detect: ['.cursor'], file: '.cursor/hooks.json', kind: 'json',
    apply: (json, cmd) => mergeFlatHooks(json, 'postToolUse', { command: cmd('post-edit') }, ours('cursor', 'post-edit')),
  },
  {
    agent: 'vibe', detect: ['.vibe'], file: '.vibe/hooks.toml', kind: 'text',
    apply: (text, cmd) => upsertBlock(text, '# >>> rulebook', '# <<< rulebook',
      `[[hooks]]\nname = "rulebook-post-tool"\nevent = "post_tool"\ncommand = ${JSON.stringify(cmd('post-edit'))}`),
  },
];
```

- [ ] **Step 4: Implement `cli/src/install/init.js`**

```js
import fs from 'node:fs';
import path from 'node:path';
import { git } from '../git.js';
import { SUPPORTED_FORMAT } from '../project.js';
import { ADAPTERS, PARTIAL_AGENTS, DEFAULT_BIN, hookCommand } from './agents.js';
import { upsertBlock } from './writers.js';

const readOrNull = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);

export function detectAgents(root) {
  return ADAPTERS.filter((a) => a.detect.some((p) => fs.existsSync(path.join(root, p)))).map((a) => a.agent);
}

function hooksDir(root) {
  const rel = git(root, ['rev-parse', '--git-path', 'hooks'])?.trim() || '.git/hooks';
  return path.relative(root, path.resolve(root, rel)).replace(/\\/g, '/');
}

function agentsBlock(bin, version) {
  return [
    `<!-- rulebook ${version} -->`,
    '## Business rules (rulebook)',
    '',
    'This project keeps its business rules in `rulebook/`. After you change validation, permissions,',
    `calculations, states or deadlines, run \`${bin} check\` and mention its output to the user.`,
    'Do not edit `rulebook/` cards by hand: use the rulebook skills.',
  ].join('\n');
}

export function planInit(root, { agents, bin, version }) {
  const changes = [];
  const warnings = [];
  const notes = [];
  const add = (rel, after, mode) => {
    const before = readOrNull(path.join(root, rel));
    if (before !== after) changes.push({ path: rel, before, after, ...(mode ? { mode } : {}) });
  };
  const cmd = (agent) => (event) => hookCommand(bin, agent, event, version);

  for (const name of agents) {
    const adapter = ADAPTERS.find((a) => a.agent === name);
    if (!adapter) {
      warnings.push(PARTIAL_AGENTS.includes(name)
        ? `${name}: partial support (AGENTS.md and pre-commit only)`
        : `unknown agent "${name}"`);
      continue;
    }
    const current = readOrNull(path.join(root, adapter.file));
    if (adapter.kind === 'json') {
      let json = {};
      if (current !== null) {
        try { json = JSON.parse(current); } catch { warnings.push(`cannot parse ${adapter.file}, left untouched`); continue; }
      }
      add(adapter.file, `${JSON.stringify(adapter.apply(json, cmd(name)), null, 2)}\n`);
    } else {
      add(adapter.file, adapter.apply(current ?? '', cmd(name)));
    }
    if (adapter.note) notes.push(adapter.note);
  }

  add('AGENTS.md', upsertBlock(readOrNull(path.join(root, 'AGENTS.md')) ?? '', '<!-- rulebook:start -->', '<!-- rulebook:end -->', agentsBlock(bin, version)));

  const preCommit = `${hooksDir(root)}/pre-commit`;
  const existingHook = readOrNull(path.join(root, preCommit));
  add(preCommit, upsertBlock(existingHook ?? '#!/bin/sh\n', '# >>> rulebook', '# <<< rulebook', `${bin} check --staged --stamp ${version} || true`), 0o755);

  const cfgRel = 'rulebook/config.json';
  const cfgText = readOrNull(path.join(root, cfgRel));
  let config = { formatVersion: SUPPORTED_FORMAT, language: 'en', repoUrl: null, hotspots: [] };
  if (cfgText !== null) {
    try { config = JSON.parse(cfgText); } catch { warnings.push(`cannot parse ${cfgRel}, left untouched`); config = null; }
  }
  if (config) {
    config.formatVersion ??= SUPPORTED_FORMAT;
    config.bin = bin;
    add(cfgRel, `${JSON.stringify(config, null, 2)}\n`);
  }
  return { changes, warnings, notes };
}

export function applyChanges(root, changes) {
  for (const c of changes) {
    const abs = path.join(root, c.path);
    if (c.before !== null && !fs.existsSync(`${abs}.rulebook.bak`)) fs.writeFileSync(`${abs}.rulebook.bak`, c.before);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, c.after);
    if (c.mode) fs.chmodSync(abs, c.mode);
  }
}

export function runInit(io, opts, version) {
  const root = git(io.cwd, ['rev-parse', '--show-toplevel'])?.trim();
  if (!root) { io.stderr.write('rulebook: init must run inside a git repository\n'); return 1; }
  const agents = opts.agents ?? detectAgents(root);
  const bin = opts.bin ?? DEFAULT_BIN;
  const { changes, warnings, notes } = planInit(root, { agents, bin, version });
  for (const w of warnings) io.stderr.write(`rulebook: ${w}\n`);
  if (!changes.length) { io.stdout.write('rulebook: nothing to change\n'); return 0; }
  for (const c of changes) io.stdout.write(`${c.before === null ? '+ create' : '~ update'} ${c.path}\n`);
  if (!opts.yes || opts.dryRun) { io.stdout.write('rulebook: re-run with --yes to apply\n'); return 0; }
  applyChanges(root, changes);
  for (const n of notes) io.stdout.write(`rulebook: ${n}\n`);
  io.stdout.write(`rulebook: initialised for ${agents.length ? agents.join(', ') : 'no agent (universal layers only)'}\n`);
  return 0;
}
```

- [ ] **Step 5: Wire it into the CLI**

- In `cli/src/project.js`, add `export const SUPPORTED_FORMAT = 1;`.
- In `cli/src/cli.js`:
  - add `export const VERSION = pkg.version;` after `pkg`;
  - import `runInit` from `./install/init.js`;
  - add `if (cmd === 'init') return runInit(io, opts, VERSION);` before the fallback.

- [ ] **Step 6: Run all tests**

Run: `cd cli && npm test`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add cli
git commit -m "feat(cli): rulebook init writes agent adapters, AGENTS.md block, pre-commit and config"
```

---

### Task 5: `rulebook doctor` and `rulebook update`

**Files:**
- Create: `cli/src/install/doctor.js`, `cli/src/install/update.js`
- Modify: `cli/src/cli.js` (dispatch `doctor`, `update`)
- Test: `cli/test/install/doctor.test.js`

**Interfaces:**
- Consumes: `ADAPTERS`, `detectAgents`, `planInit`, `applyChanges` (Task 4), `loadProject`, `SUPPORTED_FORMAT`, `loadCards`, `buildIndex`.
- Produces:
  - `diagnose(root, version): { level: 'ok'|'warn', message }[]`;
  - `runDoctor(io, opts, version): 0`;
  - `installedAgents(root): string[]`, the adapters whose file contains one of our hook commands;
  - `runUpdate(io, opts, version): number`.
- Stamp regex: `/--stamp (\d+\.\d+\.\d+)/`.

- [ ] **Step 1: Write the failing tests**

`cli/test/install/doctor.test.js`:
```js
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
  assert.equal(json.hooks.PostToolUse[0].hooks[0].command, `${BIN} hook claude post-edit --stamp ${VERSION}`);
  assert.match(io.out, /updated for claude, cursor/);
  assert.match(io.out, /claude plugin update rulebook@<marketplace>/);
  assert.match(io.out, /npx skills update/);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd cli && npm test`
Expected: FAIL with `unknown command "doctor"`.

- [ ] **Step 3: Implement `cli/src/install/doctor.js`**

```js
import fs from 'node:fs';
import path from 'node:path';
import { git } from '../git.js';
import { loadProject, SUPPORTED_FORMAT } from '../project.js';
import { loadCards, buildIndex } from '../index/build.js';
import { ADAPTERS } from './agents.js';
import { detectAgents } from './init.js';

const STAMP = /--stamp (\d+\.\d+\.\d+)/;

export function diagnose(root, version) {
  const out = [];
  const ok = (message) => out.push({ level: 'ok', message });
  const warn = (message) => out.push({ level: 'warn', message });
  ok(`rulebook-cli ${version}`);

  let project = null;
  try { project = loadProject(root); } catch (err) { warn(err.message); }
  if (!project) {
    if (!out.some((o) => o.level === 'warn')) warn('no rulebook/ folder — run the rulebook-map skill or rulebook init');
  } else {
    const fv = project.config.formatVersion;
    if (fv === undefined) warn(`config.json has no formatVersion (expected ${SUPPORTED_FORMAT})`);
    else if (fv > SUPPORTED_FORMAT) warn(`format ${fv} is newer than this CLI supports (${SUPPORTED_FORMAT}) — run: npx rulebook-cli@latest update`);
    else ok(`format ${fv}`);
    try {
      const { cards } = loadCards(project);
      const { unresolved } = buildIndex(project.root, cards, null);
      if (unresolved.length) warn(`${unresolved.length} evidence anchor(s) unresolved — run rulebook index`);
      else ok(`${cards.length} cards, all evidence resolvable`);
    } catch (err) { warn(`cannot read cards (${err.message})`); }
  }

  const detected = detectAgents(root);
  for (const a of ADAPTERS) {
    const file = path.join(root, a.file);
    const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    const stamp = text.includes(` hook ${a.agent} `) ? text.match(STAMP)?.[1] : null;
    if (!stamp) { if (detected.includes(a.agent)) warn(`${a.agent}: detected but no rulebook hooks — run rulebook init`); continue; }
    if (stamp === version) ok(`${a.agent}: hooks installed`);
    else warn(`${a.agent}: hooks from rulebook ${stamp} — run rulebook update`);
  }

  const hooksRel = git(root, ['rev-parse', '--git-path', 'hooks'])?.trim() || '.git/hooks';
  const preCommit = path.resolve(root, hooksRel, 'pre-commit');
  const hookText = fs.existsSync(preCommit) ? fs.readFileSync(preCommit, 'utf8') : '';
  if (hookText.includes('# >>> rulebook')) ok('pre-commit hook installed');
  else warn('no rulebook pre-commit hook — run rulebook init');
  return out;
}

export function runDoctor(io, opts, version) {
  const root = git(io.cwd, ['rev-parse', '--show-toplevel'])?.trim();
  const results = root ? diagnose(root, version) : [{ level: 'warn', message: 'not inside a git repository' }];
  for (const r of results) {
    if (r.level === 'ok' && opts.quiet) continue;
    io.stdout.write(`${r.level === 'ok' ? '✓' : '!'} ${r.message}\n`);
  }
  return 0;
}
```

- [ ] **Step 4: Implement `cli/src/install/update.js`**

```js
import fs from 'node:fs';
import path from 'node:path';
import { git } from '../git.js';
import { ADAPTERS, DEFAULT_BIN } from './agents.js';
import { planInit, applyChanges } from './init.js';

export function installedAgents(root) {
  return ADAPTERS.filter((a) => {
    const file = path.join(root, a.file);
    return fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes(` hook ${a.agent} `);
  }).map((a) => a.agent);
}

function storedBin(root) {
  try { return JSON.parse(fs.readFileSync(path.join(root, 'rulebook/config.json'), 'utf8')).bin ?? null; } catch { return null; }
}

export function runUpdate(io, opts, version) {
  const root = git(io.cwd, ['rev-parse', '--show-toplevel'])?.trim();
  if (!root) { io.stderr.write('rulebook: update must run inside a git repository\n'); return 1; }
  const agents = installedAgents(root);
  const bin = opts.bin ?? storedBin(root) ?? DEFAULT_BIN;
  const { changes, warnings } = planInit(root, { agents, bin, version });
  for (const w of warnings) io.stderr.write(`rulebook: ${w}\n`);
  applyChanges(root, changes);
  io.stdout.write(`rulebook: updated for ${agents.length ? agents.join(', ') : 'no agent (universal layers only)'} (${changes.length} file(s) changed)\n`);
  io.stdout.write('rulebook: skills are updated by the channel you installed them from:\n');
  io.stdout.write('  claude plugin update rulebook@<marketplace>   (Claude Code plugin)\n');
  io.stdout.write('  npx skills update                              (skills.sh)\n');
  return 0;
}
```

- [ ] **Step 5: Dispatch in `cli/src/cli.js`**

Import `runDoctor` and `runUpdate`, then add:
```js
  if (cmd === 'doctor') return runDoctor(io, opts, VERSION);
  if (cmd === 'update') return runUpdate(io, opts, VERSION);
```

- [ ] **Step 6: Run all tests**

Run: `cd cli && npm test`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add cli
git commit -m "feat(cli): rulebook doctor and rulebook update"
```

---

### Task 6: Once-a-day update notice

**Files:**
- Create: `cli/src/update/notice.js`, `cli/src/update/worker.js`
- Modify: `cli/src/cli.js` (`runCheck` line format appends the notice; `hook` passes it as extra lines)
- Test: `cli/test/update/notice.test.js`

**Interfaces:**
- Produces from `notice.js`:
  - `cacheFile(env): string`;
  - `readCache(file): object`, which returns `{}` on any error;
  - `writeCache(file, data)`;
  - `isNewer(a, b): boolean`;
  - `updateNotice({ env, now, current, spawnCheck }): string | null`;
  - `DEFAULT_REGISTRY = 'https://registry.npmjs.org/rulebook-cli/latest'`.
- `worker.js` runs as `node worker.js <cacheFile> <registryUrl>`. It fetches with a 2 s timeout and writes `{ ...cache, checkedAt, latest }`.

- [ ] **Step 1: Write the failing tests**

`cli/test/update/notice.test.js`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { updateNotice, cacheFile, readCache, writeCache, isNewer } from '../../src/update/notice.js';
import { run, VERSION } from '../../src/cli.js';
import { fakeIo } from '../helpers/io.js';
import { makeRepo } from '../helpers/repo.js';
import { baseFiles } from '../helpers/fixture.js';

const tmpEnv = () => ({ RULEBOOK_CACHE_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'rulebook-cache-')) });
const NOW = new Date('2026-10-16T09:00:00Z');

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
  const worker = fileURLToPath(new URL('../../src/update/worker.js', import.meta.url));
  try {
    await new Promise((resolve, reject) => {
      import('node:child_process').then(({ execFile }) => execFile(process.execPath, [worker, cacheFile(env), `http://127.0.0.1:${server.address().port}/`], (err) => (err ? reject(err) : resolve())));
    });
  } finally {
    server.close();
  }
  assert.equal(readCache(cacheFile(env)).latest, '9.9.9');
});

test('the worker gives up silently when the registry is unreachable', () => {
  const env = tmpEnv();
  const worker = fileURLToPath(new URL('../../src/update/worker.js', import.meta.url));
  execFileSync(process.execPath, [worker, cacheFile(env), 'http://127.0.0.1:9/']);
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
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd cli && npm test`
Expected: FAIL with `Cannot find module '.../src/update/notice.js'`.

- [ ] **Step 3: Implement `cli/src/update/notice.js`**

```js
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const DEFAULT_REGISTRY = 'https://registry.npmjs.org/rulebook-cli/latest';
const DAY = 24 * 3600 * 1000;

export function cacheFile(env) {
  let base = env.RULEBOOK_CACHE_DIR;
  if (!base && process.platform === 'win32' && env.LOCALAPPDATA) base = path.join(env.LOCALAPPDATA, 'rulebook');
  if (!base) base = path.join(env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'), 'rulebook');
  return path.join(base, 'update.json');
}

export function readCache(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) ?? {}; } catch { return {}; }
}

export function writeCache(file, data) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data));
  } catch { /* cache is best effort */ }
}

export function isNewer(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  }
  return false;
}

function spawnWorker(file, url) {
  try {
    const worker = fileURLToPath(new URL('./worker.js', import.meta.url));
    spawn(process.execPath, [worker, file, url], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  } catch { /* best effort */ }
}

export function updateNotice({ env, now, current, spawnCheck = spawnWorker }) {
  if (!env || env.RULEBOOK_NO_UPDATE_CHECK || env.CI) return null;
  const file = cacheFile(env);
  const cache = readCache(file);
  const t = now.getTime();
  if (!cache.checkedAt || t - cache.checkedAt > DAY) {
    cache.checkedAt = t;
    writeCache(file, cache);
    spawnCheck(file, env.RULEBOOK_REGISTRY_URL || DEFAULT_REGISTRY);
  }
  const today = now.toISOString().slice(0, 10);
  if (typeof cache.latest === 'string' && isNewer(cache.latest, current) && cache.notifiedOn !== today) {
    cache.notifiedOn = today;
    writeCache(file, cache);
    return `rulebook ${cache.latest} available — npx rulebook-cli@latest update`;
  }
  return null;
}
```

- [ ] **Step 4: Implement `cli/src/update/worker.js`**

```js
import { readCache, writeCache } from './notice.js';

const [file, url] = process.argv.slice(2);
try {
  const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
  const body = await res.json();
  if (typeof body?.version === 'string') writeCache(file, { ...readCache(file), checkedAt: Date.now(), latest: body.version });
} catch { /* offline or registry down: try again tomorrow */ }
```

- [ ] **Step 5: Wire the notice into `check` and `hook` in `cli/src/cli.js`**

Import `updateNotice` from `./update/notice.js`, then add:
```js
const notice = (io) => updateNotice({ env: io.env, now: io.now ? io.now() : new Date(), current: VERSION });
```

- In `runCheck`, line format, after printing the notices, add: `const n = notice(io); if (n) io.stdout.write(\`${n}\n\`);`. Note that `checkProject` returning `null` must not skip it. Restructure so that the `null` result prints only the notice:
  ```js
      const result = checkProject(...);
      if (opts.format === 'json') { if (result) io.stdout.write(...); }
      else { for (const line of result?.notices ?? []) io.stdout.write(`${line}\n`); const n = notice(io); if (n) io.stdout.write(`${n}\n`); }
      return opts.strict && result?.detections.length ? 1 : 0;
  ```
- In the `hook` dispatch, change it to `runHook(io, positional[0] ?? '', positional[1] ?? '', opts, () => { const n = notice(io); return n ? [n] : []; })`.

- [ ] **Step 6: Run all tests**

Run: `cd cli && npm test`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add cli
git commit -m "feat(cli): once-a-day update notice from a detached registry check"
```

---

### Task 7: End-to-end check with headless Claude Code

**Files:**
- Create: `cli/scripts/e2e-claude.sh`
- Modify: none

**Interfaces:**
- Consumes: the whole CLI. It needs the `claude` CLI on PATH and an authenticated session. It is not part of `npm test`.

- [ ] **Step 1: Write the script**

`cli/scripts/e2e-claude.sh`:
```bash
#!/usr/bin/env bash
# End-to-end: rulebook init + a real Claude Code session editing a rule.
# Usage: cli/scripts/e2e-claude.sh   (needs `claude` on PATH, authenticated)
set -euo pipefail
CLI="$(cd "$(dirname "$0")/.." && pwd)"
BIN="node $CLI/bin/rulebook.js"
REPO="$(mktemp -d)"
cd "$REPO"
git init -q -b main && git config user.email e2e@example.com && git config user.name e2e
node --input-type=module -e "
import fs from 'node:fs';
import { baseFiles } from '$CLI/test/helpers/fixture.js';
for (const [p, t] of Object.entries(baseFiles())) { fs.mkdirSync(p.split('/').slice(0, -1).join('/') || '.', { recursive: true }); fs.writeFileSync(p, t); }
"
$BIN init --agents claude --bin "$BIN" --yes >/dev/null
$BIN index >/dev/null
git add -A && git commit -qm init
RULEBOOK_NO_UPDATE_CHECK=1 claude -p "In app/Policies/OrderPolicy.php change 14 to 7 using the Edit tool. Then quote verbatim any message starting with 'rulebook:' that a hook gave you, or say NONE." \
  --permission-mode acceptEdits --model sonnet > answer.txt 2>&1 || true
echo "--- answer"; tail -3 answer.txt
echo "--- inbox"; cat rulebook/inbox.md
grep -q "modified? · PAY-R012" rulebook/inbox.md && grep -q "rulebook: PAY-R012 may have changed" answer.txt && echo "E2E PASS" || { echo "E2E FAIL"; exit 1; }
```

- [ ] **Step 2: Run it**

Run: `bash cli/scripts/e2e-claude.sh`
Expected: `E2E PASS`. The inbox has the `modified? · PAY-R012` entry, and Claude quotes the `rulebook:` notice that reached its context.

- [ ] **Step 3: Commit**

```bash
git add cli/scripts/e2e-claude.sh
git commit -m "test(cli): end-to-end companion check with headless Claude Code"
```
