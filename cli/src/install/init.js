import fs from 'node:fs';
import path from 'node:path';
import { git } from '../git.js';
import { SUPPORTED_FORMAT } from '../project.js';
import { ADAPTERS, PARTIAL_AGENTS, DEFAULT_BIN, hookCommand } from './agents.js';
import { upsertBlock } from './writers.js';

const readOrNull = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);

export function detectAgents(root) {
  return ADAPTERS.filter((a) => a.detect.some((p) => fs.existsSync(path.join(root, p)))).map((a) => a.agent);
}

function hooksDir(root) {
  const rel = git(root, ['rev-parse', '--git-path', 'hooks'])?.trim() || '.git/hooks';
  return path.relative(root, path.resolve(root, rel)).replace(/\\/g, '/');
}

function agentsBlock(bin, version) {
  return [
    `<!-- rulebook ${version} -->`,
    '## Business rules (rulebook)',
    '',
    'This project keeps its business rules in `rulebook/`. After you change validation, permissions,',
    `calculations, states or deadlines, run \`${bin} check\` and mention its output to the user.`,
    'Do not edit `rulebook/` cards by hand: use the rulebook skills.',
  ].join('\n');
}

export function planInit(root, { agents, bin, version }) {
  const changes = [];
  const warnings = [];
  const notes = [];
  const add = (rel, after, mode) => {
    const before = readOrNull(path.join(root, rel));
    if (before !== after) changes.push({ path: rel, before, after, ...(mode ? { mode } : {}) });
  };
  const cmd = (agent) => (event) => hookCommand(bin, agent, event, version);

  for (const name of agents) {
    const adapter = ADAPTERS.find((a) => a.agent === name);
    if (!adapter) {
      warnings.push(PARTIAL_AGENTS.includes(name)
        ? `${name}: partial support (AGENTS.md and pre-commit only)`
        : `unknown agent "${name}"`);
      continue;
    }
    const current = readOrNull(path.join(root, adapter.file));
    if (adapter.kind === 'json') {
      let json = {};
      if (current !== null) {
        try { json = JSON.parse(current); } catch { warnings.push(`cannot parse ${adapter.file}, left untouched`); continue; }
      }
      add(adapter.file, `${JSON.stringify(adapter.apply(json, cmd(name)), null, 2)}\n`);
    } else {
      add(adapter.file, adapter.apply(current ?? '', cmd(name)));
    }
    if (adapter.note) notes.push(adapter.note);
  }

  add('AGENTS.md', upsertBlock(readOrNull(path.join(root, 'AGENTS.md')) ?? '', '<!-- rulebook:start -->', '<!-- rulebook:end -->', agentsBlock(bin, version)));

  const preCommit = `${hooksDir(root)}/pre-commit`;
  const existingHook = readOrNull(path.join(root, preCommit));
  add(preCommit, upsertBlock(existingHook ?? '#!/bin/sh\n', '# >>> rulebook', '# <<< rulebook', `${bin} check --staged --stamp ${version} || true`), 0o755);

  const cfgRel = 'rulebook/config.json';
  const cfgText = readOrNull(path.join(root, cfgRel));
  let config = { formatVersion: SUPPORTED_FORMAT, language: 'en', repoUrl: null, hotspots: [] };
  if (cfgText !== null) {
    try { config = JSON.parse(cfgText); } catch { warnings.push(`cannot parse ${cfgRel}, left untouched`); config = null; }
  }
  if (config) {
    config.formatVersion ??= SUPPORTED_FORMAT;
    config.bin = bin;
    add(cfgRel, `${JSON.stringify(config, null, 2)}\n`);
  }
  return { changes, warnings, notes };
}

export function applyChanges(root, changes) {
  for (const c of changes) {
    const abs = path.join(root, c.path);
    if (c.before !== null && !fs.existsSync(`${abs}.rulebook.bak`)) fs.writeFileSync(`${abs}.rulebook.bak`, c.before);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, c.after);
    if (c.mode) fs.chmodSync(abs, c.mode);
  }
}

export function runInit(io, opts, version) {
  const root = git(io.cwd, ['rev-parse', '--show-toplevel'])?.trim();
  if (!root) { io.stderr.write('rulebook: init must run inside a git repository\n'); return 1; }
  const agents = opts.agents ?? detectAgents(root);
  const bin = opts.bin ?? DEFAULT_BIN;
  const { changes, warnings, notes } = planInit(root, { agents, bin, version });
  for (const w of warnings) io.stderr.write(`rulebook: ${w}\n`);
  if (!changes.length) { io.stdout.write('rulebook: nothing to change\n'); return 0; }
  for (const c of changes) io.stdout.write(`${c.before === null ? '+ create' : '~ update'} ${c.path}\n`);
  if (!opts.yes || opts.dryRun) { io.stdout.write('rulebook: re-run with --yes to apply\n'); return 0; }
  applyChanges(root, changes);
  for (const n of notes) io.stdout.write(`rulebook: ${n}\n`);
  io.stdout.write(`rulebook: initialised for ${agents.length ? agents.join(', ') : 'no agent (universal layers only)'}\n`);
  return 0;
}
