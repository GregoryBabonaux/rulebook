import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { run } from '../../src/cli.js';
import { makeRepo } from '../helpers/repo.js';
import { fakeIo } from '../helpers/io.js';
import { baseFiles } from '../helpers/fixture.js';

const INDEX_MD = `# Business domains

- **PAY** · Payments — How the shop refunds money.
  - **Code**: \`app/Policies/\`, \`app/Pay/*\`
- **STK** · Stock — Inventory.
  - **Code**: \`app/Stock/\`
`;

const PAY_EXTRA = [
  '<?php',
  'class Discount {',
  '    private const MAX_DISCOUNT = 30;',
  '    public function apply($rate) {',
  '        if ($rate > 30) {',
  '            throw new TooHigh();',
  '        }',
  '    }',
  '}',
  '',
].join('\n');

const files = () => ({
  ...baseFiles(),
  'rulebook/index.md': INDEX_MD,
  'rulebook/config.json': JSON.stringify({ language: 'en', hotspots: ['app/**'] }),
  'app/Pay/Discount.php': PAY_EXTRA,
  'app/Stock/Reserve.php': '<?php\nif ($qty <= 0) { abort(422); }\n',
});

test('scan counts decision points per domain: covered by a card, to review', async () => {
  const repo = makeRepo(files());
  const io = fakeIo(repo.dir);
  assert.equal(await run(['scan'], io), 0);
  // PAY: OrderPolicy line 12 (<= 14) is inside the PAY-R012 evidence 9-13; Discount has 3 points
  assert.match(io.out, /PAY · 4 decision points · 1 covered · 0 not rules · 3 to review/);
  assert.match(io.out, /STK · 1 decision point · 0 covered · 0 not rules · 1 to review/);
  const saved = JSON.parse(fs.readFileSync(path.join(repo.dir, 'rulebook/.scan.json'), 'utf8'));
  assert.equal(saved.version, 1);
  assert.equal(saved.domains.PAY.total, 4);
  assert.ok(saved.points.every((p) => p.key && p.path && p.line && p.kind));
});

test('a point listed in not-rules.md counts as dismissed', async () => {
  const repo = makeRepo(files());
  await run(['scan'], fakeIo(repo.dir));
  const saved = JSON.parse(fs.readFileSync(path.join(repo.dir, 'rulebook/.scan.json'), 'utf8'));
  const constant = saved.points.find((p) => p.kind === 'constant');
  repo.write('rulebook/not-rules.md', `# Not rules\n- ${constant.key} · ${constant.path}:${constant.line} · duplicates the check below\n`);
  const io = fakeIo(repo.dir);
  await run(['scan'], io);
  assert.match(io.out, /PAY · 4 decision points · 1 covered · 1 not rule · 2 to review/);
});

test('--domain with --format md lists only the points to review, with their keys', async () => {
  const repo = makeRepo(files());
  const io = fakeIo(repo.dir);
  await run(['scan', '--domain', 'PAY', '--format', 'md'], io);
  assert.match(io.out, /^## PAY · 3 to review/m);
  assert.match(io.out, /^- condition — app\/Pay\/Discount\.php:5 `if \(\$rate > 30\) \{` · key [0-9a-f]{12}$/m);
  assert.doesNotMatch(io.out, /OrderPolicy\.php:12/, 'covered points are not listed');
  assert.doesNotMatch(io.out, /STK/);
});

test('tests are never scanned, and files outside every domain are counted apart', async () => {
  const repo = makeRepo({ ...files(), 'app/Misc/Helper.php': '<?php\nif ($a > 3) { throw new X(); }\n' });
  const io = fakeIo(repo.dir);
  await run(['scan'], io);
  assert.match(io.out, /1 decision point outside any domain/);
  const saved = JSON.parse(fs.readFileSync(path.join(repo.dir, 'rulebook/.scan.json'), 'utf8'));
  assert.ok(!saved.points.some((p) => p.path.startsWith('tests/')));
});

test('scan fails clearly without a rulebook folder', async () => {
  const repo = makeRepo({ 'app/a.php': '<?php\n' });
  const io = fakeIo(repo.dir);
  assert.equal(await run(['scan'], io), 1);
  assert.match(io.err, /no rulebook\/ folder/);
});

test('lines cited in Parameters and in edge cases count as covered', async () => {
  const md = baseFiles()['rulebook/PAY-payments.md'].replace('**Open questions.**', '**Parameters.** `MAX_DISCOUNT = 30` — app/Pay/Discount.php:3\n\n**Open questions.**')
    .replace('then it is accepted. — verified', 'then it is accepted. — verified — app/Pay/Discount.php:6');
  const repo = makeRepo({ ...files(), 'rulebook/PAY-payments.md': md });
  const io = fakeIo(repo.dir);
  await run(['scan'], io);
  assert.match(io.out, /PAY · 4 decision points · 3 covered · 0 not rules · 1 to review/);
});

test('identical lines to review are grouped in the md list, with every key', async () => {
  const guard = "<?php\nGate::authorize('view', $s);\n";
  const repo = makeRepo({ ...files(), 'app/Pay/A.php': guard, 'app/Pay/B.php': guard });
  const io = fakeIo(repo.dir);
  await run(['scan', '--domain', 'PAY', '--format', 'md'], io);
  assert.match(io.out, /^- authorization ×2 — `Gate::authorize\('view', \$s\);` · app\/Pay\/A\.php:2, app\/Pay\/B\.php:2 · keys [0-9a-f]{12} [0-9a-f]{12}$/m);
});
