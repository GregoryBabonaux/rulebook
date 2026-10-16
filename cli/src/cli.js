import { readFileSync } from 'node:fs';
import { loadProject } from './project.js';
import { headSha } from './git.js';
import { loadCards, buildIndex, writeIndex } from './index/build.js';
import { checkProject } from './check/run.js';
import { runHook } from './hook/run.js';
import { runInit } from './install/init.js';
import { runDoctor } from './install/doctor.js';
import { runUpdate } from './install/update.js';
import { updateNotice } from './update/notice.js';
import { runBuild } from './build/command.js';
import { runSkills } from './install/skills.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
export const VERSION = pkg.version;

const notice = (io) => updateNotice({ env: io.env, now: io.now ? io.now() : new Date(), current: VERSION });

export function parseOptions(args) {
  const o = {
    scope: { kind: 'worktree' }, format: 'line', strict: false, dir: 'rulebook',
    agents: null, yes: false, dryRun: false, bin: null, quiet: false, out: null, target: null, via: null,
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--staged') o.scope = { kind: 'staged' };
    else if (a === '--worktree') o.scope = { kind: 'worktree' };
    else if (a === '--since') o.scope = { kind: 'since', sha: args[++i] };
    else if (a === '--format') o.format = args[++i];
    else if (a === '--strict') o.strict = true;
    else if (a === '--dir') o.dir = args[++i];
    else if (a === '--agents') o.agents = (args[++i] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--yes') o.yes = true;
    else if (a === '--dry-run') o.dryRun = true;
    else if (a === '--bin') o.bin = args[++i] ?? null;
    else if (a === '--quiet') o.quiet = true;
    else if (a === '--out') o.out = args[++i] ?? null;
    else if (a === '--target') o.target = args[++i] ?? null;
    else if (a === '--via') o.via = args[++i] ?? null;
  }
  return o;
}

function runIndex(io, opts) {
  let project;
  try {
    project = loadProject(io.cwd, opts.dir);
  } catch (err) {
    io.stderr.write(`rulebook: ${err.message}\n`);
    return 1;
  }
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

function runCheck(io, opts) {
  try {
    const result = checkProject(io.cwd, { scope: opts.scope, dir: opts.dir, now: io.now ? io.now() : new Date() });
    if (opts.format === 'json') {
      if (result) io.stdout.write(`${JSON.stringify({ detections: result.detections, added: result.added.map((d) => d.key) })}\n`);
    } else {
      for (const line of result?.notices ?? []) io.stdout.write(`${line}\n`);
      const n = notice(io);
      if (n) io.stdout.write(`${n}\n`);
    }
    return opts.strict && result?.detections.length ? 1 : 0;
  } catch (err) {
    io.stderr.write(`rulebook: check skipped (${err.message})\n`);
    return opts.strict ? 2 : 0;
  }
}

export async function run(argv, io) {
  const [cmd, ...rest] = argv;
  const positional = cmd === 'hook' ? rest.slice(0, 2) : [];
  const opts = parseOptions(cmd === 'hook' ? rest.slice(2) : rest);
  if (cmd === '--version' || cmd === '-v') {
    io.stdout.write(`${pkg.version}\n`);
    return 0;
  }
  if (cmd === '--help' || cmd === '-h' || cmd === 'help') {
    io.stdout.write(`rulebook ${pkg.version} — keeps a codebase's business rules in a living reference

Usage: rulebook <command> [options]

  index    rebuild rulebook/.index.json from the cards; report parse warnings and unresolved evidence [--strict]
  check    match code changes against the index and write rulebook/inbox.md [--staged | --since <sha>] [--format json] [--strict]
  build    render rulebook/rulebook.html [--since <YYYY-MM-DD>] [--out <path>]
  hook     answer an agent hook: rulebook hook <agent> <post-edit|stop>
  init     install the companion: agent hooks, AGENTS.md block, pre-commit [--agents a,b] [--bin <cmd>] [--yes]
  doctor   check the installation and the reference [--quiet]
  update   refresh hooks and skill copies installed by this CLI
  skills   install the bundled skills into ~/.agents/skills and ~/.claude/skills [--target <dir>] [--yes]

Common option: --dir <folder> (default: rulebook)
`);
    return 0;
  }
  if (cmd === 'index') return runIndex(io, opts);
  if (cmd === 'check') return runCheck(io, opts);
  if (cmd === 'build') return runBuild(io, opts, VERSION);
  if (cmd === 'init') return runInit(io, opts, VERSION);
  if (cmd === 'doctor') return runDoctor(io, opts, VERSION);
  if (cmd === 'update') return runUpdate(io, opts, VERSION);
  if (cmd === 'skills') return runSkills(io, opts, VERSION);
  if (cmd === 'hook') {
    // The update notice is for the human: only on turn-end events, never in the model's post-edit context.
    const extra = positional[1] === 'stop' ? () => { const n = notice(io); return n ? [n] : []; } : () => [];
    return runHook(io, positional[0] ?? '', positional[1] ?? '', opts, extra);
  }
  io.stderr.write(`rulebook: unknown command "${cmd ?? ''}". Commands: index, check, build, hook, init, doctor, update, skills\n`);
  return 1;
}
