import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIndexMd } from '../../src/parse/indexmd.js';
import { buildData } from '../../src/build/data.js';
import { parseDomainFile } from '../../src/parse/cards.js';
import { DOMAIN_MD } from '../helpers/fixture.js';

const INDEX = `# Business domains

- **PAY** · Payments — How the shop takes and refunds money.
- **STK** · Stock — Inventory and reservations.
not a domain line
`;

const base = (over = {}) => buildData({
  name: 'shop', commit: 'a1b2c3d', today: '2026-10-16', version: '0.1.0',
  config: { language: 'en', repoUrl: null },
  domainsMap: parseIndexMd(INDEX),
  domainFiles: [parseDomainFile(DOMAIN_MD)],
  inboxText: '# rulebook inbox\n\n- [ ] 2026-10-15 14:02 · new? · — · app/X.php:3-3 · key aaaaaaaaaaaa\n- [x] 2026-10-15 14:02 · modified? · PAY-R012 · a.php · key bbbbbbbbbbbb\n',
  sinceFrom: '2026-10-10',
  ...over,
});

test('parseIndexMd reads domain lines', () => {
  assert.deepEqual(parseIndexMd(INDEX), [
    { code: 'PAY', title: 'Payments', description: 'How the shop takes and refunds money.', details: [] },
    { code: 'STK', title: 'Stock', description: 'Inventory and reservations.', details: [] },
  ]);
});

test('domains merge the map and the domain files; unextracted ones are flagged', () => {
  const d = base();
  assert.deepEqual(d.domains.map((x) => [x.code, x.extracted]), [['PAY', true], ['STK', false]]);
  assert.equal(d.domains[0].policies[0].card.id, 'PAY-P03');
  assert.deepEqual(d.domains[0].policies[0].rules.map((r) => r.id), ['PAY-R012']);
  assert.deepEqual(d.domains[0].otherRules.map((r) => r.id), ['PAY-R020']);
  assert.deepEqual(d.counts, { domains: 2, extracted: 1, policies: 1, rules: 2, edgeCases: 2 });
});

test('a domain file missing from the map is still listed', () => {
  const d = base({ domainsMap: [] });
  assert.deepEqual(d.domains.map((x) => x.code), ['PAY']);
  assert.equal(d.domains[0].title, 'Payments');
});

test('the since block lists history after the baseline', () => {
  assert.deepEqual(base().since, {
    from: '2026-10-10',
    items: [{ type: 'changed', id: 'PAY-R012', title: 'Refund allowed up to 14 days after delivery', date: '2026-10-14', note: 'window 30 → 14 days' }],
  });
  assert.deepEqual(base({ sinceFrom: null }).since, { from: null, items: [] });

});

test('toValidate gathers open questions, conflicts, failed audits and pending inbox lines', () => {
  const md = DOMAIN_MD.replace('**Confidence:** inferred', '**Confidence:** conflicting').replace('**Audit:** passed', '**Audit:** failed: citation not found');
  const d = base({ domainFiles: [parseDomainFile(md)] });
  assert.deepEqual(d.toValidate.map((t) => [t.type, t.id]), [
    ['question', 'PAY-R012'], ['audit', 'PAY-R012'], ['conflicting', 'PAY-R020'], ['inbox', null],
  ]);
  assert.equal(d.toValidate[1].text, 'failed: citation not found');
  assert.match(d.toValidate[3].text, /new\? · — · app\/X\.php:3-3/);
});

test('project metadata', () => {
  assert.deepEqual(base().project, { name: 'shop', commit: 'a1b2c3d', builtAt: '2026-10-16', version: '0.1.0', language: 'en', repoUrl: null });
});

test('the since block shows each rule once, with its latest change', () => {
  const items = base({ sinceFrom: '2026-09-01' }).since.items;
  // created after the baseline, so it is new to a reader of the previous version
  assert.deepEqual(items.map((i) => [i.id, i.type, i.date]), [['PAY-R012', 'new', '2026-10-02']]);
});

test('an event dated on the baseline day is still reported', () => {
  assert.deepEqual(base({ sinceFrom: '2026-10-14' }).since.items.map((i) => i.id), ['PAY-R012']);
});

test('two domain files with the same code are merged, not overwritten', () => {
  const extra = parseDomainFile('# PAY · Payments\n### PAY-R099 · Extra\n**Rule.** Extra rule.\n');
  const d = base({ domainFiles: [parseDomainFile(DOMAIN_MD), extra] });
  assert.equal(d.domains.length, 2);
  assert.deepEqual(d.domains[0].otherRules.map((r) => r.id), ['PAY-R020', 'PAY-R099']);
});

test('parseIndexMd keeps the details listed under each domain', () => {
  const md = `- **PAR** · Parcours — Créer un parcours.
  - **Couvre** : énigmes, indices.
  - **Code** : \`app/Services/PuzzleReviewService.php\`
- **JEU** · Partie — Jouer.
`;
  assert.deepEqual(parseIndexMd(md), [
    { code: 'PAR', title: 'Parcours', description: 'Créer un parcours.', details: [{ label: 'Couvre', text: 'énigmes, indices.' }, { label: 'Code', text: '`app/Services/PuzzleReviewService.php`' }] },
    { code: 'JEU', title: 'Partie', description: 'Jouer.', details: [] },
  ]);
});

test('domain details reach the view model', () => {
  const d = base({ domainsMap: [{ code: 'STK', title: 'Stock', description: 'x', details: [{ label: 'Couvre', text: 'réservations' }] }] });
  assert.deepEqual(d.domains.find((x) => x.code === 'STK').details, [{ label: 'Couvre', text: 'réservations' }]);
  assert.deepEqual(d.domains.find((x) => x.code === 'PAY').details, []);
});
