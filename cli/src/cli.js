import fs, { readFileSync } from 'node:fs';
import path from 'node:path';
import { loadProject } from './project.js';
import { git, headSha } from './git.js';
import { loadCards, buildIndex, writeIndex, readIndex } from './index/build.js';
import { getDiff } from './git/diff.js';
import { detect } from './check/detect.js';
import { appendDetections, formatNotice } from './inbox/inbox.js';

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
    const project = loadProject(io.cwd, opts.dir);
    if (!project) return 0;
    const index = readIndex(project.dir);
    const diffs = getDiff(project.root, opts.scope);
    const readFile = opts.scope.kind === 'staged'
      ? (p) => git(project.root, ['show', `:${p}`])
      : (p) => { try { return fs.readFileSync(path.join(project.root, p), 'utf8'); } catch { return null; } };
    const detections = detect({ index, diffs, readFile, hotspots: project.config.hotspots, rulebookDir: project.dirName });
    const inboxRel = `${project.dirName}/inbox.md`;
    const added = appendDetections(path.join(project.dir, 'inbox.md'), detections, io.now ? io.now() : new Date());
    if (opts.format === 'json') {
      io.stdout.write(`${JSON.stringify({ detections, added: added.map((d) => d.key) })}\n`);
    } else {
      for (const d of added) io.stdout.write(`${formatNotice(d, inboxRel)}\n`);
    }
    return opts.strict && detections.length ? 1 : 0;
  } catch (err) {
    io.stderr.write(`rulebook: check skipped (${err.message})\n`);
    return opts.strict ? 2 : 0;
  }
}

export async function run(argv, io) {
  const [cmd, ...rest] = argv;
  const opts = parseOptions(rest);
  if (cmd === '--version' || cmd === '-v') {
    io.stdout.write(`${pkg.version}\n`);
    return 0;
  }
  if (cmd === 'index') return runIndex(io, opts);
  if (cmd === 'check') return runCheck(io, opts);
  io.stderr.write(`rulebook: unknown command "${cmd ?? ''}". Commands: index, check\n`);
  return 1;
}
