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

// Claude / Codex / Gemini shape: { hooks: { Event: [ { matcher?, hooks: [ { type, command } ] } ] } }
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

// Copilot / Cursor shape: { version: 1, hooks: { event: [ entry ] } }
export function mergeFlatHooks(json, event, entry, ours) {
  const out = structuredClone(json ?? {});
  out.version ??= 1;
  out.hooks ??= {};
  const list = (out.hooks[event] ??= []);
  const idx = list.findIndex((h) => ours(h.command ?? h.bash ?? ''));
  if (idx >= 0) list[idx] = entry; else list.push(entry);
  return out;
}
