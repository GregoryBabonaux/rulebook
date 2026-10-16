import { hashText } from '../index/hash.js';
import { globToRegExp } from '../check/globs.js';

// Line-based detection of decision points. Each family is a list of patterns; the first
// family that matches wins, in this order. It is not a parser: it finds the lines worth a
// look, and the scan output says so.
const FAMILIES = [
  ['authorization', [
    /\bGate::|->authorize\(|->can\(|@can\b|@PreAuthorize|@(login|permission)_required|\bauthorize!?\(/,
    /\babort_(unless|if)\s*\([^,]*(can\(|isAdmin|hasRole|isHost|is_admin|hasPermission|role)/,
  ]],
  ['validation', [
    /(['"]|\|)(required|nullable|min:\d|max:\d|between:|regex:|unique:|exists:|in:|after:|before:|confirmed|digits:)/,
    /->validate\(|\bValidator::make\(|\bRule::\w+\(|@(Valid|NotNull|NotBlank|Size|Min|Max|Pattern)\b|\bvalidates?\s+:\w+/,
  ]],
  ['limit', [/\bRateLimiter\b|\bthrottle\b|\brate_?limit|\bRateLimit\b/i]],
  ['guard', [
    /\b(throw|raise)\b/,
    /\babort(_if|_unless)?\s*\(/,
    /->fail\(|\bHttpException\b|\bres\.status\(\s*4\d\d|\bstatus\(\s*4\d\d|\bresponse\(\)[^;]*\b4\d\d\b/,
  ]],
  ['condition', [
    // a comparison with a number ("=>" and "->" are not comparisons)
    /(<=|>=|===|!==|==|!=|<(?![<=])|(?<![=\->])>(?![>=]))\s*-?\d+(\.\d+)?\b/,
    /-?\b\d+(\.\d+)?\s*(<=|>=|===|!==|==|!=|<(?![<=])|(?<![=\->])>(?![>=]))\s*[$\w(]/,
    // a condition on a quoted value
    /\b(if|elseif|elif|else if|while|unless|when|case)\b.*(===|!==|==|!=|\bin_array\(|\bin\s*\[)\s*['"]/,
  ]],
  ['state', [
    /\b(status|state|phase|stage)\b['"]?\s*(=>|=(?!=)|:(?!:))\s*\S/,
    /\b(transitionTo|markAs\w+)\s*\(/,
  ]],
  ['constant', [
    /^\s*(?:(?:public|private|protected|static|final|export|readonly)\s+)*(?:const|let|var|final\s+\w+|static\s+final\s+\w+)?\s*[A-Z][A-Z0-9_]{2,}\s*(?::\s*[\w<>[\]]+\s*)?=\s*-?\d/,
    /\bdefine\(\s*['"][A-Z][A-Z0-9_]+['"]\s*,\s*-?\d/,
  ]],
  ['config', [/\bconfig\(\s*['"]|\benv\(\s*['"]|\bprocess\.env\.|\bos\.environ|\bgetenv\(|\bSetting::get\(|\bsettings\.[A-Z]/]],
  ['schedule', [/->(daily|hourly|weekly|monthly|yearly|dailyAt|twiceDaily|cron|every\w+)\(|@Scheduled|\bcron\.schedule\(/]],
];

const SCHEMA_FILE = /(^|\/)(migrations?|schema|prisma)\/|\.sql$|(^|\/)models?\.py$|schema\.(rb|prisma)$/i;
const SCHEMA = /->(unique|nullable|default|foreign|constrained|primary|unsigned)\(|\b(UNIQUE|NOT NULL|CHECK\s*\(|REFERENCES|DEFAULT)\b|\bunique\s*[:=]\s*(true|True)|\bnull\s*=\s*False|on(Delete|Update)\(|(restrict|cascade|null)OnDelete\(/;

// comments, and PHP attributes such as #[On('position-confirmed')]
const COMMENT = /^(\/\/|#|\*|\/\*|--|<!--|\{\{--)/;
const IMPORT = /^(use|import|from|require|using|package|namespace|#include)\b/;

export function classifyLine(line, file) {
  const code = line.trim();
  if (!code || COMMENT.test(code) || IMPORT.test(code)) return null;
  if (SCHEMA_FILE.test(file) && SCHEMA.test(code)) return 'schema';
  for (const [kind, patterns] of FAMILIES) {
    if (patterns.some((re) => re.test(code))) return kind;
  }
  return null;
}

const norm = (l) => l.replace(/\s+/g, ' ').trim();

// Points of one file. The key hashes the path, the normalised line and its occurrence
// rank among identical lines, so it survives moves and reformatting.
export function findPoints(file, text) {
  const seen = new Map();
  const points = [];
  text.replace(/\r\n?/g, '\n').split('\n').forEach((line, i) => {
    const kind = classifyLine(line, file);
    if (!kind) return;
    const n = norm(line);
    const rank = (seen.get(n) ?? 0) + 1;
    seen.set(n, rank);
    points.push({ key: hashText(`${file}\n${n}\n${rank}`), path: file, line: i + 1, kind, text: n });
  });
  return points;
}

function expandBraces(token) {
  const m = token.match(/^(.*?)\{([^{}]*)\}(.*)$/);
  if (!m) return [token];
  return m[2].split(',').flatMap((alt) => expandBraces(`${m[1]}${alt.trim()}${m[3]}`));
}

const CODE_LABEL = /^(code|files|fichiers|código|codigo|codice|dateien)$/i;

// Paths and globs named in a domain's Code detail: backticked tokens that look like paths.
export function codePaths(text) {
  const out = [];
  for (const [, token] of text.matchAll(/`([^`]+)`/g)) {
    for (const t of expandBraces(token.trim())) {
      if (!t.includes('/') && !/\.\w{1,6}$/.test(t)) continue;
      if (/\s/.test(t)) continue;
      if (t.endsWith('/')) out.push(`${t}**`);
      else if (!/[*?]/.test(t) && !/\.\w{1,6}$/.test(t)) out.push(`${t}/**`);
      else out.push(t);
    }
  }
  return out;
}

export function domainGlobs(domains) {
  return domains.map((d) => ({
    code: d.code,
    globs: (d.details ?? []).filter((x) => CODE_LABEL.test(x.label.trim())).flatMap((x) => codePaths(x.text)),
  }));
}

export function domainsFor(file, domains) {
  return domainGlobs(domains)
    .filter((d) => d.globs.some((g) => globToRegExp(g).test(file)))
    .map((d) => d.code);
}

export function parseNotRules(text) {
  const map = new Map();
  for (const line of (text ?? '').replace(/\r\n?/g, '\n').split('\n')) {
    const m = line.match(/^-\s+([0-9a-f]{12})\s+·\s+[^·]*·\s+(.+?)\s*$/);
    if (m) map.set(m[1], m[2]);
  }
  return map;
}
