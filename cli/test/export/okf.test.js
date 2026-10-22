import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { run } from '../../src/cli.js';
import { makeRepo } from '../helpers/repo.js';
import { fakeIo } from '../helpers/io.js';
import { baseFiles, DOMAIN_MD } from '../helpers/fixture.js';

const INDEX_MD = `# Business domains

- **PAY** · Payments — How the shop refunds money.
  - **Covers**: refunds and chargebacks.
- **STK** · Stock — Inventory.
`;

const withData = DOMAIN_MD.replace('- test — tests/RefundTest.php:3-5 `test_refund_refused_after_window`', '- test — tests/RefundTest.php:3-5 `test_refund_refused_after_window`\n- data — shopdb:orders.delivered_at `refund_requested = 1`');

const repoFiles = (over = {}) => ({
  ...baseFiles(),
  'rulebook/index.md': INDEX_MD,
  'rulebook/PAY-payments.md': withData,
  'rulebook/config.json': JSON.stringify({ language: 'en', repoUrl: null, hotspots: [], data: { sources: [{ name: 'shopdb', kind: 'json', path: 'exports/shop.json' }] } }),
  ...over,
});

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const frontmatter = (text) => text.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? null;

test('export okf writes a conformant OKF v0.2 bundle', async () => {
  const repo = makeRepo(repoFiles());
  const io = fakeIo(repo.dir);
  assert.equal(await run(['export', 'okf'], io), 0, io.err);
  assert.match(io.out, /rulebook: exported an OKF 0\.2 bundle to rulebook\/okf \(\d+ concepts\)/);
  const out = path.join(repo.dir, 'rulebook/okf');
  const rel = walk(out).map((f) => path.relative(out, f).replace(/\\/g, '/')).sort();
  for (const f of ['index.md', 'log.md', 'pay/index.md', 'pay/overview.md', 'pay/policies/PAY-P03.md', 'pay/rules/PAY-R012.md', 'pay/rules/PAY-R020.md', 'stk/overview.md']) {
    assert.ok(rel.includes(f), `${f} missing from ${rel.join(', ')}`);
  }
  // conformance: every non-reserved .md has a frontmatter with a non-empty type
  for (const f of rel.filter((r) => r.endsWith('.md') && !/(^|\/)(index|log)\.md$/.test(r))) {
    const fm = frontmatter(fs.readFileSync(path.join(out, f), 'utf8'));
    assert.ok(fm && /^type: \S/m.test(fm), `${f} has no type`);
  }
  assert.match(fs.readFileSync(path.join(out, 'index.md'), 'utf8'), /^---\nokf_version: "0\.2"\n---\n/);
});

test('a rule concept carries trust, lifecycle, provenance and rulebook fields', async () => {
  const repo = makeRepo(repoFiles());
  await run(['export', 'okf'], fakeIo(repo.dir));
  const file = path.join(repo.dir, 'rulebook/okf/pay/rules/PAY-R012.md');
  const text = fs.readFileSync(file, 'utf8');
  const fm = frontmatter(text);
  assert.match(fm, /^type: Business Rule$/m);
  assert.match(fm, /^title: "Refund allowed up to 14 days after delivery"$/m);
  assert.match(fm, /^description: "A refund can be requested only if the order was delivered 14 days ago or less\."$/m);
  assert.match(fm, /^tags: \["pay", "timing", "verified"\]$/m);
  assert.match(fm, /^status: stable$/m);
  assert.match(fm, /^generated: \{ by: rulebook-cli\/\d+\.\d+\.\d+, at: 2026-10-15T00:00:00Z \}$/m);
  assert.match(fm, /^verified: \{ by: process:rulebook-blind-audit, at: 2026-10-15T00:00:00Z \}$/m);
  assert.match(fm, /^rulebook_id: PAY-R012$/m);
  assert.match(fm, /^implements: PAY-P03$/m);
  // provenance: evidence lines as sources; file sources resolve from the concept file
  const resource = fm.match(/- id: e1\n\s+resource: "([^"]+)"/)[1];
  assert.equal(resource, '../../../../app/Policies/OrderPolicy.php#L9-L13');
  assert.ok(fs.existsSync(path.resolve(path.dirname(file), resource.replace(/#.*$/, ''))));
  assert.match(fm, /resource: "data source shopdb: orders\.delivered_at where refund_requested = 1"/);
  // body: footnotes keyed to sources, a link to the policy, edge cases and history
  assert.match(text, /^# Rule\n\nA refund can be requested only if the order was delivered 14 days ago or less\.\[\^e1\]$/m);
  assert.match(text, /^\[\^e1\]: enforcement — app\/Policies\/OrderPolicy\.php:9-13 `OrderPolicy::refund`$/m);
  assert.match(text, /Implements \[PAY-P03 · Right of withdrawal\]\(\/pay\/policies\/PAY-P03\.md\)/);
  assert.match(text, /^# Edge cases$/m);
  assert.match(text, /^# History$/m);
});

test('the policy links its rules; the log lists history newest first', async () => {
  const repo = makeRepo(repoFiles());
  await run(['export', 'okf'], fakeIo(repo.dir));
  const policy = fs.readFileSync(path.join(repo.dir, 'rulebook/okf/pay/policies/PAY-P03.md'), 'utf8');
  assert.match(frontmatter(policy), /^type: Business Policy$/m);
  assert.match(policy, /\[PAY-R012 · Refund allowed up to 14 days after delivery\]\(\/pay\/rules\/PAY-R012\.md\)/);
  const log = fs.readFileSync(path.join(repo.dir, 'rulebook/okf/log.md'), 'utf8');
  assert.ok(log.indexOf('## 2026-10-14') < log.indexOf('## 2026-10-02'));
  assert.match(log, /\* \*\*Update\*\*: \[PAY-R012 · Refund allowed up to 14 days after delivery\]\(\/pay\/rules\/PAY-R012\.md\) — window 30 → 14 days/);
});

test('the export is reproducible and replaces its own previous export', async () => {
  const repo = makeRepo(repoFiles());
  await run(['export', 'okf'], fakeIo(repo.dir));
  const out = path.join(repo.dir, 'rulebook/okf');
  const snapshot = () => walk(out).sort().map((f) => `${f}\n${fs.readFileSync(f, 'utf8')}`).join('\n');
  const first = snapshot();
  fs.writeFileSync(path.join(out, 'pay/rules/STALE.md'), '---\ntype: X\n---\n');
  assert.equal(await run(['export', 'okf'], fakeIo(repo.dir)), 0);
  assert.equal(snapshot(), first);
});

test('the export never overwrites a folder it did not create', async () => {
  const repo = makeRepo(repoFiles({ 'docs/kb/notes.md': 'mine\n' }));
  const io = fakeIo(repo.dir);
  assert.equal(await run(['export', 'okf', '--out', 'docs/kb'], io), 1);
  assert.match(io.err, /docs\/kb is not empty and was not written by rulebook export — choose another --out/);
  assert.equal(fs.readFileSync(path.join(repo.dir, 'docs/kb/notes.md'), 'utf8'), 'mine\n');
});

test('exported outside the repository, sources use repository paths, never machine paths', async () => {
  const repo = makeRepo(repoFiles());
  const elsewhere = fs.mkdtempSync(path.join(path.dirname(repo.dir), 'okf-out-'));
  await run(['export', 'okf', '--out', elsewhere], fakeIo(repo.dir));
  const text = fs.readFileSync(path.join(elsewhere, 'pay/rules/PAY-R012.md'), 'utf8');
  assert.match(text, /resource: "app\/Policies\/OrderPolicy\.php#L9-L13"/);
  assert.doesNotMatch(text, /[A-Za-z]:[\/]|\/tmp\/|\.\.\//);
  assert.match(text, /^sources:\n  - id: e1$/m);
});
