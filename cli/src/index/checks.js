import { TEST_PATH } from '../check/patterns.js';

// How far above the cited lines a symbol's declaration may sit (a method cited by its body).
const LOOKBACK = 400;

// "OrderPolicy::refund" → "refund"; "Mode::$except" → "except"; "App\\Foo" → "Foo"; "fn()" → "fn"
export function symbolName(symbol) {
  const last = symbol.trim().split(/::|->|\.|#|\\|\//).filter(Boolean).pop() ?? '';
  return last.replace(/^\$/, '').replace(/\(.*$/, '').trim();
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Mechanical checks on one evidence line against the cited file's lines. Returns reasons.
export function checkEvidence(ev, lines) {
  const reasons = [];
  if (ev.symbol) {
    const name = symbolName(ev.symbol);
    if (name) {
      const re = new RegExp(`(^|[^\\w$])\\$?${escape(name)}(?![\\w])`);
      const from = Math.max(0, ev.start - 1 - LOOKBACK);
      const found = lines.slice(from, ev.end).some((l) => re.test(l));
      if (!found) reasons.push(`symbol "${name}" not found in or above these lines`);
    }
  }
  const inTests = TEST_PATH.test(ev.path);
  if (ev.kind === 'test' && !inTests) reasons.push('test evidence outside a test file');
  if (ev.kind === 'enforcement' && inTests) reasons.push('enforcement evidence inside a test file');
  return reasons;
}
