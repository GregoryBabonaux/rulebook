import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { run } from '../../src/cli.js';
import { nextPublished, localDate } from '../../src/build/command.js';
import { makeRepo } from '../helpers/repo.js';
import { fakeIo } from '../helpers/io.js';
import { baseFiles } from '../helpers/fixture.js';

test('nextPublished shifts only on a new day', () => {
  assert.deepEqual(nextPublished(null, '2026-10-16'), { current: '2026-10-16', previous: null });
  assert.deepEqual(nextPublished({ current: '2026-10-10', previous: null }, '2026-10-16'), { current: '2026-10-16', previous: '2026-10-10' });
  assert.deepEqual(nextPublished({ current: '2026-10-16', previous: '2026-10-10' }, '2026-10-16'), { current: '2026-10-16', previous: '2026-10-10' });
  assert.equal(localDate(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
});

test('build writes the document and the publication record', async () => {
  const repo = makeRepo({ ...baseFiles(), 'rulebook/index.md': '- **PAY** · Payments — Money in and out.\n' });
  const io = fakeIo(repo.dir);
  assert.equal(await run(['build'], io), 0);
  const html = fs.readFileSync(path.join(repo.dir, 'rulebook/rulebook.html'), 'utf8');
  assert.match(html, /id="PAY-R012"/);
  assert.match(io.out, /rulebook: built rulebook\/rulebook\.html \(2 rules, 1 domains\)/);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(repo.dir, 'rulebook/.published.json'), 'utf8')), { current: '2026-10-15', previous: null });
});

test('several builds on the same day keep the since baseline', async () => {
  const repo = makeRepo(baseFiles());
  fs.writeFileSync(path.join(repo.dir, 'rulebook/.published.json'), JSON.stringify({ current: '2026-10-01', previous: null }));
  await run(['build'], fakeIo(repo.dir));
  await run(['build'], fakeIo(repo.dir));
  const published = JSON.parse(fs.readFileSync(path.join(repo.dir, 'rulebook/.published.json'), 'utf8'));
  assert.deepEqual(published, { current: '2026-10-15', previous: '2026-10-01' });
  assert.match(fs.readFileSync(path.join(repo.dir, 'rulebook/rulebook.html'), 'utf8'), /Since the version of 2026-10-01/);
});

test('--since overrides the baseline and --out writes elsewhere', async () => {
  const repo = makeRepo(baseFiles());
  await run(['build', '--since', '2026-09-01', '--out', 'docs/rules.html'], fakeIo(repo.dir));
  const html = fs.readFileSync(path.join(repo.dir, 'docs/rules.html'), 'utf8');
  assert.match(html, /Since the version of 2026-09-01/);
  assert.match(html, /tag tag-new/);
});

test('an empty rulebook still builds', async () => {
  const repo = makeRepo({ 'rulebook/config.json': '{"language":"fr"}' });
  const io = fakeIo(repo.dir);
  assert.equal(await run(['build'], io), 0);
  assert.match(fs.readFileSync(path.join(repo.dir, 'rulebook/rulebook.html'), 'utf8'), /Aucune règle n&#39;a encore été extraite/);
});

test('build fails clearly without a rulebook folder', async () => {
  const io = fakeIo(makeRepo({ 'a.txt': 'x' }).dir);
  assert.equal(await run(['build'], io), 1);
  assert.match(io.err, /no rulebook\/ folder/);
});

test('a domain file without a header still shows its rules, with a warning', async () => {
  const repo = makeRepo({ 'rulebook/config.json': '{}', 'rulebook/PAY-payments.md': '### PAY-R001 · Lonely\n**Rule.** A rule without a domain header.\n' });
  const io = fakeIo(repo.dir);
  await run(['build'], io);
  const html = fs.readFileSync(path.join(repo.dir, 'rulebook/rulebook.html'), 'utf8');
  assert.match(html, /id="PAY-R001"/);
  assert.match(io.err, /rulebook\/PAY-payments\.md has no "# CODE · Title" header/);
});

test('evidence links follow the output location; a non-http repoUrl is refused', async () => {
  const files = baseFiles();
  const repo = makeRepo(Object.fromEntries(Object.entries(files).map(([k, v]) => [k.replace(/^rulebook\//, 'docs/rulebook/'), k.endsWith('config.json') ? JSON.stringify({ repoUrl: 'javascript:alert(1)' }) : v])));
  const io = fakeIo(repo.dir);
  await run(['build', '--dir', 'docs/rulebook'], io);
  const html = fs.readFileSync(path.join(repo.dir, 'docs/rulebook/rulebook.html'), 'utf8');
  assert.match(html, /<a href="\.\.\/\.\.\/app\/Policies\/OrderPolicy\.php">/);
  assert.doesNotMatch(html, /javascript:/);
  assert.match(io.err, /repoUrl must start with http:\/\/ or https:\/\//);
});

test('SOURCE_DATE_EPOCH pins the build date, for reproducible documents', async () => {
  const repo = makeRepo(baseFiles());
  const io = fakeIo(repo.dir);
  io.env = { ...io.env, SOURCE_DATE_EPOCH: String(Date.parse('2025-03-04T12:00:00Z') / 1000) };
  await run(['build'], io);
  assert.match(fs.readFileSync(path.join(repo.dir, 'rulebook/rulebook.html'), 'utf8'), /class="hero-meta">2025-03-04 · /);
});

test('build reads rulebook/.scan.json for the coverage of each domain', async () => {
  const repo = makeRepo({
    ...baseFiles(),
    'rulebook/config.json': JSON.stringify({ language: 'en', hotspots: ['app/**'] }),
    'rulebook/index.md': '# Business domains\n\n- **PAY** · Payments — Refunds.\n  - **Code**: `app/Policies/`\n',
  });
  await run(['scan'], fakeIo(repo.dir));
  await run(['build'], fakeIo(repo.dir));
  assert.match(fs.readFileSync(path.join(repo.dir, 'rulebook/rulebook.html'), 'utf8'), /class="coverage"><span class="label">Coverage<\/span> 1 decision point examined out of 1 \(100 %\)/);
});
