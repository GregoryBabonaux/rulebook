import { isOurs, mergeNestedHooks, mergeFlatHooks, upsertBlock } from './writers.js';

export const DEFAULT_BIN = 'npx --yes rulebook-cli@0';
export const PARTIAL_AGENTS = ['kiro', 'opencode', 'windsurf'];

export function hookCommand(bin, agent, event, version) {
  return `${bin} hook ${agent} ${event} --stamp ${version}`;
}

const ours = (agent, event) => (command) => isOurs(command, agent, event);
const nested = (agent, steps) => (json, cmd) =>
  steps.reduce((acc, [event, matcher, hookEvent]) => mergeNestedHooks(acc, event, matcher, cmd(hookEvent), ours(agent, hookEvent)), json);

// Project-level hook configs per agent. Formats follow each agent's docs as of
// 2026-10-15 (see src/hook/formats.js); only Claude Code is verified end to end.
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
