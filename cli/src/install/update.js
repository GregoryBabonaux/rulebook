import fs from 'node:fs';
import path from 'node:path';
import { git } from '../git.js';
import { ADAPTERS, defaultBin, PINNED_NPX_BIN } from './agents.js';
import { planInit, applyChanges } from './init.js';

export function installedAgents(root) {
  return ADAPTERS.filter((a) => {
    const file = path.join(root, a.file);
    return fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes(` hook ${a.agent} `);
  }).map((a) => a.agent);
}

function storedBin(root) {
  try { return JSON.parse(fs.readFileSync(path.join(root, 'rulebook/config.json'), 'utf8')).bin ?? null; } catch { return null; }
}

export function runUpdate(io, opts, version) {
  const root = git(io.cwd, ['rev-parse', '--show-toplevel'])?.trim();
  if (!root) { io.stderr.write('rulebook: update must run inside a git repository\n'); return 1; }
  const agents = installedAgents(root);
  const stored = storedBin(root);
  // a bin pinned by a previous init is re-pinned to this version
  const bin = opts.bin ?? (stored && !PINNED_NPX_BIN.test(stored) ? stored : defaultBin(version));
  const { changes, warnings } = planInit(root, { agents, bin, version });
  for (const w of warnings) io.stderr.write(`rulebook: ${w}\n`);
  applyChanges(root, changes);
  io.stdout.write(`rulebook: updated for ${agents.length ? agents.join(', ') : 'no agent (universal layers only)'} (${changes.length} file(s) changed)\n`);
  io.stdout.write('rulebook: skills are updated by the channel you installed them from:\n');
  io.stdout.write('  claude plugin update rulebook@<marketplace>   (Claude Code plugin)\n');
  io.stdout.write('  npx skills update                              (skills.sh)\n');
  return 0;
}
