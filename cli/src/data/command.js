import fs from 'node:fs';
import path from 'node:path';
import { loadProject } from '../project.js';
import { readTables } from './read.js';

const USAGE = 'usage: rulebook data <source> tables | rulebook data <source> rows <table> [--where col=value] [--where col!=value] [--columns a,b] [--limit n] [--count]';

function parseArgs(args) {
  const o = { positional: [], where: [], columns: null, limit: 50, count: false, dir: 'rulebook' };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--where') {
      const m = (args[++i] ?? '').match(/^([^!=]+)(!?=)(.*)$/);
      if (m) o.where.push({ column: m[1].trim(), not: m[2] === '!=', value: m[3] });
    } else if (a === '--columns') o.columns = (args[++i] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--limit') o.limit = Math.max(0, Number(args[++i]) || 0);
    else if (a === '--count') o.count = true;
    else if (a === '--dir') o.dir = args[++i] ?? 'rulebook';
    else o.positional.push(a);
  }
  return o;
}

const asText = (v) => (v === null || v === undefined ? 'NULL' : String(v));

// Read-only queries on a SQL dump or a JSON export, for the skills to look at data the rules
// depend on (rates, settings, statuses) when no database server is at hand.
export function runData(io, args) {
  const o = parseArgs(args);
  const [name, sub, tableName] = o.positional;
  if (!name || !['tables', 'rows'].includes(sub) || (sub === 'rows' && !tableName)) {
    io.stderr.write(`rulebook: ${USAGE}\n`);
    return 1;
  }
  let project = null;
  try { project = loadProject(io.cwd, o.dir); } catch { project = null; }
  const declared = (project?.config.data?.sources ?? []).find((s) => s.name === name);
  if (declared && declared.kind === 'mcp') {
    io.stderr.write(`rulebook: "${name}" is an MCP server: query it with your agent's database tool, read only\n`);
    return 1;
  }
  const rel = declared?.path ?? name;
  const base = declared && project ? project.root : io.cwd;
  const file = path.resolve(base, rel);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    io.stderr.write(`rulebook: "${name}" is neither a declared data source nor a file\n`);
    return 1;
  }
  let tables;
  try { tables = readTables(file, fs.readFileSync(file, 'utf8')); } catch (err) {
    io.stderr.write(`rulebook: cannot read ${rel} (${err.message})\n`);
    return 1;
  }
  if (sub === 'tables') {
    for (const [t, { columns, rows }] of Object.entries(tables)) {
      io.stdout.write(`${t} · ${rows.length} row${rows.length === 1 ? '' : 's'} · ${columns.join(', ')}\n`);
    }
    return 0;
  }
  const table = tables[tableName];
  if (!table) {
    io.stderr.write(`rulebook: no table "${tableName}" in ${rel.replace(/\\/g, '/')} (tables: ${Object.keys(tables).join(', ')})\n`);
    return 1;
  }
  const rows = table.rows.filter((r) => o.where.every((w) => (asText(r[w.column]) === w.value) !== w.not));
  if (o.count) {
    io.stdout.write(`${rows.length}\n`);
    return 0;
  }
  for (const r of rows.slice(0, o.limit)) {
    const shown = o.columns ? Object.fromEntries(o.columns.map((c) => [c, r[c] ?? null])) : r;
    io.stdout.write(`${JSON.stringify(shown)}\n`);
  }
  return 0;
}
