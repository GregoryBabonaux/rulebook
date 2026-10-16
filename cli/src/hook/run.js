import { checkProject } from '../check/run.js';
import { formatHookOutput } from './formats.js';

function payloadCwd(stdin) {
  try {
    const payload = JSON.parse(stdin);
    return typeof payload?.cwd === 'string' && payload.cwd ? payload.cwd : null;
  } catch {
    return null;
  }
}

export function runHook(io, agent, event, opts, extraLines = () => []) {
  try {
    const cwd = payloadCwd(io.stdin ?? '') ?? io.cwd;
    const result = checkProject(cwd, { dir: opts.dir, now: io.now ? io.now() : new Date() });
    const lines = [...(result ? result.notices : []), ...extraLines()];
    const out = formatHookOutput(agent, event, lines);
    if (out) io.stdout.write(`${out}\n`);
  } catch (err) {
    if (io.env?.RULEBOOK_DEBUG) io.stderr.write(`rulebook: hook skipped (${err.message})\n`);
  }
  return 0;
}
