# rulebook — Plan 1: card format, evidence index and `rulebook check`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the deterministic core of rulebook:
- the strict rule-card format;
- a parser for it;
- the evidence index (`rulebook index`);
- the change detector that writes the inbox (`rulebook check`).

**Architecture:** A zero-dependency Node ESM CLI in `cli/`, made of small single-purpose modules:

| Module | Role |
|---|---|
| `parse/` | Markdown cards → objects |
| `index/` | Range hashing and the index file |
| `git/` | Diff acquisition and parsing |
| `check/` | Detection rules |
| `inbox/` | Inbox file I/O |

`src/cli.js` wires the modules into the `index` and `check` commands. Every module is tested with `node:test`, on pure inputs or on throwaway git repos.

**Tech Stack:** Node ≥ 20 (developed on 24), ESM, `node:test` and `node:assert/strict`, git ≥ 2.30. No npm dependencies.

**Spec:** `E:\Dev\rulebook\docs\specs\2026-10-15-rulebook-design.md` (§3, §4, §5.3, §6.1). Plans 2–5 (adapters/init, HTML, skills, distribution) build on this one.

## Global Constraints

**Runtime**
- Node ≥ 20, `"type": "module"`, **zero runtime dependencies**. Tests use `node:test` only.
- All code, CLI messages and comments are in English.

**Safety**
- The CLI never calls an LLM.
- The CLI writes only `rulebook/.index.json` and `rulebook/inbox.md`. It never modifies analysed source files.
- `rulebook check` exits **0** in every situation unless `--strict` is passed. That includes no git repo, no `rulebook/` folder, a corrupt index and internal errors. It runs inside agent hooks and must never break an agent turn.

**Output formats (exact)**
- Notice lines:
  - `rulebook: <RULE> may have changed (<file basename>) → rulebook/inbox.md`
  - `rulebook: <RULE> may have been removed (<file basename>) → rulebook/inbox.md`
  - `rulebook: possible new rule in <path>:<line> → rulebook/inbox.md`
- Inbox entry: `- [ ] YYYY-MM-DD HH:MM · <modified?|removed?|new?> · <RULE or —> · <path>[:<start>-<end>] · key <12 hex>`

**Card format**
- Domain heading: `# PAY · Title`. Policy heading: `## PAY-P03 · Title`. Rule heading: `### PAY-R012 · Title`. Edge case ID: `PAY-R012.E1`.
- Metadata: `- **Label:** value · **Label:** value`. Sections: `**Label.** text`. Labels are English or French (see `labels.js`).
- Evidence line: `- <enforcement|test|config|schema|doc> — <path>:<start>[-<end>] [`Symbol`]`.

**Recorded deviations from the spec (intentional, keep them)**
- Hotspots live in `rulebook/config.json` only, not in `.index.json`.
- The anchor field is `hash`: a hash of the evidence line range with whitespace normalised.
- Deduplication relies on unchecked inbox keys, so there is no `.state.json` in this plan.

## Review Focus

These five failure modes are the most likely to hurt a real user. Each has a test in the task named:

1. **CRLF checkouts on Windows.** A file whose only change is LF→CRLF must not be reported. *(Task 3 hash test; Task 6 check test)*
2. **Line drift.** Inserting lines above an anchored range must not report the rule. *(Task 5, Task 6)*
3. **Repeated hook calls in one session.** The same pending change must not produce duplicate inbox entries or notices. *(Task 6)*
4. **Hostile environments.** Outside git, without a `rulebook/` folder, or with a corrupt `.index.json`, `check` must exit 0 and stay silent or warn on stderr only. *(Task 6)*
5. **Removed lines starting with `--`** (SQL comments, YAML, Markdown rules). The diff parser must not mistake them for `---` file headers. *(Task 4)*

---

### Task 1: Scaffold the repo and the CLI entry point

**Files:**
- Create: `.gitignore`, `.gitattributes`, `LICENSE`
- Create: `cli/package.json`, `cli/bin/rulebook.js`, `cli/src/cli.js`
- Create: `cli/test/helpers/io.js`, `cli/test/helpers/repo.js`
- Test: `cli/test/cli.test.js`

**Interfaces:**
- Produces: `run(argv: string[], io: Io): Promise<number>`. `Io` is `{ cwd: string, stdout: {write(s)}, stderr: {write(s)}, now?: () => Date }`.
- Produces test helpers:
  - `fakeIo(cwd)` returns an `Io` with `.out` and `.err` string getters and a fixed `now()` of 2026-10-15 14:02 local time.
  - `makeRepo(files)` returns `{ dir, git(...args), write(rel, text), commit(msg), read(rel) }`.

- [ ] **Step 1: Create root files**

`.gitignore`:
```
node_modules/
*.log
```

`.gitattributes`:
```
*.js   text eol=lf
*.json text eol=lf
*.md   text eol=lf
```

`LICENSE`: the standard MIT text with `Copyright (c) 2026 Grégory Babonaux`.

- [ ] **Step 2: Create `cli/package.json`**

```json
{
  "name": "rulebook-cli",
  "version": "0.1.0",
  "description": "Keeps a living reference of a codebase's business rules: evidence index and change detection.",
  "type": "module",
  "bin": { "rulebook": "bin/rulebook.js" },
  "files": ["bin", "src"],
  "engines": { "node": ">=20" },
  "scripts": { "test": "node --test" },
  "license": "MIT"
}
```

- [ ] **Step 3: Write the test helpers**

`cli/test/helpers/io.js`:
```js
export function fakeIo(cwd) {
  const out = [];
  const err = [];
  return {
    cwd,
    stdout: { write: (s) => out.push(s) },
    stderr: { write: (s) => err.push(s) },
    now: () => new Date(2026, 9, 15, 14, 2),
    get out() { return out.join(''); },
    get err() { return err.join(''); },
  };
}
```

`cli/test/helpers/repo.js`:
```js
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export function makeRepo(files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rulebook-'));
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'test');
  git('config', 'core.autocrlf', 'false');
  const write = (rel, text) => {
    const p = path.join(dir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, text);
  };
  const commit = (msg = 'commit') => {
    git('add', '-A');
    git('commit', '-q', '-m', msg);
  };
  for (const [rel, text] of Object.entries(files)) write(rel, text);
  if (Object.keys(files).length) commit('init');
  return { dir, git, write, commit, read: (rel) => fs.readFileSync(path.join(dir, rel), 'utf8') };
}
```

- [ ] **Step 4: Write the failing test**

`cli/test/cli.test.js`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../src/cli.js';
import { fakeIo } from './helpers/io.js';

test('--version prints the package version', async () => {
  const io = fakeIo(process.cwd());
  assert.equal(await run(['--version'], io), 0);
  assert.equal(io.out, '0.1.0\n');
});

test('unknown command fails with the command list', async () => {
  const io = fakeIo(process.cwd());
  assert.equal(await run(['frobnicate'], io), 1);
  assert.match(io.err, /unknown command "frobnicate"/);
  assert.match(io.err, /index, check/);
});
```

- [ ] **Step 5: Run it to verify it fails**

Run: `cd cli && npm test`
Expected: FAIL with `Cannot find module '.../src/cli.js'`.

- [ ] **Step 6: Implement**

`cli/src/cli.js`:
```js
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

export async function run(argv, io) {
  const [cmd] = argv;
  if (cmd === '--version' || cmd === '-v') {
    io.stdout.write(`${pkg.version}\n`);
    return 0;
  }
  io.stderr.write(`rulebook: unknown command "${cmd ?? ''}". Commands: index, check\n`);
  return 1;
}
```

`cli/bin/rulebook.js`:
```js
#!/usr/bin/env node
import { run } from '../src/cli.js';

process.exitCode = await run(process.argv.slice(2), {
  cwd: process.cwd(),
  stdout: process.stdout,
  stderr: process.stderr,
});
```

- [ ] **Step 7: Run the tests and the binary**

Run: `cd cli && npm test && node bin/rulebook.js --version`
Expected: 2 tests pass, then the binary prints `0.1.0`.

- [ ] **Step 8: Commit**

```bash
git add .gitignore .gitattributes LICENSE cli
git commit -m "feat(cli): scaffold rulebook-cli with --version

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Card template and parser

**Files:**
- Create: `references/card-template.md`
- Create: `cli/src/parse/labels.js`, `cli/src/parse/cards.js`
- Create: `cli/test/helpers/fixture.js`
- Test: `cli/test/parse/cards.test.js`

**Interfaces:**
- Produces: `labelToKey(label: string): string | null`.
- Produces: `parseDomainFile(text: string, file?: string): { domain: {code, title, description} | null, cards: Card[], warnings: {file, line, message}[] }`.
- `Card` has this shape:
  ```
  { id, kind: 'policy'|'rule', title, domain, policy, line,
    meta: { kind, category, implements, status, confidence, audit, verifiedAt: {sha, date}|null, nature },
    sections: { [key]: string },
    evidence: { kind, path, start, end, symbol }[],
    edgeCases: { id, text, confidence, ref }[],
    history: { date, sha, change, note }[] }
  ```
  - `policy` is the ID of the policy a rule sits under, or `null`.
  - `meta.status` defaults to `'active'`.
- Produces the fixtures `POLICY_SRC`, `TEST_SRC` and `DOMAIN_MD` (strings), and `baseFiles()`, which returns a `{ path: content }` map for `makeRepo`.

- [ ] **Step 1: Write `references/card-template.md`**

````markdown
# Rule card template

This is the strict format every skill writes and the CLI parses. Headings, label syntax
and order are fixed. Values may be in the reference's language, except the
closed vocabularies, which always use the English codes below.

## Domain file — `rulebook/<CODE>-<slug>.md`

```markdown
# PAY · Payments
One paragraph describing the domain.

## PAY-P03 · Right of withdrawal
- **Kind:** policy · **Nature:** consumer law (withdrawal right)
**Statement.** A customer may withdraw from a purchase within a legal period.

### PAY-R012 · Refund allowed up to 14 days after delivery
- **Kind:** rule · **Category:** timing · **Implements:** PAY-P03
- **Status:** active · **Confidence:** verified · **Audit:** passed
- **Verified at:** a1b2c3d (2026-10-15)

**Rule.** A refund can be requested only if the order was delivered 14 days ago or less.

**Context.** Applies the withdrawal right. The window starts at delivery.

**Parameters.** `REFUND_WINDOW_DAYS = 14` — config/shop.php:14

**Evidence.**
- enforcement — app/Policies/OrderPolicy.php:41-47 `OrderPolicy::refund`
  `return $order->delivered_at?->diffInDays(now()) <= 14;`
- test — tests/Feature/RefundTest.php:88 `test_refund_refused_after_window`

**Edge cases.**
- **PAY-R012.E1** Given an order never delivered, when a refund is requested, then it is refused. — read — app/Policies/OrderPolicy.php:41

**Open questions.** Do public holidays count?

**History.**
- 2026-10-14 · b7e8f9a · changed · window 30 → 14 days
- 2026-10-02 · a1b2c3d · created

## Other operating rules

### PAY-R020 · …
```

## Syntax rules

- Metadata line: `- **Label:** value`, segments separated by ` · `. Write the colon inside the bold.
- Section: `**Label.** text`. The text may continue on the following lines until a blank line.
- Evidence: `- <kind> — <path>:<start>[-<end>] [`Symbol`]`, optionally followed by one indented excerpt line in backticks (5 lines max in total).
- Edge case: `- **<ID>** <Given/When/Then sentence> [— <confidence>] [— <path>:<line>]`.
- History: `- <YYYY-MM-DD> · <sha> · <created|changed|retired|reanchored> [· note]`.
- Rules that implement no policy go under `## Other operating rules` (any level-2 heading without a policy ID).

## Labels

| Key | English | Français |
|---|---|---|
| kind | Kind | Type |
| category | Category | Catégorie |
| implements | Implements | Applique |
| status | Status | Statut |
| confidence | Confidence | Confiance |
| audit | Audit | Audit |
| verifiedAt | Verified at | Vérifié sur |
| nature | Nature | Nature |
| statement | Statement | Énoncé |
| rule | Rule | La règle |
| context | Context | Contexte |
| parameters | Parameters | Paramètres |
| evidence | Evidence | Preuves |
| edgeCases | Edge cases | Cas limites |
| openQuestions | Open questions | Questions ouvertes |
| history | History | Historique |
| implementedBy | Implemented by | Appliquée par |

## Closed vocabularies (always English codes)

- kind: `policy`, `rule`
- category: `validation`, `calculation`, `authorization`, `state-transition`, `derivation`, `data-constraint`, `timing`, `integration`
- confidence: `verified`, `read`, `inferred`, `conflicting`
- audit: `passed`, `failed: <reason>`
- status: `candidate`, `active`, `changed`, `retired`
- evidence kind: `enforcement`, `test`, `config`, `schema`, `doc`
````

- [ ] **Step 2: Write the shared fixture**

`cli/test/helpers/fixture.js`:
```js
export const POLICY_SRC = [
  '<?php',
  'class OrderPolicy',
  '{',
  '    public function view($user, $order)',
  '    {',
  '        return $user->id === $order->user_id;',
  '    }',
  '',
  '    public function refund($user, $order)',
  '    {',
  '        return $order->delivered_at',
  '            && $order->delivered_at->diffInDays(now()) <= 14;',
  '    }',
  '}',
  '',
].join('\n');

export const TEST_SRC = [
  '<?php',
  'class RefundTest {',
  '    public function test_refund_refused_after_window() {',
  '        $this->assertFalse(refund(15));',
  '    }',
  '}',
  '',
].join('\n');

export const DOMAIN_MD = `# PAY · Payments
How the shop takes and refunds money.

## PAY-P03 · Right of withdrawal
- **Kind:** policy · **Nature:** consumer law
**Statement.** A customer may withdraw from a purchase within a legal period.

### PAY-R012 · Refund allowed up to 14 days after delivery
- **Kind:** rule · **Category:** timing · **Implements:** PAY-P03
- **Status:** active · **Confidence:** verified · **Audit:** passed
- **Verified at:** a1b2c3d (2026-10-15)

**Rule.** A refund can be requested only if the order was delivered 14 days ago or less.

**Context.** Applies the withdrawal right.
The window starts at delivery.

**Evidence.**
- enforcement — app/Policies/OrderPolicy.php:9-13 \`OrderPolicy::refund\`
  \`return $order->delivered_at && ...\`
- test — tests/RefundTest.php:3-5 \`test_refund_refused_after_window\`

**Edge cases.**
- **PAY-R012.E1** Given an order never delivered, when a refund is requested, then it is refused. — read — app/Policies/OrderPolicy.php:11
- **PAY-R012.E2** Given delivery exactly 14 days ago, when a refund is requested, then it is accepted. — verified

**Open questions.** Do public holidays count?

**History.**
- 2026-10-14 · b7e8f9a · changed · window 30 → 14 days
- 2026-10-02 · a1b2c3d · created

## Other operating rules

### PAY-R020 · Refunds are paid to the original payment method
- **Kind:** rule · **Category:** integration
- **Status:** active · **Confidence:** inferred

**Rule.** A refund is always sent back to the card used for the order.
`;

export function baseFiles() {
  return {
    'app/Policies/OrderPolicy.php': POLICY_SRC,
    'tests/RefundTest.php': TEST_SRC,
    'rulebook/PAY-payments.md': DOMAIN_MD,
    'rulebook/config.json': JSON.stringify({ language: 'en', hotspots: ['app/Rules/**'] }, null, 2),
  };
}
```

- [ ] **Step 3: Write the failing tests**

`cli/test/parse/cards.test.js`:
```js
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
```

- [ ] **Step 4: Run them to verify they fail**

Run: `cd cli && npm test`
Expected: FAIL with `Cannot find module '.../src/parse/cards.js'`.

- [ ] **Step 5: Implement `cli/src/parse/labels.js`**

```js
export const LABELS = {
  en: {
    kind: 'Kind', category: 'Category', implements: 'Implements', status: 'Status',
    confidence: 'Confidence', audit: 'Audit', verifiedAt: 'Verified at', nature: 'Nature',
    statement: 'Statement', rule: 'Rule', context: 'Context', parameters: 'Parameters',
    evidence: 'Evidence', edgeCases: 'Edge cases', openQuestions: 'Open questions',
    history: 'History', implementedBy: 'Implemented by',
  },
  fr: {
    kind: 'Type', category: 'Catégorie', implements: 'Applique', status: 'Statut',
    confidence: 'Confiance', audit: 'Audit', verifiedAt: 'Vérifié sur', nature: 'Nature',
    statement: 'Énoncé', rule: 'La règle', context: 'Contexte', parameters: 'Paramètres',
    evidence: 'Preuves', edgeCases: 'Cas limites', openQuestions: 'Questions ouvertes',
    history: 'Historique', implementedBy: 'Appliquée par',
  },
};

const norm = (s) => s.normalize('NFC').trim().toLowerCase();
const LOOKUP = new Map();
for (const labels of Object.values(LABELS)) {
  for (const [key, label] of Object.entries(labels)) LOOKUP.set(norm(label), key);
}

export function labelToKey(label) {
  return LOOKUP.get(norm(label)) ?? null;
}
```

- [ ] **Step 6: Implement `cli/src/parse/cards.js`**

```js
import { labelToKey } from './labels.js';

const H1 = /^#\s+([A-Z]{3})\s+·\s+(.+?)\s*$/;
const H2_POLICY = /^##\s+([A-Z]{3}-P\d+)\s+·\s+(.+?)\s*$/;
const H2_OTHER = /^##\s+\S/;
const H3_RULE = /^###\s+([A-Z]{3}-R\d+)\s+·\s+(.+?)\s*$/;
const META_LINE = /^-\s+\*\*[^*]+?:\*\*/;
const META_SEGMENT = /^\*\*([^*]+?):\*\*\s*(.*)$/;
const SECTION = /^\*\*([^*]+?)\.\*\*\s*(.*)$/;
const EVIDENCE = /^-\s+(enforcement|test|config|schema|doc)\s+[—–-]\s+(\S+?):(\d+)(?:-(\d+))?(?:\s+`([^`]+)`)?\s*$/;
const EDGE = /^-\s+\*\*([A-Z]{3}-R\d+\.E\d+)\*\*\s+(.+)$/;
const HISTORY = /^-\s+(\d{4}-\d{2}-\d{2})\s+·\s+([0-9a-f]{4,40})\s+·\s+(created|changed|retired|reanchored)(?:\s+·\s+(.*?))?\s*$/;
const CONFIDENCE = ['verified', 'read', 'inferred', 'conflicting'];
const LIST_SECTIONS = new Set(['evidence', 'edgeCases', 'history', 'implementedBy']);

function newCard(id, kind, title, domain, policy, line) {
  return {
    id, kind, title, domain, policy, line,
    meta: { kind: null, category: null, implements: null, status: 'active', confidence: null, audit: null, verifiedAt: null, nature: null },
    sections: {}, evidence: [], edgeCases: [], history: [],
  };
}

function parseMetaValue(key, raw) {
  const value = raw.trim();
  if (key === 'verifiedAt') {
    const m = value.match(/^([0-9a-f]{4,40})(?:\s+\((\d{4}-\d{2}-\d{2})\))?/);
    return m ? { sha: m[1], date: m[2] ?? null } : null;
  }
  if (key === 'implements') return /^[A-Z]{3}-P\d+$/.test(value) ? value : null;
  return value === '' ? null : value;
}

function parseEdge(id, rest) {
  const parts = rest.split(/\s+[—–]\s+/);
  let ref = null;
  let confidence = null;
  if (parts.length > 1 && /^\S+:\d+(-\d+)?$/.test(parts[parts.length - 1].trim())) ref = parts.pop().trim();
  if (parts.length > 1 && CONFIDENCE.includes(parts[parts.length - 1].trim())) confidence = parts.pop().trim();
  return { id, text: parts.join(' — ').trim(), confidence, ref };
}

export function parseDomainFile(text, file = '') {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const result = { domain: null, cards: [], warnings: [] };
  const warn = (i, message) => result.warnings.push({ file, line: i + 1, message });
  let card = null;
  let policy = null;
  let section = null;

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    let m;
    if ((m = line.match(H1))) {
      result.domain = { code: m[1], title: m[2], description: '' };
      card = null;
      section = 'domain';
      return;
    }
    if ((m = line.match(H2_POLICY))) {
      card = newCard(m[1], 'policy', m[2], result.domain?.code ?? null, null, i + 1);
      policy = m[1];
      result.cards.push(card);
      section = null;
      return;
    }
    if ((m = line.match(H3_RULE))) {
      card = newCard(m[1], 'rule', m[2], result.domain?.code ?? null, policy, i + 1);
      result.cards.push(card);
      section = null;
      return;
    }
    if (H2_OTHER.test(line)) {
      card = null;
      policy = null;
      section = null;
      return;
    }
    if (!card) {
      if (section === 'domain' && trimmed) {
        result.domain.description += (result.domain.description ? ' ' : '') + trimmed;
      }
      return;
    }
    if (trimmed === '') {
      if (section && !LIST_SECTIONS.has(section)) section = null;
      return;
    }
    if (section === null && META_LINE.test(trimmed)) {
      for (const seg of trimmed.replace(/^-\s+/, '').split(/\s+·\s+/)) {
        const sm = seg.match(META_SEGMENT);
        if (!sm) { warn(i, `unreadable metadata "${seg}"`); continue; }
        const key = labelToKey(sm[1]);
        if (!key || !(key in card.meta)) { warn(i, `unknown metadata label "${sm[1].trim()}"`); continue; }
        card.meta[key] = parseMetaValue(key, sm[2]);
      }
      return;
    }
    if ((m = trimmed.match(SECTION))) {
      const key = labelToKey(m[1]);
      if (!key) { warn(i, `unknown section "${m[1]}"`); section = '__unknown'; return; }
      section = key;
      if (!LIST_SECTIONS.has(key)) card.sections[key] = m[2].trim();
      return;
    }
    if (section === 'evidence') {
      if ((m = trimmed.match(EVIDENCE))) {
        card.evidence.push({ kind: m[1], path: m[2].replace(/\\/g, '/'), start: +m[3], end: m[4] ? +m[4] : +m[3], symbol: m[5] ?? null });
      } else if (trimmed.startsWith('-')) {
        warn(i, `unreadable evidence "${trimmed}"`);
      }
      return;
    }
    if (section === 'edgeCases') {
      if ((m = trimmed.match(EDGE))) card.edgeCases.push(parseEdge(m[1], m[2]));
      else if (trimmed.startsWith('-')) warn(i, `unreadable edge case "${trimmed}"`);
      return;
    }
    if (section === 'history') {
      if ((m = trimmed.match(HISTORY))) card.history.push({ date: m[1], sha: m[2], change: m[3], note: m[4] ?? null });
      else if (trimmed.startsWith('-')) warn(i, `unreadable history entry "${trimmed}"`);
      return;
    }
    if (section && section !== '__unknown' && section !== 'implementedBy') {
      card.sections[section] += (card.sections[section] ? ' ' : '') + trimmed;
    }
  });
  return result;
}
```

- [ ] **Step 7: Run the tests**

Run: `cd cli && npm test`
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add references/card-template.md cli/src/parse cli/test/parse cli/test/helpers/fixture.js
git commit -m "feat(cli): strict rule-card template and parser

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Range hashing, project loading and `rulebook index`

**Files:**
- Create: `cli/src/git.js`, `cli/src/project.js`, `cli/src/index/hash.js`, `cli/src/index/build.js`
- Modify: `cli/src/cli.js`
- Test: `cli/test/index/hash.test.js`, `cli/test/index/command.test.js`

**Interfaces:**
- Consumes: `parseDomainFile` (Task 2), `makeRepo`, `fakeIo`, `baseFiles` (Tasks 1–2).
- Produces from `git.js`:
  - `git(cwd, args): string | null`, which returns `null` on any failure;
  - `repoRoot(cwd): string | null`;
  - `headSha(root): string | null`, the short SHA.
- Produces from `project.js`:
  - `loadProject(cwd, dirName = 'rulebook'): { root, dir, dirName, config: { language, repoUrl, hotspots } } | null`. It returns `null` outside git or when the folder is missing, and throws on invalid `config.json`.
  - `domainFiles(dir): string[]`, the files matching `^[A-Z]{3}-.+\.md$`, sorted.
- Produces from `index/hash.js`:
  - `splitLines(text): string[]`, which normalises CRLF;
  - `normalizeLines(lines): string`;
  - `hashText(text): string` (12 hex characters);
  - `hashRange(lines, start, end): string`, with 1-based inclusive lines;
  - `findRange(lines, hash, length, hint = 1): number | null`, which returns the start line of the match nearest to `hint`.
- Produces from `index/build.js`:
  - `loadCards(project): { cards, warnings }`;
  - `buildIndex(root, cards, verifiedAt): { index: { version: 1, verifiedAt, anchors: Anchor[] }, unresolved: { rule, path, reason }[] }`;
  - `readIndex(dir)`, which returns an empty index when the file is absent and throws on invalid JSON;
  - `writeIndex(dir, index)`.
  - `Anchor` = `{ rule, kind, path, symbol, lines: [start, end], hash }`.

- [ ] **Step 1: Write the failing hash tests**

`cli/test/index/hash.test.js`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { splitLines, hashRange, findRange, hashText } from '../../src/index/hash.js';

const SRC = ['a', 'function refund() {', '  return x <= 14;', '}', 'z'];

test('hashText returns 12 hex chars', () => {
  assert.match(hashText('hello'), /^[0-9a-f]{12}$/);
});

test('hashRange ignores indentation, inner spacing, blank lines and CRLF', () => {
  const h = hashRange(SRC, 2, 4);
  const crlf = splitLines(SRC.join('\r\n'));
  assert.equal(hashRange(crlf, 2, 4), h);
  assert.equal(hashRange(['a', 'function   refund() {', '', '\treturn x <= 14;', '}'], 2, 5), h);
});

test('findRange relocates a drifted range and prefers the match nearest the hint', () => {
  const h = hashRange(SRC, 2, 4);
  const drifted = ['// new', '// lines', ...SRC];
  assert.equal(findRange(drifted, h, 3, 2), 4);
  const twice = [...SRC, ...SRC];
  assert.equal(findRange(twice, h, 3, 7), 7);
  assert.equal(findRange(['nothing'], h, 3, 1), null);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd cli && npm test`
Expected: FAIL with `Cannot find module '.../src/index/hash.js'`.

- [ ] **Step 3: Implement `cli/src/index/hash.js`**

```js
import { createHash } from 'node:crypto';

export function splitLines(text) {
  return text.replace(/\r\n?/g, '\n').split('\n');
}

export function normalizeLines(lines) {
  return lines.map((l) => l.replace(/\s+/g, ' ').trim()).filter((l) => l !== '').join('\n');
}

export function hashText(text) {
  return createHash('sha1').update(text).digest('hex').slice(0, 12);
}

export function hashRange(lines, start, end) {
  return hashText(normalizeLines(lines.slice(start - 1, end)));
}

export function findRange(lines, hash, length, hint = 1) {
  let best = null;
  for (let s = 1; s + length - 1 <= lines.length; s++) {
    if (hashRange(lines, s, s + length - 1) !== hash) continue;
    if (best === null || Math.abs(s - hint) < Math.abs(best - hint)) best = s;
  }
  return best;
}
```

- [ ] **Step 4: Run the hash tests**

Run: `cd cli && npm test`
Expected: hash tests pass.

- [ ] **Step 5: Write the failing command tests**

`cli/test/index/command.test.js`:
```js
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
```

- [ ] **Step 6: Run them to verify they fail**

Run: `cd cli && npm test`
Expected: FAIL. `run(['index'])` returns 1 with `unknown command "index"`.

- [ ] **Step 7: Implement `cli/src/git.js`**

```js
import { execFileSync } from 'node:child_process';

export function git(cwd, args) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return null;
  }
}

export function repoRoot(cwd) {
  return git(cwd, ['rev-parse', '--show-toplevel'])?.trim() || null;
}

export function headSha(root) {
  return git(root, ['rev-parse', '--short', 'HEAD'])?.trim() || null;
}
```

- [ ] **Step 8: Implement `cli/src/project.js`**

```js
import fs from 'node:fs';
import path from 'node:path';
import { repoRoot } from './git.js';

export const DEFAULT_CONFIG = { language: 'en', repoUrl: null, hotspots: [] };

export function loadProject(cwd, dirName = 'rulebook') {
  const root = repoRoot(cwd);
  if (!root) return null;
  const dir = path.join(root, dirName);
  if (!fs.existsSync(dir)) return null;
  const cfgPath = path.join(dir, 'config.json');
  const config = fs.existsSync(cfgPath)
    ? { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(cfgPath, 'utf8')) }
    : { ...DEFAULT_CONFIG };
  return { root, dir, dirName, config };
}

export function domainFiles(dir) {
  return fs.readdirSync(dir).filter((f) => /^[A-Z]{3}-.+\.md$/.test(f)).sort();
}
```

- [ ] **Step 9: Implement `cli/src/index/build.js`**

```js
import fs from 'node:fs';
import path from 'node:path';
import { parseDomainFile } from '../parse/cards.js';
import { domainFiles } from '../project.js';
import { splitLines, hashRange } from './hash.js';

export function loadCards(project) {
  const cards = [];
  const warnings = [];
  for (const f of domainFiles(project.dir)) {
    const parsed = parseDomainFile(fs.readFileSync(path.join(project.dir, f), 'utf8'), `${project.dirName}/${f}`);
    cards.push(...parsed.cards);
    warnings.push(...parsed.warnings);
  }
  return { cards, warnings };
}

export function buildIndex(root, cards, verifiedAt) {
  const anchors = [];
  const unresolved = [];
  for (const card of cards) {
    if (card.kind !== 'rule' || card.meta.status === 'retired') continue;
    for (const ev of card.evidence) {
      const abs = path.join(root, ev.path);
      if (!fs.existsSync(abs)) {
        unresolved.push({ rule: card.id, path: ev.path, reason: 'file not found' });
        continue;
      }
      const lines = splitLines(fs.readFileSync(abs, 'utf8'));
      if (ev.start < 1 || ev.end < ev.start || ev.end > lines.length) {
        unresolved.push({ rule: card.id, path: ev.path, reason: `lines ${ev.start}-${ev.end} out of range (file has ${lines.length})` });
        continue;
      }
      anchors.push({ rule: card.id, kind: ev.kind, path: ev.path, symbol: ev.symbol, lines: [ev.start, ev.end], hash: hashRange(lines, ev.start, ev.end) });
    }
  }
  return { index: { version: 1, verifiedAt, anchors }, unresolved };
}

export function readIndex(dir) {
  const p = path.join(dir, '.index.json');
  if (!fs.existsSync(p)) return { version: 1, verifiedAt: null, anchors: [] };
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

export function writeIndex(dir, index) {
  fs.writeFileSync(path.join(dir, '.index.json'), `${JSON.stringify(index, null, 2)}\n`);
}
```

- [ ] **Step 10: Wire `index` into `cli/src/cli.js`**

Replace the whole file with:
```js
import { readFileSync } from 'node:fs';
import { loadProject } from './project.js';
import { headSha } from './git.js';
import { loadCards, buildIndex, writeIndex } from './index/build.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

export function parseOptions(args) {
  const o = { scope: { kind: 'worktree' }, format: 'line', strict: false, dir: 'rulebook' };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--staged') o.scope = { kind: 'staged' };
    else if (a === '--worktree') o.scope = { kind: 'worktree' };
    else if (a === '--since') o.scope = { kind: 'since', sha: args[++i] };
    else if (a === '--format') o.format = args[++i];
    else if (a === '--strict') o.strict = true;
    else if (a === '--dir') o.dir = args[++i];
  }
  return o;
}

function runIndex(io, opts) {
  const project = loadProject(io.cwd, opts.dir);
  if (!project) {
    io.stderr.write(`rulebook: no ${opts.dir}/ folder in this git repository\n`);
    return 1;
  }
  const { cards, warnings } = loadCards(project);
  const { index, unresolved } = buildIndex(project.root, cards, headSha(project.root));
  writeIndex(project.dir, index);
  for (const w of warnings) io.stderr.write(`rulebook: ${w.file}:${w.line} ${w.message}\n`);
  for (const u of unresolved) io.stderr.write(`rulebook: ${u.rule} evidence ${u.path} unresolved (${u.reason})\n`);
  io.stdout.write(`rulebook: indexed ${index.anchors.length} anchors from ${cards.length} cards\n`);
  return unresolved.length && opts.strict ? 1 : 0;
}

export async function run(argv, io) {
  const [cmd, ...rest] = argv;
  const opts = parseOptions(rest);
  if (cmd === '--version' || cmd === '-v') {
    io.stdout.write(`${pkg.version}\n`);
    return 0;
  }
  if (cmd === 'index') return runIndex(io, opts);
  io.stderr.write(`rulebook: unknown command "${cmd ?? ''}". Commands: index, check\n`);
  return 1;
}
```

- [ ] **Step 11: Run all tests**

Run: `cd cli && npm test`
Expected: all tests pass.

- [ ] **Step 12: Commit**

```bash
git add cli/src cli/test/index
git commit -m "feat(cli): evidence range hashing and rulebook index

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Diff acquisition and parsing

**Files:**
- Create: `cli/src/git/diff.js`
- Test: `cli/test/git/diff.test.js`

**Interfaces:**
- Consumes: `git(cwd, args)` (Task 3), `makeRepo` (Task 1).
- Produces `parseUnifiedDiff(text): FileDiff[]`, where:
  - `FileDiff` = `{ path, oldPath, status: 'modified'|'added'|'deleted', hunks: Hunk[] }`;
  - `Hunk` = `{ oldStart, oldLines, newStart, newLines, removed: string[], added: string[] }`.
- Produces `getDiff(root, scope): FileDiff[]`, where `scope` is `{kind:'worktree'} | {kind:'staged'} | {kind:'since', sha}`. The worktree scope includes untracked, non-ignored files, as added files.

- [ ] **Step 1: Write the failing tests**

`cli/test/git/diff.test.js`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseUnifiedDiff, getDiff } from '../../src/git/diff.js';
import { makeRepo } from '../helpers/repo.js';

const SAMPLE = `diff --git a/app/a.php b/app/a.php
index 111..222 100644
--- a/app/a.php
+++ b/app/a.php
@@ -12 +12 @@ class A
-    return $x <= 14;
+    return $x <= 7;
@@ -20,0 +21,2 @@
+    throw new Forbidden();
+    // end
diff --git a/db/schema.sql b/db/schema.sql
--- a/db/schema.sql
+++ b/db/schema.sql
@@ -3,2 +3 @@
--- legacy comment
--- other
+-- new comment
diff --git a/old.js b/old.js
deleted file mode 100644
--- a/old.js
+++ /dev/null
@@ -1 +0,0 @@
-x
diff --git a/src/before.js b/src/after.js
similarity index 90%
rename from src/before.js
rename to src/after.js
`;

test('parses modified files with -U0 hunks', () => {
  const [a] = parseUnifiedDiff(SAMPLE);
  assert.equal(a.path, 'app/a.php');
  assert.equal(a.status, 'modified');
  assert.deepEqual(a.hunks[0], { oldStart: 12, oldLines: 1, newStart: 12, newLines: 1, removed: ['    return $x <= 14;'], added: ['    return $x <= 7;'] });
  assert.deepEqual(a.hunks[1], { oldStart: 20, oldLines: 0, newStart: 21, newLines: 2, removed: [], added: ['    throw new Forbidden();', '    // end'] });
});

test('removed lines starting with "--" are hunk content, not file headers', () => {
  const sql = parseUnifiedDiff(SAMPLE)[1];
  assert.equal(sql.path, 'db/schema.sql');
  assert.deepEqual(sql.hunks[0].removed, ['-- legacy comment', '-- other']);
  assert.deepEqual(sql.hunks[0].added, ['-- new comment']);
});

test('deleted and renamed files', () => {
  const files = parseUnifiedDiff(SAMPLE);
  assert.deepEqual([files[2].path, files[2].status], ['old.js', 'deleted']);
  assert.deepEqual([files[3].oldPath, files[3].path, files[3].hunks.length], ['src/before.js', 'src/after.js', 0]);
});

test('CRLF diff text parses like LF', () => {
  assert.deepEqual(parseUnifiedDiff(SAMPLE.replace(/\n/g, '\r\n')), parseUnifiedDiff(SAMPLE));
});

test('getDiff worktree includes tracked edits and untracked files', () => {
  const repo = makeRepo({ 'a.js': 'one\ntwo\n', '.gitignore': 'ignored.js\n' });
  repo.write('a.js', 'one\nTWO\n');
  repo.write('new.js', 'throw x;\n');
  repo.write('ignored.js', 'nope\n');
  const files = getDiff(repo.dir, { kind: 'worktree' });
  assert.deepEqual(files.map((f) => [f.path, f.status]), [['a.js', 'modified'], ['new.js', 'added']]);
  assert.deepEqual(files[1].hunks[0], { oldStart: 0, oldLines: 0, newStart: 1, newLines: 1, removed: [], added: ['throw x;'] });
});

test('getDiff staged and since scopes', () => {
  const repo = makeRepo({ 'a.js': 'one\n' });
  const first = repo.git('rev-parse', 'HEAD').trim();
  repo.write('a.js', 'one\ntwo\n');
  repo.git('add', 'a.js');
  assert.equal(getDiff(repo.dir, { kind: 'staged' })[0].hunks[0].added[0], 'two');
  repo.commit('second');
  assert.equal(getDiff(repo.dir, { kind: 'since', sha: first })[0].path, 'a.js');
});

test('getDiff works in a repository with no commit yet', () => {
  const repo = makeRepo();
  repo.write('a.js', 'x\n');
  assert.deepEqual(getDiff(repo.dir, { kind: 'worktree' }).map((f) => f.path), ['a.js']);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd cli && npm test`
Expected: FAIL with `Cannot find module '.../src/git/diff.js'`.

- [ ] **Step 3: Implement `cli/src/git/diff.js`**

```js
import fs from 'node:fs';
import path from 'node:path';
import { git } from '../git.js';

const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const HUNK = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;
const MAX_UNTRACKED_BYTES = 1024 * 1024;

export function parseUnifiedDiff(text) {
  const files = [];
  let file = null;
  let hunk = null;
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (line.startsWith('diff --git ')) {
      file = { path: null, oldPath: null, status: 'modified', hunks: [] };
      files.push(file);
      hunk = null;
      continue;
    }
    if (!file) continue;
    if (hunk === null) {
      if (line.startsWith('new file mode')) { file.status = 'added'; continue; }
      if (line.startsWith('deleted file mode')) { file.status = 'deleted'; continue; }
      if (line.startsWith('rename from ')) { file.oldPath = line.slice('rename from '.length); continue; }
      if (line.startsWith('rename to ')) { file.path = line.slice('rename to '.length); continue; }
      if (line.startsWith('--- ')) {
        const p = line.slice(4);
        if (p !== '/dev/null') file.oldPath ??= p.replace(/^a\//, '');
        continue;
      }
      if (line.startsWith('+++ ')) {
        const p = line.slice(4);
        if (p !== '/dev/null') file.path = p.replace(/^b\//, '');
        continue;
      }
    }
    const m = line.match(HUNK);
    if (m) {
      hunk = {
        oldStart: +m[1], oldLines: m[2] === undefined ? 1 : +m[2],
        newStart: +m[3], newLines: m[4] === undefined ? 1 : +m[4],
        removed: [], added: [],
      };
      file.hunks.push(hunk);
      continue;
    }
    if (!hunk) continue;
    if (line.startsWith('+')) hunk.added.push(line.slice(1));
    else if (line.startsWith('-')) hunk.removed.push(line.slice(1));
  }
  for (const f of files) {
    f.path ??= f.oldPath;
    f.oldPath ??= f.path;
  }
  return files.filter((f) => f.path);
}

function untrackedAsAdded(root) {
  const out = git(root, ['-c', 'core.quotepath=false', 'ls-files', '--others', '--exclude-standard']) ?? '';
  return out.split('\n').filter(Boolean).flatMap((p) => {
    const abs = path.join(root, p);
    if (fs.statSync(abs).size > MAX_UNTRACKED_BYTES) return [];
    const lines = fs.readFileSync(abs, 'utf8').replace(/\r\n?/g, '\n').split('\n');
    if (lines.at(-1) === '') lines.pop();
    return [{ path: p, oldPath: p, status: 'added', hunks: [{ oldStart: 0, oldLines: 0, newStart: 1, newLines: lines.length, removed: [], added: lines }] }];
  });
}

export function getDiff(root, scope = { kind: 'worktree' }) {
  const base = ['-c', 'core.quotepath=false', 'diff', '-U0', '--no-color', '--no-ext-diff', '-M'];
  let args;
  if (scope.kind === 'staged') args = [...base, '--cached'];
  else if (scope.kind === 'since') args = [...base, scope.sha];
  else args = [...base, git(root, ['rev-parse', '--verify', '-q', 'HEAD']) ? 'HEAD' : EMPTY_TREE];
  const files = parseUnifiedDiff(git(root, args) ?? '');
  if (scope.kind === 'worktree') files.push(...untrackedAsAdded(root));
  return files;
}
```

- [ ] **Step 4: Run the tests**

Run: `cd cli && npm test`
Expected: all tests pass. If the "no commit yet" test fails on `git diff <EMPTY_TREE>`, check that `git rev-parse --verify -q HEAD` returns `null` through the `git()` wrapper (it exits 1). The file must then be reported through the untracked path.

- [ ] **Step 5: Commit**

```bash
git add cli/src/git cli/test/git
git commit -m "feat(cli): unified diff parsing and diff scopes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Change detection

**Files:**
- Create: `cli/src/check/globs.js`, `cli/src/check/patterns.js`, `cli/src/check/detect.js`
- Test: `cli/test/check/detect.test.js`

**Interfaces:**
- Consumes: `splitLines`, `hashRange`, `findRange`, `hashText` (Task 3), and the `FileDiff` shape (Task 4).
- Produces:
  - `globToRegExp(glob): RegExp`;
  - `matchesAny(path, globs): boolean`;
  - `isRuleBearing(line): boolean`;
  - `TEST_PATH: RegExp`;
  - `detect({ index, diffs, readFile, hotspots = [], rulebookDir = 'rulebook' }): Detection[]`, where:
    - `readFile(path)` returns the current text, or `null` when the file is unreadable;
    - `Detection` = `{ type: 'modified?'|'removed?'|'new?', rule: string|null, path, lines: [start, end], key }`;
    - `key` = `hashText(\`${type}|${rule ?? ''}|${path}\`)`. It stays stable across repeated edits of the same file, so dedup is per pending item.

- [ ] **Step 1: Write the failing tests**

`cli/test/check/detect.test.js`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { detect } from '../../src/check/detect.js';
import { globToRegExp, matchesAny } from '../../src/check/globs.js';
import { isRuleBearing } from '../../src/check/patterns.js';
import { splitLines, hashRange } from '../../src/index/hash.js';
import { POLICY_SRC } from '../helpers/fixture.js';

const PATH = 'app/Policies/OrderPolicy.php';
const anchor = { rule: 'PAY-R012', kind: 'enforcement', path: PATH, symbol: 'OrderPolicy::refund', lines: [9, 13], hash: hashRange(splitLines(POLICY_SRC), 9, 13) };
const index = { version: 1, verifiedAt: 'abc', anchors: [anchor] };
const modified = (hunks) => [{ path: PATH, oldPath: PATH, status: 'modified', hunks }];
const hunk = (newStart, added, removed = []) => ({ oldStart: newStart, oldLines: removed.length, newStart, newLines: added.length, removed, added });
const reader = (text) => (p) => (p === PATH ? text : null);

test('globs', () => {
  assert.ok(globToRegExp('app/Rules/**').test('app/Rules/Deep/Min.php'));
  assert.ok(globToRegExp('**/*Policy.php').test('OrderPolicy.php'));
  assert.ok(globToRegExp('**/*Policy.php').test('app/x/OrderPolicy.php'));
  assert.ok(!globToRegExp('app/*.php').test('app/x/y.php'));
  assert.ok(matchesAny('db/migrations/1.sql', ['src/**', 'db/**']));
});

test('rule-bearing patterns ignore comments', () => {
  assert.ok(isRuleBearing('    throw new ValidationException("x");'));
  assert.ok(isRuleBearing("    'email' => 'required|email',"));
  assert.ok(isRuleBearing('    abort_if($user->isBanned(), 403);'));
  assert.ok(!isRuleBearing('    // throw later'));
  assert.ok(!isRuleBearing('    $total = $a + $b;'));
});

test('editing inside an anchored range reports modified?', () => {
  const text = POLICY_SRC.replace('<= 14', '<= 7');
  const d = detect({ index, diffs: modified([hunk(12, ['            && $order->delivered_at->diffInDays(now()) <= 7;'], ['x'])]), readFile: reader(text) });
  assert.equal(d.length, 1);
  assert.deepEqual({ type: d[0].type, rule: d[0].rule, path: d[0].path, lines: d[0].lines }, { type: 'modified?', rule: 'PAY-R012', path: PATH, lines: [9, 13] });
  assert.match(d[0].key, /^[0-9a-f]{12}$/);
});

test('line drift above the anchor reports nothing', () => {
  const text = `// header\n// header\n${POLICY_SRC}`;
  assert.deepEqual(detect({ index, diffs: modified([hunk(1, ['// header', '// header'])]), readFile: reader(text) }), []);
});

test('removing the symbol reports removed?', () => {
  const text = POLICY_SRC.split('\n').slice(0, 7).concat(['}', '']).join('\n');
  const d = detect({ index, diffs: modified([hunk(8, [], ['x'])]), readFile: reader(text) });
  assert.deepEqual(d.map((x) => [x.type, x.rule]), [['removed?', 'PAY-R012']]);
});

test('a deleted file reports removed?', () => {
  const d = detect({ index, diffs: [{ path: PATH, oldPath: PATH, status: 'deleted', hunks: [] }], readFile: () => null });
  assert.deepEqual(d.map((x) => x.type), ['removed?']);
});

test('a renamed file keeps its anchors', () => {
  const d = detect({ index, diffs: [{ path: 'app/Policies/Renamed.php', oldPath: PATH, status: 'modified', hunks: [] }], readFile: () => POLICY_SRC });
  assert.deepEqual(d, []);
});

test('rule-bearing code outside any anchor reports new?', () => {
  const svc = 'app/Services/Coupon.php';
  const d = detect({ index, diffs: [{ path: svc, oldPath: svc, status: 'modified', hunks: [hunk(3, ['  if ($c->expired()) throw new Gone();'])] }], readFile: () => 'a\nb\n  if ($c->expired()) throw new Gone();\n' });
  assert.deepEqual(d.map((x) => [x.type, x.rule, x.path, x.lines]), [['new?', null, svc, [3, 3]]]);
});

test('any non-blank change in a hotspot reports new?, plain code elsewhere does not', () => {
  const hot = 'app/Rules/Min.php';
  const diffs = [
    { path: hot, oldPath: hot, status: 'added', hunks: [hunk(1, ['return $v > 3;'])] },
    { path: 'app/Util.php', oldPath: 'app/Util.php', status: 'added', hunks: [hunk(1, ['return $v > 3;'])] },
  ];
  const d = detect({ index, diffs, readFile: () => 'return $v > 3;\n', hotspots: ['app/Rules/**'] });
  assert.deepEqual(d.map((x) => x.path), [hot]);
});

test('test files and the rulebook folder never produce new?', () => {
  const diffs = ['tests/FooTest.php', 'rulebook/PAY-payments.md'].map((p) => ({ path: p, oldPath: p, status: 'added', hunks: [hunk(1, ['throw new X();'])] }));
  assert.deepEqual(detect({ index, diffs, readFile: () => 'throw new X();\n', hotspots: ['**'] }), []);
});

test('an edit inside an anchor does not also produce new?', () => {
  const text = POLICY_SRC.replace('<= 14;', '<= 14 || throw new Late();');
  const d = detect({ index, diffs: modified([hunk(12, ['            && $order->delivered_at->diffInDays(now()) <= 14 || throw new Late();'], ['x'])]), readFile: reader(text) });
  assert.deepEqual(d.map((x) => x.type), ['modified?']);
});

test('two anchors of the same rule in one file give one detection', () => {
  const twin = { ...anchor, lines: [4, 7], hash: 'deadbeef0000' };
  const d = detect({ index: { ...index, anchors: [anchor, twin] }, diffs: modified([hunk(12, ['x'], ['y'])]), readFile: reader(POLICY_SRC.replace('<= 14', '<= 7')) });
  assert.equal(d.filter((x) => x.rule === 'PAY-R012').length, 1);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd cli && npm test`
Expected: FAIL with `Cannot find module '.../src/check/detect.js'`.

- [ ] **Step 3: Implement `cli/src/check/globs.js`**

```js
export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        i++;
        if (glob[i + 1] === '/') { i++; re += '(?:.*/)?'; } else re += '.*';
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${re}$`);
}

export function matchesAny(p, globs) {
  return globs.some((g) => globToRegExp(g).test(p));
}
```

- [ ] **Step 4: Implement `cli/src/check/patterns.js`**

```js
export const RULE_PATTERNS = [
  /\b(throw|raise)\b/,
  /\babort(_if|_unless)?\s*\(/,
  /\b\w*(ValidationException|AuthorizationException|PermissionDenied|Forbidden|Unauthorized)\b/,
  /->authorize\(|\bGate::|@PreAuthorize|\bauthorize!?\(/,
  /['"](required|nullable|unique|exists|min:\d+|max:\d+|between:)/,
  /\bCHECK\s*\(|\bUNIQUE\b|->unique\(|unique\s*=\s*True/,
];

export const TEST_PATH = /(^|\/)(tests?|specs?|__tests__)\/|\.(test|spec)\.[a-z]+$|_test\.(go|py)$|Test\.php$/;

const COMMENT = /^(\/\/|#|\*|\/\*|--)/;

export function isRuleBearing(line) {
  const code = line.trim();
  if (!code || COMMENT.test(code)) return false;
  return RULE_PATTERNS.some((re) => re.test(code));
}
```

- [ ] **Step 5: Implement `cli/src/check/detect.js`**

```js
import { splitLines, findRange, hashText } from '../index/hash.js';
import { matchesAny } from './globs.js';
import { isRuleBearing, TEST_PATH } from './patterns.js';

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function symbolPresent(text, symbol) {
  if (!symbol) return true;
  const name = symbol.split(/::|->|[.#]/).pop().replace(/\(.*$/, '');
  if (!name) return true;
  return new RegExp(`\\b${escapeRe(name)}\\b`).test(text);
}

const keyOf = (type, rule, path) => hashText(`${type}|${rule ?? ''}|${path}`);

export function detect({ index, diffs, readFile, hotspots = [], rulebookDir = 'rulebook' }) {
  const detections = [];
  for (const f of diffs) {
    if (f.path.startsWith(`${rulebookDir}/`)) continue;
    const anchors = index.anchors.filter((a) => a.path === f.path || a.path === f.oldPath);
    const text = f.status === 'deleted' ? null : readFile(f.path);
    const lines = text == null ? null : splitLines(text);
    const covered = [];
    const reported = new Set();

    for (const a of anchors) {
      const len = a.lines[1] - a.lines[0] + 1;
      const at = lines ? findRange(lines, a.hash, len, a.lines[0]) : null;
      if (at !== null) { covered.push([at, at + len - 1]); continue; }
      covered.push(a.lines);
      const type = lines && symbolPresent(text, a.symbol) ? 'modified?' : 'removed?';
      if (reported.has(`${type}|${a.rule}`)) continue;
      reported.add(`${type}|${a.rule}`);
      detections.push({ type, rule: a.rule, path: f.path, lines: a.lines, key: keyOf(type, a.rule, f.path) });
    }

    if (!lines || TEST_PATH.test(f.path)) continue;
    const hot = matchesAny(f.path, hotspots);
    for (const h of f.hunks) {
      if (!h.added.length) continue;
      const bearing = hot ? h.added.some((l) => l.trim() !== '') : h.added.some(isRuleBearing);
      if (!bearing) continue;
      const s = h.newStart;
      const e = h.newStart + h.added.length - 1;
      if (covered.some(([as, ae]) => s <= ae && e >= as)) continue;
      detections.push({ type: 'new?', rule: null, path: f.path, lines: [s, e], key: keyOf('new?', null, f.path) });
      break;
    }
  }
  return detections;
}
```

> The `break` after the first `new?` is intentional. One pending "possible new rule" entry per file is enough, because `rulebook-sync` re-reads the whole file diff.

- [ ] **Step 6: Run the tests**

Run: `cd cli && npm test`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add cli/src/check cli/test/check
git commit -m "feat(cli): detect modified, removed and new rules from a diff

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Inbox and the `rulebook check` command

**Files:**
- Create: `cli/src/inbox/inbox.js`
- Modify: `cli/src/cli.js` (add the `check` command)
- Test: `cli/test/inbox/inbox.test.js`, `cli/test/check/command.test.js`

**Interfaces:**
- Consumes:
  - `loadProject`, `readIndex`, `getDiff`, `detect`, `git` (Tasks 3–5);
  - `parseOptions` (Task 3), with `scope`, `format`, `strict` and `dir`.
- Produces:
  - `pendingKeys(text): Set<string>`, which only reads unchecked `- [ ]` entries;
  - `formatEntry(detection, now: Date): string`;
  - `formatNotice(detection, inboxRel): string`;
  - `appendDetections(file, detections, now): Detection[]`, which returns the entries actually added;
  - the `rulebook check [--worktree|--staged|--since <sha>] [--format line|json] [--strict] [--dir <name>]` command.
- JSON output: `{"detections": Detection[], "added": string[]}`. `added` holds the keys of the entries written in this run.

- [ ] **Step 1: Write the failing inbox tests**

`cli/test/inbox/inbox.test.js`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appendDetections, pendingKeys, formatEntry, formatNotice } from '../../src/inbox/inbox.js';

const now = new Date(2026, 9, 15, 14, 2);
const mod = { type: 'modified?', rule: 'PAY-R012', path: 'app/Policies/OrderPolicy.php', lines: [41, 47], key: 'aaaaaaaaaaaa' };
const neu = { type: 'new?', rule: null, path: 'app/Services/Coupon.php', lines: [3, 3], key: 'bbbbbbbbbbbb' };

test('entry and notice formats', () => {
  assert.equal(formatEntry(mod, now), '- [ ] 2026-10-15 14:02 · modified? · PAY-R012 · app/Policies/OrderPolicy.php:41-47 · key aaaaaaaaaaaa');
  assert.equal(formatEntry(neu, now), '- [ ] 2026-10-15 14:02 · new? · — · app/Services/Coupon.php:3-3 · key bbbbbbbbbbbb');
  assert.equal(formatNotice(mod, 'rulebook/inbox.md'), 'rulebook: PAY-R012 may have changed (OrderPolicy.php) → rulebook/inbox.md');
  assert.equal(formatNotice({ ...mod, type: 'removed?' }, 'rulebook/inbox.md'), 'rulebook: PAY-R012 may have been removed (OrderPolicy.php) → rulebook/inbox.md');
  assert.equal(formatNotice(neu, 'rulebook/inbox.md'), 'rulebook: possible new rule in app/Services/Coupon.php:3 → rulebook/inbox.md');
});

test('appendDetections creates the inbox with a header and dedups pending keys', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rulebook-inbox-')), 'inbox.md');
  assert.equal(appendDetections(file, [mod, neu, mod], now).length, 2);
  assert.equal(appendDetections(file, [mod], now).length, 0);
  const text = fs.readFileSync(file, 'utf8');
  assert.match(text, /^# rulebook inbox\n/);
  assert.equal(text.match(/^- \[ \]/gm).length, 2);
});

test('a checked entry no longer blocks a new detection with the same key', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rulebook-inbox-')), 'inbox.md');
  appendDetections(file, [mod], now);
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('- [ ]', '- [x]'));
  assert.deepEqual([...pendingKeys(fs.readFileSync(file, 'utf8'))], []);
  assert.equal(appendDetections(file, [mod], now).length, 1);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd cli && npm test`
Expected: FAIL with `Cannot find module '.../src/inbox/inbox.js'`.

- [ ] **Step 3: Implement `cli/src/inbox/inbox.js`**

```js
import fs from 'node:fs';

const KEY = /· key ([0-9a-f]{12})\s*$/;
const pad = (n) => String(n).padStart(2, '0');

export const INBOX_HEADER = '# rulebook inbox\n\nDetections awaiting validation. Process them with the rulebook-sync skill.\n\n';

export function pendingKeys(text) {
  return new Set(
    text.replace(/\r\n?/g, '\n').split('\n')
      .filter((l) => l.startsWith('- [ ]'))
      .map((l) => l.match(KEY)?.[1])
      .filter(Boolean),
  );
}

export function formatStamp(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatEntry(det, now) {
  const where = det.lines ? `${det.path}:${det.lines[0]}-${det.lines[1]}` : det.path;
  return `- [ ] ${formatStamp(now)} · ${det.type} · ${det.rule ?? '—'} · ${where} · key ${det.key}`;
}

export function formatNotice(det, inboxRel) {
  if (det.type === 'new?') return `rulebook: possible new rule in ${det.path}:${det.lines[0]} → ${inboxRel}`;
  const verb = det.type === 'removed?' ? 'may have been removed' : 'may have changed';
  return `rulebook: ${det.rule} ${verb} (${det.path.split('/').pop()}) → ${inboxRel}`;
}

export function appendDetections(file, detections, now = new Date()) {
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const seen = pendingKeys(existing);
  const added = [];
  for (const d of detections) {
    if (seen.has(d.key)) continue;
    seen.add(d.key);
    added.push(d);
  }
  if (added.length) {
    const prefix = existing ? (existing.endsWith('\n') ? '' : '\n') : INBOX_HEADER;
    fs.appendFileSync(file, `${prefix}${added.map((d) => formatEntry(d, now)).join('\n')}\n`);
  }
  return added;
}
```

- [ ] **Step 4: Run the inbox tests**

Run: `cd cli && npm test`
Expected: inbox tests pass.

- [ ] **Step 5: Write the failing command tests**

`cli/test/check/command.test.js`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run } from '../../src/cli.js';
import { fakeIo } from '../helpers/io.js';
import { makeRepo } from '../helpers/repo.js';
import { baseFiles, POLICY_SRC } from '../helpers/fixture.js';

async function indexedRepo() {
  const repo = makeRepo(baseFiles());
  await run(['index'], fakeIo(repo.dir));
  repo.commit('index');
  return repo;
}
const check = async (repo, args = []) => {
  const io = fakeIo(repo.dir);
  const code = await run(['check', ...args], io);
  return { code, out: io.out, err: io.err };
};
const POLICY = 'app/Policies/OrderPolicy.php';

test('changing a rule prints one notice and writes the inbox', async () => {
  const repo = await indexedRepo();
  repo.write(POLICY, POLICY_SRC.replace('<= 14', '<= 7'));
  const r = await check(repo);
  assert.equal(r.code, 0);
  assert.equal(r.out, 'rulebook: PAY-R012 may have changed (OrderPolicy.php) → rulebook/inbox.md\n');
  assert.match(repo.read('rulebook/inbox.md'), /- \[ \] 2026-10-15 14:02 · modified\? · PAY-R012 · app\/Policies\/OrderPolicy\.php:9-13 · key [0-9a-f]{12}/);
});

test('repeated checks during a session stay quiet and never duplicate entries', async () => {
  const repo = await indexedRepo();
  repo.write(POLICY, POLICY_SRC.replace('<= 14', '<= 7'));
  await check(repo);
  repo.write(POLICY, POLICY_SRC.replace('<= 14', '<= 5'));
  const second = await check(repo);
  assert.equal(second.out, '');
  assert.equal(repo.read('rulebook/inbox.md').match(/^- \[ \]/gm).length, 1);
});

test('line drift and CRLF-only rewrites report nothing', async () => {
  const repo = await indexedRepo();
  repo.write(POLICY, `// moved\n// down\n${POLICY_SRC}`);
  assert.equal((await check(repo)).out, '');
  repo.write(POLICY, POLICY_SRC.replace(/\n/g, '\r\n'));
  assert.equal((await check(repo)).out, '');
  assert.equal(fs.existsSync(path.join(repo.dir, 'rulebook/inbox.md')), false);
});

test('removing the rule reports removed?', async () => {
  const repo = await indexedRepo();
  repo.write(POLICY, POLICY_SRC.split('\n').slice(0, 7).concat(['}', '']).join('\n'));
  assert.equal((await check(repo)).out, 'rulebook: PAY-R012 may have been removed (OrderPolicy.php) → rulebook/inbox.md\n');
});

test('an untracked file with a guard reports a possible new rule', async () => {
  const repo = await indexedRepo();
  repo.write('app/Services/Coupon.php', '<?php\n\nif ($coupon->expired()) throw new Gone();\n');
  assert.equal((await check(repo)).out, 'rulebook: possible new rule in app/Services/Coupon.php:1 → rulebook/inbox.md\n');
});

test('--staged reads the staged content', async () => {
  const repo = await indexedRepo();
  repo.write(POLICY, POLICY_SRC.replace('<= 14', '<= 7'));
  repo.git('add', POLICY);
  repo.write(POLICY, POLICY_SRC);
  assert.match((await check(repo, ['--staged'])).out, /PAY-R012 may have changed/);
});

test('--since compares with a past commit', async () => {
  const repo = await indexedRepo();
  const base = repo.git('rev-parse', 'HEAD').trim();
  repo.write(POLICY, POLICY_SRC.replace('<= 14', '<= 7'));
  repo.commit('shorten window');
  assert.match((await check(repo, ['--since', base])).out, /PAY-R012 may have changed/);
});

test('--format json and --strict', async () => {
  const repo = await indexedRepo();
  repo.write(POLICY, POLICY_SRC.replace('<= 14', '<= 7'));
  const r = await check(repo, ['--format', 'json', '--strict']);
  assert.equal(r.code, 1);
  const payload = JSON.parse(r.out);
  assert.equal(payload.detections[0].rule, 'PAY-R012');
  assert.equal(payload.added.length, 1);
});

test('hostile environments: no git, no rulebook, corrupt index -> exit 0', async () => {
  const nogit = fakeIo(fs.mkdtempSync(path.join(os.tmpdir(), 'rulebook-nogit-')));
  assert.equal(await run(['check'], nogit), 0);
  assert.equal(nogit.out + nogit.err, '');

  const bare = makeRepo({ 'a.js': 'throw x;\n' });
  assert.equal((await check(bare)).code, 0);

  const repo = await indexedRepo();
  fs.writeFileSync(path.join(repo.dir, 'rulebook/.index.json'), '{ not json');
  repo.write(POLICY, POLICY_SRC.replace('<= 14', '<= 7'));
  const r = await check(repo);
  assert.equal(r.code, 0);
  assert.match(r.err, /^rulebook: check skipped \(/);
  assert.equal((await check(repo, ['--strict'])).code, 2);
});
```

- [ ] **Step 6: Run them to verify they fail**

Run: `cd cli && npm test`
Expected: FAIL with `unknown command "check"`.

- [ ] **Step 7: Add `check` to `cli/src/cli.js`**

Add these imports at the top:
```js
import fs from 'node:fs';
import path from 'node:path';
import { git } from './git.js';
import { readIndex } from './index/build.js';
import { getDiff } from './git/diff.js';
import { detect } from './check/detect.js';
import { appendDetections, formatNotice } from './inbox/inbox.js';
```
(`headSha` is already imported from `./git.js`. Merge the import: `import { git, headSha } from './git.js';`. Also merge `readIndex` into the existing `./index/build.js` import.)

Add this function above `run`:
```js
function runCheck(io, opts) {
  try {
    const project = loadProject(io.cwd, opts.dir);
    if (!project) return 0;
    const index = readIndex(project.dir);
    const diffs = getDiff(project.root, opts.scope);
    const readFile = opts.scope.kind === 'staged'
      ? (p) => git(project.root, ['show', `:${p}`])
      : (p) => { try { return fs.readFileSync(path.join(project.root, p), 'utf8'); } catch { return null; } };
    const detections = detect({ index, diffs, readFile, hotspots: project.config.hotspots, rulebookDir: project.dirName });
    const inboxRel = `${project.dirName}/inbox.md`;
    const added = appendDetections(path.join(project.dir, 'inbox.md'), detections, io.now ? io.now() : new Date());
    if (opts.format === 'json') {
      io.stdout.write(`${JSON.stringify({ detections, added: added.map((d) => d.key) })}\n`);
    } else {
      for (const d of added) io.stdout.write(`${formatNotice(d, inboxRel)}\n`);
    }
    return opts.strict && detections.length ? 1 : 0;
  } catch (err) {
    io.stderr.write(`rulebook: check skipped (${err.message})\n`);
    return opts.strict ? 2 : 0;
  }
}
```

In `run`, before the unknown-command fallback, add:
```js
  if (cmd === 'check') return runCheck(io, opts);
```

- [ ] **Step 8: Run all tests**

Run: `cd cli && npm test`
Expected: all tests pass.

- [ ] **Step 9: Manual smoke test with the real binary**

Run:
```bash
cd cli && node bin/rulebook.js check; echo "exit=$?"
```
Expected: `exit=0` with no output. This repo has no `rulebook/` folder, which confirms the silent path.

- [ ] **Step 10: Commit**

```bash
git add cli/src cli/test/inbox cli/test/check/command.test.js
git commit -m "feat(cli): rulebook check writes the inbox and prints one-line notices

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## What the next plans build on

| Plan | Uses from this plan |
|---|---|
| 2 — adapters, `init`, `hook`, `doctor` | `run(['check', '--format', 'json'])` and `formatNotice`, to answer each agent's hook format |
| 3 — HTML `build` | `loadCards(project)` and the `Card` shape |
| 4 — skills | `references/card-template.md` as the contract; `rulebook index` after writing cards; the inbox format for `rulebook-sync` |
| 5 — distribution | `cli/package.json` (`bin.rulebook`), the repo layout |
