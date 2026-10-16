import fs from 'node:fs';
import path from 'node:path';
import { git } from '../git.js';
import { ADAPTERS, defaultBin, PINNED_NPX_BIN } from './agents.js';
import { planInit, applyChanges } from './init.js';
import { refreshStampedSkills } from './skills.js';

const CHANNELS = [
  'rulebook: skills installed by another channel are updated there:\n',
  '  claude plugin update rulebook@rulebook   (Claude Code plugin)\n',
  '  npx skills update                        (skills.sh)\n',
];

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
  // skill copies first: they live in the home directory and need no repository
  const refreshed = refreshStampedSkills(io.env, version);
  if (refreshed) io.stdout.write(`rulebook: refreshed ${refreshed} skill cop${refreshed === 1 ? 'y' : 'ies'} installed by rulebook skills\n`);

  const root = git(io.cwd, ['rev-parse', '--show-toplevel'])?.trim();
  const agents = root ? installedAgents(root) : [];
  // only refresh a project that rulebook already set up: never install by surprise
  if (!root || (!agents.length && !fs.existsSync(path.join(root, 'rulebook', 'config.json')))) {
    io.stdout.write('rulebook: no rulebook installation in this repository — run rulebook init to install the companion\n');
    for (const line of CHANNELS) io.stdout.write(line);
    return 0;
  }
  const stored = storedBin(root);
  // a bin pinned by a previous init is re-pinned to this version
  const bin = opts.bin ?? (stored && !PINNED_NPX_BIN.test(stored) ? stored : defaultBin(version));
  const { changes, warnings } = planInit(root, { agents, bin, version });
  for (const w of warnings) io.stderr.write(`rulebook: ${w}\n`);
  applyChanges(root, changes);
  io.stdout.write(`rulebook: updated for ${agents.length ? agents.join(', ') : 'no agent (universal layers only)'} (${changes.length} file(s) changed)\n`);
  for (const line of CHANNELS) io.stdout.write(line);
  return 0;
}
