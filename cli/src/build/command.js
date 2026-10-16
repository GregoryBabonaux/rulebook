import fs from 'node:fs';
import path from 'node:path';
import { loadProject, domainFiles } from '../project.js';
import { headSha } from '../git.js';
import { parseDomainFile } from '../parse/cards.js';
import { parseIndexMd } from '../parse/indexmd.js';
import { buildData } from './data.js';
import { renderHtml, isHttpUrl } from './render.js';

const pad = (n) => String(n).padStart(2, '0');
export const localDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function nextPublished(published, today) {
  if (!published?.current) return { current: today, previous: null };
  if (published.current === today) return { current: today, previous: published.previous ?? null };
  return { current: today, previous: published.current };
}

const readText = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '');

export function runBuild(io, opts, version) {
  let project;
  try { project = loadProject(io.cwd, opts.dir); } catch (err) { io.stderr.write(`rulebook: ${err.message}\n`); return 1; }
  if (!project) { io.stderr.write(`rulebook: no ${opts.dir}/ folder in this git repository\n`); return 1; }

  // SOURCE_DATE_EPOCH (reproducible-builds.org) pins the date, so the same cards give the same file
  const epoch = Number(io.env?.SOURCE_DATE_EPOCH);
  const today = Number.isFinite(epoch) && io.env.SOURCE_DATE_EPOCH !== ''
    ? new Date(epoch * 1000).toISOString().slice(0, 10)
    : localDate(io.now ? io.now() : new Date());
  const publishedPath = path.join(project.dir, '.published.json');
  let published = null;
  try { published = JSON.parse(readText(publishedPath) || 'null'); } catch { published = null; }
  const next = nextPublished(published, today);
  const sinceFrom = opts.scope.kind === 'since' ? opts.scope.sha : next.previous;

  const files = domainFiles(project.dir).map((f) => {
    const parsed = parseDomainFile(readText(path.join(project.dir, f)), `${project.dirName}/${f}`);
    if (!parsed.domain) {
      // keep the cards visible: fall back to the code and slug from the file name
      const [, code, slug] = f.match(/^([A-Z]{3})-(.+)\.md$/);
      parsed.domain = { code, title: slug.replace(/[-_]+/g, ' '), description: '' };
      io.stderr.write(`rulebook: ${project.dirName}/${f} has no "# CODE · Title" header\n`);
    }
    return parsed;
  });
  if (project.config.repoUrl && !isHttpUrl(project.config.repoUrl)) {
    io.stderr.write('rulebook: repoUrl must start with http:// or https:// — evidence links stay relative\n');
  }
  const data = buildData({
    name: path.basename(project.root),
    commit: headSha(project.root),
    today,
    version,
    config: project.config,
    domainsMap: parseIndexMd(readText(path.join(project.dir, 'index.md'))),
    domainFiles: files,
    inboxText: readText(path.join(project.dir, 'inbox.md')),
    sinceFrom,
  });

  const outRel = opts.out ?? `${project.dirName}/rulebook.html`;
  const outAbs = path.resolve(project.root, outRel);
  const evidenceBase = path.relative(path.dirname(outAbs), project.root).replace(/\\/g, '/') || '.';
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  fs.writeFileSync(outAbs, renderHtml(data, { evidenceBase }));
  fs.writeFileSync(publishedPath, `${JSON.stringify(next)}\n`);
  io.stdout.write(`rulebook: built ${outRel.replace(/\\/g, '/')} (${data.counts.rules} rules, ${data.counts.domains} domains)\n`);
  return 0;
}
