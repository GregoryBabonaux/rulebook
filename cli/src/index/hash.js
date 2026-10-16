import { createHash } from 'node:crypto';

export function splitLines(text) {
  return text.replace(/\r\n?/g, '\n').split('\n');
}

export function normalizeLines(lines) {
  return lines.map((l) => l.replace(/\s+/g, ' ').trim()).filter((l) => l !== '').join('\n');
}

export function hashText(text) {
  return createHash('sha1').update(text).digest('hex').slice(0, 12);
}

export function hashRange(lines, start, end) {
  return hashText(normalizeLines(lines.slice(start - 1, end)));
}

export function findRange(lines, hash, length, hint = 1) {
  let best = null;
  for (let s = 1; s + length - 1 <= lines.length; s++) {
    if (hashRange(lines, s, s + length - 1) !== hash) continue;
    if (best === null || Math.abs(s - hint) < Math.abs(best - hint)) best = s;
  }
  return best;
}
