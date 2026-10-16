export const toLf = (text) => text.replace(/\r\n/g, '\n');

// Write `after` with the line endings `before` already uses (a CRLF checkout stays CRLF).
export function matchEol(before, after) {
  return before !== null && before.includes('\r\n') ? toLf(after).replace(/\n/g, '\r\n') : after;
}

function replaceBlock(text, start, end, block) {
  const i = text.indexOf(start);
  const j = text.indexOf(end, i + 1);
  return i !== -1 && j !== -1 ? text.slice(0, i) + block + text.slice(j + end.length) : null;
}

export function upsertBlock(text, start, end, body) {
  const block = `${start}\n${body}\n${end}`;
  const replaced = replaceBlock(text, start, end, block);
  if (replaced !== null) return replaced;
  if (!text) return `${block}\n`;
  return `${text}${text.endsWith('\n') ? '' : '\n'}\n${block}\n`;
}

// For scripts: put the block right after the first line (the shebang), so a
// later `exit` or `exec` cannot skip it.
export function upsertBlockAfterFirstLine(text, start, end, body) {
  const block = `${start}\n${body}\n${end}`;
  const replaced = replaceBlock(text, start, end, block);
  if (replaced !== null) return replaced;
  const nl = text.indexOf('\n');
  if (nl === -1) return `${text}\n${block}\n`;
  return `${text.slice(0, nl + 1)}${block}\n${text.slice(nl + 1)}`;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function isOurs(command, agent, event) {
  return new RegExp(`(^|\\s)hook ${escapeRe(agent)} ${escapeRe(event)}(\\s|$)`).test(command);
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
