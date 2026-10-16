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
