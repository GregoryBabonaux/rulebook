import fs from 'node:fs';
import path from 'node:path';
import { git } from '../git.js';
import { SUPPORTED_FORMAT } from '../project.js';
import { ADAPTERS, PARTIAL_AGENTS, defaultBin, hookCommand } from './agents.js';
import { upsertBlock, upsertBlockAfterFirstLine, toLf, matchEol } from './writers.js';

const readOrNull = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);
const SHELL_SHEBANG = /^#!.*\b(sh|bash|dash|zsh)\b/;

export function detectAgents(root) {
  return ADAPTERS.filter((a) => a.detect.some((p) => fs.existsSync(path.join(root, p)))).map((a) => a.agent);
}

function gitPath(root, name, fallback) {
  const rel = git(root, ['rev-parse', '--git-path', name])?.trim() || fallback;
  return path.resolve(root, rel);
}

// Where the pre-commit block goes: { rel, script } or { warning }.
function preCommitTarget(root) {
  const rel = path.relative(root, gitPath(root, 'hooks', '.git/hooks')).replace(/\\/g, '/');
  if (rel.startsWith('..') || path.isAbsolute(rel)) return { warning: 'hooks path is outside the repository, pre-commit left untouched' };
  // husky v9 points core.hooksPath at the generated .husky/_ ; the user-owned file is .husky/pre-commit
  if (rel === '.husky/_') return { rel: '.husky/pre-commit', script: false };
  return { rel: `${rel}/pre-commit`, script: true };
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
    if (before !== null && toLf(before) === toLf(after)) return;
    changes.push({ path: rel, before, after: matchEol(before, after), ...(mode ? { mode } : {}) });
  };
  const current = (rel) => {
    const text = readOrNull(path.join(root, rel));
    return text === null ? null : toLf(text);
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
    const text = current(adapter.file);
    if (adapter.kind === 'json') {
      let json = {};
      if (text !== null) {
        try { json = JSON.parse(text); } catch { warnings.push(`cannot parse ${adapter.file}, left untouched`); continue; }
      }
      add(adapter.file, `${JSON.stringify(adapter.apply(json, cmd(name)), null, 2)}\n`);
    } else {
      add(adapter.file, adapter.apply(text ?? '', cmd(name)));
    }
    if (adapter.note) notes.push(adapter.note);
  }

  add('AGENTS.md', upsertBlock(current('AGENTS.md') ?? '', '<!-- rulebook:start -->', '<!-- rulebook:end -->', agentsBlock(bin, version)));

  const target = preCommitTarget(root);
  const hookLine = `${bin} check --staged --stamp ${version} || true`;
  if (target.warning) {
    warnings.push(target.warning);
  } else {
    const hook = current(target.rel);
    if (hook === null) {
      add(target.rel, upsertBlock('#!/bin/sh\n', '# >>> rulebook', '# <<< rulebook', hookLine), 0o755);
    } else if (!target.script) {
      add(target.rel, upsertBlock(hook, '# >>> rulebook', '# <<< rulebook', hookLine));
    } else if (SHELL_SHEBANG.test(hook)) {
      add(target.rel, upsertBlockAfterFirstLine(hook, '# >>> rulebook', '# <<< rulebook', hookLine), 0o755);
    } else {
      warnings.push('pre-commit is not a shell script, left untouched');
    }
  }

  const cfgRel = 'rulebook/config.json';
  const cfgText = current(cfgRel);
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

// Backups live under .git/rulebook-backup/ so they are never committed by accident.
export function applyChanges(root, changes) {
  const backupDir = gitPath(root, 'rulebook-backup', '.git/rulebook-backup');
  for (const c of changes) {
    const abs = path.join(root, c.path);
    const backup = path.join(backupDir, c.path);
    if (c.before !== null && !fs.existsSync(backup)) {
      fs.mkdirSync(path.dirname(backup), { recursive: true });
      fs.writeFileSync(backup, c.before);
    }
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, c.after);
    if (c.mode) fs.chmodSync(abs, c.mode);
  }
}

export function runInit(io, opts, version) {
  const root = git(io.cwd, ['rev-parse', '--show-toplevel'])?.trim();
  if (!root) { io.stderr.write('rulebook: init must run inside a git repository\n'); return 1; }
  const agents = opts.agents ?? detectAgents(root);
  const bin = opts.bin ?? defaultBin(version);
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
