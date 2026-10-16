import fs from 'node:fs';
import path from 'node:path';
import { loadProject } from '../project.js';
import { git } from '../git.js';
import { readIndex } from '../index/build.js';
import { getDiff } from '../git/diff.js';
import { detect } from './detect.js';
import { appendDetections, formatNotice } from '../inbox/inbox.js';

export function checkProject(cwd, { scope = { kind: 'worktree' }, dir = 'rulebook', now = new Date() } = {}) {
  const project = loadProject(cwd, dir);
  if (!project) return null;
  const index = readIndex(project.dir);
  const diffs = getDiff(project.root, scope);
  const readFile = scope.kind === 'staged'
    ? (p) => git(project.root, ['show', `:${p}`])
    : (p) => { try { return fs.readFileSync(path.join(project.root, p), 'utf8'); } catch { return null; } };
  const detections = detect({ index, diffs, readFile, hotspots: project.config.hotspots, rulebookDir: project.dirName });
  const inboxRel = `${project.dirName}/inbox.md`;
  const added = appendDetections(path.join(project.dir, 'inbox.md'), detections, now);
  return { project, detections, added, notices: added.map((d) => formatNotice(d, inboxRel)) };
}
