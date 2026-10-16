import { TEST_PATH } from '../check/patterns.js';
import { repoTextFiles } from '../scan/files.js';
import { symbolName } from './checks.js';

// Called by the framework rather than by the application's own code.
const ENTRY_POINTS = new Set([
  'handle', 'render', 'mount', 'boot', 'booted', 'register', '__construct', '__invoke', 'constructor',
  'main', 'up', 'down', 'rules', 'authorize', 'messages', 'setUp', 'tearDown', 'run', 'execute',
  'index', 'show', 'store', 'update', 'destroy', 'create', 'edit', 'call', 'invoke', 'init',
]);

const EXPORT_OR_IMPORT = /^\s*(module\.exports\b|exports\.\w+\s*=|export\s*(\{|\*|default\b)|import\b|from\s+\S+\s+import\b|use\s+[\w\\]+)/;

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The names the code calls a method by: a Laravel scopeActive is called as active(),
// getFirstNameAttribute is read as first_name.
function aliases(name) {
  const lc = (s) => s.charAt(0).toLowerCase() + s.slice(1);
  const scope = name.match(/^scope([A-Z]\w*)$/);
  if (scope) return [name, lc(scope[1])];
  const attr = name.match(/^[gs]et([A-Z]\w*)Attribute$/);
  if (attr) return [name, lc(attr[1]).replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)];
  return [name];
}

// Heuristic: for each method cited as enforcement, count the lines that mention its name,
// outside its own declaration, in non-test and in test files.
export function reachability(root, cards) {
  const targets = new Map();
  for (const card of cards) {
    if (card.kind !== 'rule' || card.meta.status === 'retired') continue;
    for (const ev of card.evidence) {
      if (ev.kind !== 'enforcement' || !ev.symbol) continue;
      const name = symbolName(ev.symbol);
      // a bare capitalised name is a class: imports and type hints reference it everywhere
      if (!name || ENTRY_POINTS.has(name) || (/^[A-Z]/.test(name) && !/::|->|\.|#/.test(ev.symbol))) continue;
      if (!targets.has(name)) targets.set(name, new Set());
      targets.get(name).add(card.id);
    }
  }
  if (!targets.size) return [];
  const files = repoTextFiles(root);
  const findings = [];
  for (const [name, rules] of targets) {
    const called = aliases(name).map(escape).join('|');
    const word = new RegExp(`(^|[^\\w$])\\$?(${called})(?![\\w])`);
    const declaration = new RegExp(`\\b(function|def|fn|func|sub)\\s+&?${escape(name)}\\b|^\\s*(async\\s+)?${escape(name)}\\s*\\([^)]*\\)\\s*\\{`);
    let app = 0;
    let tests = 0;
    for (const f of files) {
      for (const line of f.text.split('\n')) {
        // a declaration, an export list or an import is not a call
        if (!word.test(line) || declaration.test(line) || EXPORT_OR_IMPORT.test(line)) continue;
        if (TEST_PATH.test(f.path)) tests++; else app++;
      }
    }
    if (app > 0) continue;
    for (const rule of rules) findings.push({ rule, name, reason: tests > 0 ? 'is only referenced by tests' : 'is never referenced' });
  }
  return findings.sort((a, b) => (a.rule < b.rule ? -1 : a.rule > b.rule ? 1 : 0));
}
