import path from 'node:path';

// Tables of a SQL dump (MySQL or PostgreSQL: CREATE TABLE, INSERT … VALUES, COPY … FROM stdin)
// or of a JSON export (an object of arrays keyed by table, or one array named after the file).
// Values stay strings as written in the dump; NULL becomes null. The whole file is read:
// fine for the reference data rules depend on, not meant for multi-gigabyte production dumps.
export function readTables(file, text) {
  if (/\.json$/i.test(file)) return fromJson(file, text);
  return fromSql(text);
}

function fromJson(file, text) {
  const value = JSON.parse(text);
  const tables = {};
  const add = (name, rows) => {
    const objects = rows.filter((r) => r && typeof r === 'object' && !Array.isArray(r));
    const columns = [];
    for (const r of objects) for (const k of Object.keys(r)) if (!columns.includes(k)) columns.push(k);
    tables[name] = { columns, rows: objects };
  };
  if (Array.isArray(value)) add(path.basename(file).replace(/\.json$/i, ''), value);
  else for (const [name, rows] of Object.entries(value ?? {})) if (Array.isArray(rows)) add(name, rows);
  return tables;
}

const unquote = (name) => name.split('.').map((p) => p.trim().replace(/^[`"[]|[`"\]]$/g, '')).join('.');

// Splits a SQL text into statements at semicolons outside quotes and comments; a COPY … FROM
// stdin statement carries its data block (lines up to "\.").
function* statements(text) {
  let i = 0;
  const n = text.length;
  while (i < n) {
    while (i < n && /\s/.test(text[i])) i++;
    if (text.startsWith('--', i) || text[i] === '#') { i = text.indexOf('\n', i); if (i < 0) return; continue; }
    if (text.startsWith('/*', i)) { i = text.indexOf('*/', i); if (i < 0) return; i += 2; continue; }
    if (i >= n) return;
    const start = i;
    let quote = null;
    for (; i < n; i++) {
      const c = text[i];
      if (quote) {
        if (c === '\\' && quote !== '`') { i++; continue; }
        if (c === quote) { if (text[i + 1] === quote) { i++; continue; } quote = null; }
        continue;
      }
      if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
      if (c === ';') break;
    }
    const stmt = text.slice(start, i).trim();
    i++;
    if (/^COPY\s/i.test(stmt) && /FROM\s+stdin/i.test(stmt)) {
      const nl = text.indexOf('\n', i - 1);
      const end = text.indexOf('\n\\.', nl);
      const block = end < 0 ? text.slice(nl + 1) : text.slice(nl + 1, end + 1);
      i = end < 0 ? n : end + 3;
      yield { stmt, block };
    } else if (stmt) {
      yield { stmt };
    }
  }
}

function splitTopLevel(body) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let cur = '';
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (quote) {
      cur += c;
      if (c === '\\' && quote !== '`') { cur += body[++i] ?? ''; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') quote = c;
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (c === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

const NOT_COLUMN = /^(PRIMARY|KEY|UNIQUE|INDEX|CONSTRAINT|FOREIGN|CHECK|FULLTEXT|SPATIAL|EXCLUDE)\b/i;

function columnsOf(body) {
  return splitTopLevel(body)
    .filter((def) => !NOT_COLUMN.test(def))
    .map((def) => unquote(def.match(/^(`[^`]+`|"[^"]+"|\[[^\]]+\]|[\w$]+)/)?.[1] ?? ''))
    .filter(Boolean);
}

function parseValue(token) {
  const t = token.trim();
  if (/^NULL$/i.test(t)) return null;
  const q = t[0];
  if ((q === "'" || q === '"') && t.endsWith(q)) {
    return t.slice(1, -1)
      .replace(new RegExp(`${q}${q}`, 'g'), q)
      .replace(/\\(.)/g, (_, c) => ({ n: '\n', r: '\r', t: '\t', 0: '\0', Z: '\x1a' })[c] ?? c);
  }
  return t;
}

// "(1,'a'),(2,'b')" → [['1','a'], ['2','b']]
function tuples(values) {
  const out = [];
  let depth = 0;
  let quote = null;
  let start = -1;
  for (let i = 0; i < values.length; i++) {
    const c = values[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) { if (values[i + 1] === quote) { i++; continue; } quote = null; }
      continue;
    }
    if (c === "'" || c === '"') { quote = c; continue; }
    if (c === '(') { if (depth === 0) start = i + 1; depth++; }
    if (c === ')') { depth--; if (depth === 0) out.push(splitTopLevel(values.slice(start, i)).map(parseValue)); }
  }
  return out;
}

function fromSql(text) {
  const tables = {};
  const table = (name) => (tables[name] ??= { columns: [], rows: [] });
  for (const { stmt, block } of statements(text)) {
    let m;
    if ((m = stmt.match(/^CREATE\s+(?:TEMPORARY\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([^\s(]+)\s*\(([\s\S]*)\)[^)]*$/i))) {
      table(unquote(m[1])).columns = columnsOf(m[2]);
    } else if ((m = stmt.match(/^INSERT\s+(?:IGNORE\s+)?INTO\s+([^\s(]+)\s*(\(([^)]*)\))?\s*VALUES\s*([\s\S]*)$/i))) {
      const t = table(unquote(m[1]));
      const cols = m[3] ? m[3].split(',').map(unquote) : t.columns;
      if (!t.columns.length) t.columns = cols;
      for (const values of tuples(m[4])) t.rows.push(Object.fromEntries(cols.map((c, k) => [c, values[k] ?? null])));
    } else if (block !== undefined && (m = stmt.match(/^COPY\s+([^\s(]+)\s*\(([^)]*)\)/i))) {
      const t = table(unquote(m[1]));
      const cols = m[2].split(',').map(unquote);
      if (!t.columns.length) t.columns = cols;
      for (const line of block.split('\n')) {
        if (!line) continue;
        const cells = line.split('\t').map((v) => (v === '\\N' ? null : v.replace(/\\(.)/g, (_, c) => ({ n: '\n', t: '\t', r: '\r' })[c] ?? c)));
        t.rows.push(Object.fromEntries(cols.map((c, k) => [c, cells[k] ?? null])));
      }
    }
  }
  return tables;
}
