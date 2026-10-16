import { splitLines, findRange, hashText } from '../index/hash.js';
import { matchesAny } from './globs.js';
import { isRuleBearing, TEST_PATH } from './patterns.js';

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function symbolPresent(text, symbol) {
  if (!symbol) return true;
  const name = symbol.split(/::|->|[.#]/).pop().replace(/\(.*$/, '');
  if (!name) return true;
  return new RegExp(`\\b${escapeRe(name)}\\b`).test(text);
}

const keyOf = (type, rule, path) => hashText(`${type}|${rule ?? ''}|${path}`);

export function detect({ index, diffs, readFile, hotspots = [], rulebookDir = 'rulebook' }) {
  const detections = [];
  for (const f of diffs) {
    if (f.path.startsWith(`${rulebookDir}/`)) continue;
    const anchors = index.anchors.filter((a) => a.path === f.path || a.path === f.oldPath);
    const text = f.status === 'deleted' ? null : readFile(f.path);
    const lines = text == null ? null : splitLines(text);
    const covered = [];
    const reported = new Set();

    for (const a of anchors) {
      const len = a.lines[1] - a.lines[0] + 1;
      const at = lines ? findRange(lines, a.hash, len, a.lines[0]) : null;
      if (at !== null) { covered.push([at, at + len - 1]); continue; }
      covered.push(a.lines);
      const type = lines && symbolPresent(text, a.symbol) ? 'modified?' : 'removed?';
      if (reported.has(`${type}|${a.rule}`)) continue;
      reported.add(`${type}|${a.rule}`);
      detections.push({ type, rule: a.rule, path: f.path, lines: a.lines, key: keyOf(type, a.rule, f.path) });
    }

    if (!lines || TEST_PATH.test(f.path)) continue;
    const hot = matchesAny(f.path, hotspots);
    for (const h of f.hunks) {
      if (!h.added.length) continue;
      const bearing = hot ? h.added.some((l) => l.trim() !== '') : h.added.some(isRuleBearing);
      if (!bearing) continue;
      const s = h.newStart;
      const e = h.newStart + h.added.length - 1;
      if (covered.some(([as, ae]) => s <= ae && e >= as)) continue;
      detections.push({ type: 'new?', rule: null, path: f.path, lines: [s, e], key: keyOf('new?', null, f.path) });
      break;
    }
  }
  return detections;
}
