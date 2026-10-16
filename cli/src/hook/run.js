import fs from 'node:fs';
import path from 'node:path';
import { checkProject } from '../check/run.js';
import { repoRoot } from '../git.js';
import { ADAPTERS } from '../install/agents.js';
import { formatHookOutput } from './formats.js';

function payloadCwd(stdin) {
  try {
    const payload = JSON.parse(stdin);
    return typeof payload?.cwd === 'string' && payload.cwd ? payload.cwd : null;
  } catch {
    return null;
  }
}

// When the plugin and `rulebook init` both installed hooks, only the project's hooks answer.
function projectHasOwnHooks(cwd, agent) {
  const root = repoRoot(cwd);
  const adapter = ADAPTERS.find((a) => a.agent === agent);
  if (!root || !adapter) return false;
  const file = path.join(root, adapter.file);
  return fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes(` hook ${agent} `);
}

export function runHook(io, agent, event, opts, extraLines = () => []) {
  try {
    const cwd = payloadCwd(io.stdin ?? '') ?? io.cwd;
    if (opts.via === 'plugin' && projectHasOwnHooks(cwd, agent)) return 0;
    const result = checkProject(cwd, { dir: opts.dir, now: io.now ? io.now() : new Date() });
    const lines = [...(result ? result.notices : []), ...extraLines()];
    const out = formatHookOutput(agent, event, lines);
    if (out) io.stdout.write(`${out}\n`);
  } catch (err) {
    if (io.env?.RULEBOOK_DEBUG) io.stderr.write(`rulebook: hook skipped (${err.message})\n`);
  }
  return 0;
}
