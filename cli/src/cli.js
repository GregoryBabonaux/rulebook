import { readFileSync } from 'node:fs';
import { loadProject } from './project.js';
import { headSha } from './git.js';
import { loadCards, buildIndex, writeIndex } from './index/build.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

export function parseOptions(args) {
  const o = { scope: { kind: 'worktree' }, format: 'line', strict: false, dir: 'rulebook' };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--staged') o.scope = { kind: 'staged' };
    else if (a === '--worktree') o.scope = { kind: 'worktree' };
    else if (a === '--since') o.scope = { kind: 'since', sha: args[++i] };
    else if (a === '--format') o.format = args[++i];
    else if (a === '--strict') o.strict = true;
    else if (a === '--dir') o.dir = args[++i];
  }
  return o;
}

function runIndex(io, opts) {
  const project = loadProject(io.cwd, opts.dir);
  if (!project) {
    io.stderr.write(`rulebook: no ${opts.dir}/ folder in this git repository\n`);
    return 1;
  }
  const { cards, warnings } = loadCards(project);
  const { index, unresolved } = buildIndex(project.root, cards, headSha(project.root));
  writeIndex(project.dir, index);
  for (const w of warnings) io.stderr.write(`rulebook: ${w.file}:${w.line} ${w.message}\n`);
  for (const u of unresolved) io.stderr.write(`rulebook: ${u.rule} evidence ${u.path} unresolved (${u.reason})\n`);
  io.stdout.write(`rulebook: indexed ${index.anchors.length} anchors from ${cards.length} cards\n`);
  return unresolved.length && opts.strict ? 1 : 0;
}

export async function run(argv, io) {
  const [cmd, ...rest] = argv;
  const opts = parseOptions(rest);
  if (cmd === '--version' || cmd === '-v') {
    io.stdout.write(`${pkg.version}\n`);
    return 0;
  }
  if (cmd === 'index') return runIndex(io, opts);
  io.stderr.write(`rulebook: unknown command "${cmd ?? ''}". Commands: index, check\n`);
  return 1;
}
