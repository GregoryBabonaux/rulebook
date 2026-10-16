import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run } from '../../src/cli.js';
import { fakeIo } from '../helpers/io.js';
import { makeRepo } from '../helpers/repo.js';
import { baseFiles, DOMAIN_MD } from '../helpers/fixture.js';
import { splitLines, hashRange } from '../../src/index/hash.js';

test('rulebook index writes anchors for every rule evidence line', async () => {
  const repo = makeRepo(baseFiles());
  const io = fakeIo(repo.dir);
  assert.equal(await run(['index'], io), 0);
  const index = JSON.parse(repo.read('rulebook/.index.json'));
  assert.equal(index.version, 1);
  assert.equal(index.verifiedAt, repo.git('rev-parse', '--short', 'HEAD').trim());
  assert.equal(index.anchors.length, 2);
  const [a] = index.anchors;
  assert.deepEqual({ rule: a.rule, kind: a.kind, path: a.path, symbol: a.symbol, lines: a.lines },
    { rule: 'PAY-R012', kind: 'enforcement', path: 'app/Policies/OrderPolicy.php', symbol: 'OrderPolicy::refund', lines: [9, 13] });
  assert.equal(a.hash, hashRange(splitLines(repo.read('app/Policies/OrderPolicy.php')), 9, 13));
  assert.match(io.out, /indexed 2 anchors from 3 cards/);
});

test('unresolved evidence is reported; --strict turns it into exit 1', async () => {
  const files = baseFiles();
  files['rulebook/PAY-payments.md'] = DOMAIN_MD.replace('tests/RefundTest.php:3-5', 'tests/Missing.php:3-5');
  const repo = makeRepo(files);
  const io = fakeIo(repo.dir);
  assert.equal(await run(['index'], io), 0);
  assert.match(io.err, /PAY-R012 evidence tests\/Missing\.php unresolved \(file not found\)/);
  assert.equal(await run(['index', '--strict'], fakeIo(repo.dir)), 1);
});

test('out-of-range lines are unresolved', async () => {
  const files = baseFiles();
  files['rulebook/PAY-payments.md'] = DOMAIN_MD.replace('OrderPolicy.php:9-13', 'OrderPolicy.php:9-99');
  const io = fakeIo(makeRepo(files).dir);
  await run(['index'], io);
  assert.match(io.err, /lines 9-99 out of range/);
});

test('parser warnings are printed with file and line', async () => {
  const files = baseFiles();
  files['rulebook/PAY-payments.md'] = DOMAIN_MD.replace('**Category:** timing', '**Colour:** blue');
  const io = fakeIo(makeRepo(files).dir);
  await run(['index'], io);
  assert.match(io.err, /rulebook\/PAY-payments\.md:9 unknown metadata label "Colour"/);
});

test('index fails clearly without a rulebook folder', async () => {
  const io = fakeIo(makeRepo({ 'a.txt': 'x' }).dir);
  assert.equal(await run(['index'], io), 1);
  assert.match(io.err, /no rulebook\/ folder/);
});

test('index fails clearly outside a git repository', async () => {
  const io = fakeIo(fs.mkdtempSync(path.join(os.tmpdir(), 'rulebook-nogit-')));
  assert.equal(await run(['index'], io), 1);
  assert.match(io.err, /no rulebook\/ folder/);
});

test('evidence pointing at a directory is unresolved, not a crash', async () => {
  const files = baseFiles();
  files['rulebook/PAY-payments.md'] = DOMAIN_MD.replace('tests/RefundTest.php:3-5', 'tests:3-5');
  const io = fakeIo(makeRepo(files).dir);
  assert.equal(await run(['index'], io), 0);
  assert.match(io.err, /PAY-R012 evidence tests unresolved \(not a file\)/);
});

test('an invalid config.json is reported in one line, not a stack trace', async () => {
  const files = baseFiles();
  files['rulebook/config.json'] = '{ broken';
  const io = fakeIo(makeRepo(files).dir);
  assert.equal(await run(['index'], io), 1);
  assert.match(io.err, /^rulebook: invalid rulebook\/config\.json \(/);
});
