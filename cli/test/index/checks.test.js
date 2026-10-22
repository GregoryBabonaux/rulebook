import test from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../../src/cli.js';
import { makeRepo } from '../helpers/repo.js';
import { fakeIo } from '../helpers/io.js';
import { baseFiles, DOMAIN_MD } from '../helpers/fixture.js';

const withDomain = (md) => ({ ...baseFiles(), 'rulebook/PAY-payments.md': md });

test('a cited symbol absent from the lines and above them is reported; --strict fails', async () => {
  const md = DOMAIN_MD.replace('`OrderPolicy::refund`', '`OrderPolicy::cancel`');
  const repo = makeRepo(withDomain(md));
  const io = fakeIo(repo.dir);
  assert.equal(await run(['index', '--strict'], io), 1);
  assert.match(io.err, /PAY-R012 evidence app\/Policies\/OrderPolicy\.php:9-13 — symbol "cancel" not found in or above these lines/);
});

test('a symbol declared above the cited lines is accepted', async () => {
  // OrderPolicy::refund is declared at line 9; citing 11-12 only must still pass
  const md = DOMAIN_MD.replace('app/Policies/OrderPolicy.php:9-13', 'app/Policies/OrderPolicy.php:11-12');
  const repo = makeRepo(withDomain(md));
  const io = fakeIo(repo.dir);
  assert.equal(await run(['index', '--strict'], io), 0);
  assert.doesNotMatch(io.err, /not found/);
});

test('class, property and test-method symbols resolve', async () => {
  const md = DOMAIN_MD.replace('`OrderPolicy::refund`', '`OrderPolicy`');
  const repo = makeRepo(withDomain(md));
  const io = fakeIo(repo.dir);
  assert.equal(await run(['index', '--strict'], io), 0, io.err);
});

test('test evidence outside a test file, and enforcement inside one, are reported', async () => {
  const md = DOMAIN_MD
    .replace('- test — tests/RefundTest.php:3-5 `test_refund_refused_after_window`', '- test — app/Policies/OrderPolicy.php:9-13 `refund`')
    .replace('- enforcement — app/Policies/OrderPolicy.php:9-13 `OrderPolicy::refund`', '- enforcement — tests/RefundTest.php:3-5 `test_refund_refused_after_window`');
  const repo = makeRepo(withDomain(md));
  const io = fakeIo(repo.dir);
  assert.equal(await run(['index', '--strict'], io), 1);
  assert.match(io.err, /PAY-R012 evidence app\/Policies\/OrderPolicy\.php:9-13 — test evidence outside a test file/);
  assert.match(io.err, /PAY-R012 evidence tests\/RefundTest\.php:3-5 — enforcement evidence inside a test file/);
});

test('without --strict, mismatches are reported but the exit code stays 0', async () => {
  const md = DOMAIN_MD.replace('`OrderPolicy::refund`', '`OrderPolicy::cancel`');
  const repo = makeRepo(withDomain(md));
  const io = fakeIo(repo.dir);
  assert.equal(await run(['index'], io), 0);
  assert.match(io.err, /symbol "cancel" not found/);
});

test('data evidence is not anchored; an undeclared source is reported', async () => {
  const md = DOMAIN_MD.replace('- test — tests/RefundTest.php:3-5 `test_refund_refused_after_window`', '- test — tests/RefundTest.php:3-5 `test_refund_refused_after_window`\n- data — shopdb:products.vat_rate');
  const declared = makeRepo({ ...withDomain(md), 'rulebook/config.json': JSON.stringify({ language: 'en', hotspots: [], data: { sources: [{ name: 'shopdb', kind: 'json', path: 'exports/shop.json' }] } }) });
  const ok = fakeIo(declared.dir);
  assert.equal(await run(['index', '--strict'], ok), 0, ok.err);
  const undeclared = makeRepo(withDomain(md));
  const io = fakeIo(undeclared.dir);
  assert.equal(await run(['index', '--strict'], io), 1);
  assert.match(io.err, /PAY-R012 evidence data shopdb:products\.vat_rate unresolved \(source "shopdb" is not declared in rulebook\/config\.json data\.sources\)/);
});
