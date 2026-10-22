import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDomainFile } from '../../src/parse/cards.js';
import { labelToKey } from '../../src/parse/labels.js';
import { DOMAIN_MD } from '../helpers/fixture.js';

test('labelToKey maps English and French labels, case- and space-insensitive', () => {
  assert.equal(labelToKey('Verified at'), 'verifiedAt');
  assert.equal(labelToKey('vérifié sur'), 'verifiedAt');
  assert.equal(labelToKey('Type '), 'kind');
  assert.equal(labelToKey('Nope'), null);
});

test('parses the domain header and description', () => {
  const { domain } = parseDomainFile(DOMAIN_MD);
  assert.deepEqual(domain, { code: 'PAY', title: 'Payments', description: 'How the shop takes and refunds money.' });
});

test('parses a policy card', () => {
  const policy = parseDomainFile(DOMAIN_MD).cards[0];
  assert.equal(policy.id, 'PAY-P03');
  assert.equal(policy.kind, 'policy');
  assert.equal(policy.meta.nature, 'consumer law');
  assert.equal(policy.sections.statement, 'A customer may withdraw from a purchase within a legal period.');
});

test('parses a rule card with metadata, sections, evidence, edge cases and history', () => {
  const rule = parseDomainFile(DOMAIN_MD).cards[1];
  assert.equal(rule.id, 'PAY-R012');
  assert.equal(rule.kind, 'rule');
  assert.equal(rule.policy, 'PAY-P03');
  assert.equal(rule.meta.category, 'timing');
  assert.equal(rule.meta.implements, 'PAY-P03');
  assert.equal(rule.meta.confidence, 'verified');
  assert.deepEqual(rule.meta.verifiedAt, { sha: 'a1b2c3d', date: '2026-10-15' });
  assert.equal(rule.sections.context, 'Applies the withdrawal right. The window starts at delivery.');
  assert.deepEqual(rule.evidence, [
    { kind: 'enforcement', path: 'app/Policies/OrderPolicy.php', start: 9, end: 13, symbol: 'OrderPolicy::refund' },
    { kind: 'test', path: 'tests/RefundTest.php', start: 3, end: 5, symbol: 'test_refund_refused_after_window' },
  ]);
  assert.deepEqual(rule.edgeCases[0], {
    id: 'PAY-R012.E1',
    text: 'Given an order never delivered, when a refund is requested, then it is refused.',
    confidence: 'read',
    ref: 'app/Policies/OrderPolicy.php:11',
  });
  assert.equal(rule.edgeCases[1].confidence, 'verified');
  assert.equal(rule.edgeCases[1].ref, null);
  assert.deepEqual(rule.history[0], { date: '2026-10-14', sha: 'b7e8f9a', change: 'changed', note: 'window 30 → 14 days' });
});

test('a rule under a non-policy level-2 heading has no policy', () => {
  const rule = parseDomainFile(DOMAIN_MD).cards[2];
  assert.equal(rule.id, 'PAY-R020');
  assert.equal(rule.policy, null);
  assert.equal(rule.meta.status, 'active');
});

test('CRLF input parses identically', () => {
  assert.deepEqual(parseDomainFile(DOMAIN_MD.replace(/\n/g, '\r\n')), parseDomainFile(DOMAIN_MD));
});

test('French labels are understood', () => {
  const md = `# PAY · Paiements
### PAY-R001 · Remboursement
- **Type :** rule · **Catégorie:** timing · **Confiance:** read

**La règle.** Un remboursement est possible sous 14 jours.

**Preuves.**
- enforcement — app/X.php:3
`;
  const [card] = parseDomainFile(md).cards;
  assert.equal(card.meta.category, 'timing');
  assert.equal(card.meta.confidence, 'read');
  assert.equal(card.sections.rule, 'Un remboursement est possible sous 14 jours.');
  assert.deepEqual(card.evidence[0], { kind: 'enforcement', path: 'app/X.php', start: 3, end: 3, symbol: null });
});

test('malformed lines produce warnings with line numbers, never throw', () => {
  const md = `# PAY · Payments
### PAY-R001 · Broken
- **Colour:** blue
**Mystery.** something

**Evidence.**
- proof — somewhere
`;
  const { cards, warnings } = parseDomainFile(md, 'rulebook/PAY-payments.md');
  assert.equal(cards.length, 1);
  assert.deepEqual(warnings.map((w) => w.line), [3, 4, 7]);
  assert.match(warnings[0].message, /unknown metadata label "Colour"/);
  assert.equal(warnings[0].file, 'rulebook/PAY-payments.md');
});

test('an unrecognised heading closes the current card instead of leaking into it', () => {
  const md = `# PAY · Payments
### PAY-R001 · First
**Evidence.**
- enforcement — a.js:1

### Notes for later
**Evidence.**
- enforcement — b.js:2
`;
  const { cards, warnings } = parseDomainFile(md);
  assert.deepEqual(cards[0].evidence.map((e) => e.path), ['a.js']);
  assert.match(warnings[0].message, /unrecognised heading "### Notes for later"/);
});

test('dash separators in headings are accepted', () => {
  const md = `# PAY — Payments
## PAY-P01 – Withdrawal
### PAY-R002 - Second
`;
  const { domain, cards } = parseDomainFile(md);
  assert.equal(domain.code, 'PAY');
  assert.deepEqual(cards.map((c) => [c.id, c.title]), [['PAY-P01', 'Withdrawal'], ['PAY-R002', 'Second']]);
});

test('section labels written with a colon are understood', () => {
  const md = `# PAY · Paiements
### PAY-R001 · Un
**Preuves :**
- enforcement — a.js:1
**Contexte**: Un contexte.
`;
  const [card] = parseDomainFile(md).cards;
  assert.deepEqual(card.evidence.map((e) => e.path), ['a.js']);
  assert.equal(card.sections.context, 'Un contexte.');
});

test('an edge case whose tail cannot be parsed is reported', () => {
  const md = `# PAY · Payments
### PAY-R001 · One
**Edge cases.**
- **PAY-R001.E1** Given x, when y, then z. — inferred — src/a.js:3,9
- **PAY-R001.E2** Given x, when y, then z. — read — src/a.js:3
`;
  const { cards, warnings } = parseDomainFile(md);
  assert.equal(cards[0].edgeCases[1].confidence, 'read');
  assert.equal(warnings.length, 1);
  assert.match(warnings[0].message, /edge case PAY-R001\.E1: unreadable confidence or reference/);
});

test('a domain may carry a Scope paragraph under its title', () => {
  const md = '# PAY · Payments\nHow the shop refunds money.\n\n**Scope.** Read: app/Policies, app/Pay.\nNot read: the admin panel.\n\n## Other operating rules\n';
  const { domain } = parseDomainFile(md);
  assert.equal(domain.description, 'How the shop refunds money.');
  assert.equal(domain.scope, 'Read: app/Policies, app/Pay. Not read: the admin panel.');
  assert.equal(parseDomainFile(md.replace('**Scope.**', '**Périmètre.**')).domain.scope, 'Read: app/Policies, app/Pay. Not read: the admin panel.');
});

test('a data evidence line names a declared source, a table or column, and a filter', () => {
  const md = DOMAIN_MD.replace('- test — tests/RefundTest.php:3-5 `test_refund_refused_after_window`', '- test — tests/RefundTest.php:3-5 `test_refund_refused_after_window`\n- data — shopdb:products.vat_rate `category = \'book\'`');
  const { cards, warnings } = parseDomainFile(md);
  assert.deepEqual(warnings, []);
  const ev = cards.find((c) => c.id === 'PAY-R012').evidence.find((e) => e.kind === 'data');
  assert.deepEqual(ev, { kind: 'data', source: 'shopdb', table: 'products.vat_rate', filter: "category = 'book'", path: null, start: null, end: null, symbol: null });
});
