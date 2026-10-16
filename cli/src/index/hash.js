import { createHash } from 'node:crypto';

export function splitLines(text) {
  return text.replace(/\r\n?/g, '\n').split('\n');
}

const normLine = (l) => l.replace(/\s+/g, ' ').trim();

export function normalizeLines(lines) {
  return lines.map(normLine).filter((l) => l !== '').join('\n');
}

export function hashText(text) {
  return createHash('sha1').update(text).digest('hex').slice(0, 12);
}

// Identity of an evidence range: hash of its non-blank normalised lines,
// how many there are, and the hash of the first one (cheap pre-filter).
export function fingerprint(lines, start, end) {
  const kept = lines.slice(start - 1, end).map(normLine).filter((l) => l !== '');
  return { hash: hashText(kept.join('\n')), size: kept.length, head: kept.length ? hashText(kept[0]) : null };
}

export function hashRange(lines, start, end) {
  return fingerprint(lines, start, end).hash;
}

// Returns the raw line span { start, end } whose non-blank lines match the
// fingerprint, nearest to `hint`, or null. Blank lines inside the span are ignored.
export function findRange(lines, fp, hint = 1) {
  if (!fp.size) return null;
  const kept = [];
  lines.forEach((l, i) => {
    const n = normLine(l);
    if (n) kept.push({ n, line: i + 1 });
  });
  const last = kept.length - fp.size;
  if (last < 0) return null;
  const order = Array.from({ length: last + 1 }, (_, i) => i)
    .sort((a, b) => Math.abs(kept[a].line - hint) - Math.abs(kept[b].line - hint));
  for (const i of order) {
    if (fp.head && hashText(kept[i].n) !== fp.head) continue;
    const window = kept.slice(i, i + fp.size);
    if (hashText(window.map((k) => k.n).join('\n')) === fp.hash) {
      return { start: window[0].line, end: window[window.length - 1].line };
    }
  }
  return null;
}
