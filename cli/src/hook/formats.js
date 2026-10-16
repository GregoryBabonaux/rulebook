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
