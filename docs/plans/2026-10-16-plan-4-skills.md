# rulebook — Plan 4: the five skills, shared references and their evaluation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Every skill follows superpowers:writing-skills: RED (baseline without the skill), then GREEN (the skill), then REFACTOR. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship the five portable Agent Skills, together with the shared `references/` copied into each skill:
- `rulebook-map`
- `rulebook-extract`
- `rulebook-edge-cases`
- `rulebook-sync`
- `rulebook-publish`

They are evaluated against a fixture app whose rules are known.

**Architecture:**
- Skills live in `skills/<name>/SKILL.md`.
- `references/` is the source of truth. `scripts/sync-references.mjs` copies it into every `skills/<name>/references/`, and `--check` fails when a copy drifts.
- An eval harness runs on `tests/skills/shop/`, a small JavaScript shop with planted rules, traps and a ground truth (`expected.json`). `tests/skills/score.mjs` scores a produced `rulebook/` with the CLI's own parser.

**Spec:** `E:\Dev\rulebook\docs\specs\2026-10-15-rulebook-design.md`, §3, §5.1, §5.2, §9 and §11.

## Global Constraints

**Portability (spec §5.1)**
- No vendor tool names in any SKILL.md. Instructions describe capabilities: "ask the user", "if you can start a sub-agent…".
- Every step that uses the CLI has a manual fallback for when Node is absent.

**Format of each SKILL.md**
- Frontmatter has only `name` and `description`. The description starts with "Use when", is written in the third person, states triggers only and never summarises the workflow.
- The body is under 500 words. Detail goes into `references/`, loaded on demand.

**Behaviour**
- Skills never modify the analysed source code and never write tests.
- They write only under `rulebook/`.
- The reference is written in the project's or user's language. The skills themselves are in English.
- Every checkpoint is a real stop: the skill asks the user and waits.

**`rulebook-sync`**
- It **deletes** the inbox entries it has processed. It never just ticks them, because the CLI treats a ticked entry as a dismissal (plan 1 ruling).
- It records "not a rule" dismissals by ticking `- [x]`.

## Plan-level ruling

The writing-skills iron law forbids writing a skill before its baseline has run, so SKILL.md text cannot be fixed in this plan. Each skill task instead fixes:
- the **scenario**;
- the **pass criteria**, which are measurable and scored by `score.mjs` and the CLI;
- the **skeleton** the skill must have.

The wording is written in GREEN, from the observed baseline failures.

## Review Focus

1. **Citations that do not exist.** After the blind audit, `rulebook index --strict` must report 0 unresolved anchors. *(Task 4)*
2. **The comment that lies** in the fixture. The rule must follow the code (14 days, from config), not the comment (30 days). *(Task 4)*
3. **Dead code** (`legacyRefund`). It must not produce an active rule. *(Task 4)*
4. **Policy vs rule.** Every policy needs a `Nature` and at least one implementing rule. A technical choice such as cents rounding must not become a policy. *(Task 4)*
5. **Sync after a refactor.** A pure rename must produce `unchanged`/re-anchor, not a changed statement. *(Task 6)*

---

### Task 1: Shared references and the sync script

**Files:**
- Create in `references/`: `vocabulary.md`, `ids.md`, `policy-vs-rule.md`, `writing-style.md`, `hotspots.md`, `cli.md` (`card-template.md` already exists)
- Create: `scripts/sync-references.mjs`, `scripts/sync-references.test.mjs`
- Create: `package.json` at the repo root, with scripts `sync`, `check` and `test`

**Interfaces:**
- `node scripts/sync-references.mjs` copies `references/*` into `skills/*/references/`.
- `--check` exits 1 and lists each skill whose copy differs or is missing.

- [ ] **Step 1: Write the failing test** (`scripts/sync-references.test.mjs`, `node:test`). It builds a temporary tree with `references/a.md` and `skills/x/SKILL.md`, then checks that:
  - `--check` fails;
  - a sync followed by `--check` passes;
  - after editing a copy, `--check` fails again and names `x`.
- [ ] **Step 2: Run it.** It must fail because the module is missing.
- [ ] **Step 3: Implement** `sync-references.mjs`, which exports `sync(root)` and `check(root)` and has a CLI entry. Root `package.json`:
  - `"sync": "node scripts/sync-references.mjs"`;
  - `"check": "node scripts/sync-references.mjs --check"`;
  - `"test": "node --test scripts/ && npm --prefix cli test"`.
- [ ] **Step 4: Write the references** (content defined below). Each file is under 150 lines.
  - `vocabulary.md`: kinds, categories, confidence, audit and status, each with a one-line definition and a "use when" example.
  - `ids.md`: domain codes, `P`/`R`/`.E` numbering, never reusing an ID, `retired`.
  - `policy-vs-rule.md`: the "would it still be true without the software?" test, five paired examples, the mandatory `Nature`, and orphan rules under `## Other operating rules`.
  - `writing-style.md`:
    - RuleSpeak phrasing ("must", "only if", "may not");
    - context in 1–3 plain sentences, with inference phrased as inference;
    - no code identifiers above the evidence line except parameters;
    - a 5-line maximum for excerpts;
    - Given/When/Then for edge cases.
  - `hotspots.md`: rule-bearing locations and patterns for Laravel, Rails, Django, Spring, NestJS/Express, .NET and Go.
  - `cli.md`: when to run `rulebook index`, `check`, `build` and `doctor`, the manual fallback for each, and how to read `inbox.md`.
- [ ] **Step 5: Run the tests.** `npm test` at the root must pass.
- [ ] **Step 6: Commit.**

### Task 2: Fixture app, ground truth and scorer

**Files:**
- Create `tests/skills/shop/`, a small JS app. Files and the rules they plant:
  - `src/orders/refund.js`:
    - refund window ≤ `REFUND_WINDOW_DAYS` after delivery;
    - never-delivered orders refused;
    - more than 500 needs an admin;
    - a **lying comment** that says 30 days;
    - a **dead** `legacyRefund()` with 30 days.
  - `src/orders/state.js`: the transitions pending→paid→shipped→delivered; cancel only before shipped.
  - `src/pricing/discount.js`:
    - an expired coupon is refused;
    - one coupon per order;
    - the discount is capped at `MAX_DISCOUNT`;
    - amounts are rounded to cents (a technical choice, not a policy).
  - `src/accounts/password.js`: a password has at least 12 characters; the account locks for 15 minutes after 5 failed attempts.
  - `config/shop.json`: `REFUND_WINDOW_DAYS: 14`, `MAX_DISCOUNT: 0.3`.
  - `db/schema.sql`: `email UNIQUE`, `CHECK (total >= 0)`.
  - `tests/refund.test.js`: covers the refused-after-window case and the day-14 boundary.
- Create `tests/skills/shop/expected.json`:
  - the domains (`ORD`, `PAY`/pricing, `ACC`);
  - about 14 rules, each with `{ key, files: [path], lines: [start, end], kind, policyKey? }`;
  - 4 policies, each with `{ key, implementedBy: [ruleKeys] }`;
  - the expected edge cases;
  - the traps: `lyingComment`, `deadCode`, `technicalChoice`.
- Create `tests/skills/score.mjs` and `tests/skills/score.test.mjs`.

**Interfaces:**
- `node tests/skills/score.mjs <rulebookDir> <expected.json>` prints JSON, then a one-line summary:
  ```
  { recall, precision, citationValidity, parseWarnings, policyChecks: { withNature, withRules, technicalAsPolicy }, traps: { lyingComment: 'pass'|'fail', deadCode, technicalChoice } }
  ```
- Matching: a produced rule matches an expected rule when one of its evidence ranges overlaps the expected file and lines.
- `citationValidity` is the share of evidence lines whose file exists and whose range is in bounds. The scorer reuses `cli/src/index/build.js`.

- [ ] **Step 1: Write `score.test.mjs`.** It needs a hand-written perfect `rulebook/` for the shop, kept in `tests/skills/shop/golden/`, and checks that it scores recall 1, precision 1, validity 1 and all traps `pass`. A second, degraded copy (one rule missing, one bad citation) must score lower.
- [ ] **Step 2: Run it.** It must fail.
- [ ] **Step 3: Write the fixture app, `expected.json`, the golden rulebook and `score.mjs`.**
- [ ] **Step 4: Run it.** It must pass.
- [ ] **Step 5: Commit.**

### Task 3: `rulebook-map`

**Scenario (sub-agent, fresh context, model `sonnet`).** The agent receives a copy of `tests/skills/shop/` with no `rulebook/` and the request "Map the business domains of this codebase so we can document its business rules". The user's replies to checkpoints are scripted in the prompt: "validate as proposed". The baseline gets no skill. GREEN gets "Read and follow `<path>/skills/rulebook-map/SKILL.md`".

**Pass criteria (GREEN):**
- `rulebook/index.md` parses with 3 or 4 domains that match `expected.json` codes or titles by intent;
- `rulebook/config.json` holds `formatVersion: 1`, `language` and non-empty `hotspots` that cover `src/**`;
- the agent stopped at a checkpoint before writing files (seen in its transcript);
- no source file was modified (`git status` shows only `rulebook/`).

**Skeleton:**
- Overview (one principle);
- When to use / not;
- Steps: scope question → survey → propose → **checkpoint** → write;
- Output contract (pointing to `references/card-template.md#domain-map`);
- Common mistakes.

- [ ] Step 1: RED. Run the baseline and record its failures verbatim in `tests/skills/runs/map-baseline.md`.
- [ ] Step 2: GREEN. Write `skills/rulebook-map/SKILL.md` to address those failures.
- [ ] Step 3: Run the scenario with the skill and score it. Fix the skill until all criteria pass. Record the run in `tests/skills/runs/map-green.md`.
- [ ] Step 4: Run `npm run sync` and `npm run check`, then commit.

### Task 4: `rulebook-extract`

**Scenario.** The agent works on the shop with the golden `index.md` and `config.json`, and receives "Extract the business rules of all domains". Checkpoints are scripted: "validate".

**Pass criteria (GREEN), scored by `score.mjs`:**
- recall ≥ 0.85;
- precision ≥ 0.8;
- citationValidity = 1, with `rulebook index --strict` exiting 0;
- parseWarnings = 0;
- every policy has a `Nature` and at least one rule;
- `technicalAsPolicy = 0`;
- traps: `lyingComment`, `deadCode` and `technicalChoice` all pass;
- the blind audit ran: each card has `Audit:`, and the transcript shows a separate reviewer pass that read only cards and cited files;
- no source file changed.

**Skeleton:**
- Steps: entry points → draft operating rules → group into policies → coverage sweep → blind audit → **checkpoint** → write → `rulebook index`;
- Common mistakes, built from the baseline failures.

- [ ] Steps 1–4, as in Task 3 (`extract-baseline.md`, `extract-green.md`).

### Task 5: `rulebook-edge-cases`

**Scenario.** The agent works on the golden rulebook from Task 2 (rules without edge cases), and receives "Find the edge cases of PAY-R0xx (refund window)" plus "…of the ACC domain".

**Pass criteria:**
- it finds the day-14 boundary (`<=`) and the never-delivered case for the refund rule, and the lock boundary (the 5th attempt) for the account rule;
- each case is written in Given/When/Then with a confidence and a reference;
- the day-14 boundary case is `verified`, because the fixture tests it;
- it writes no test file;
- `rulebook index` reports 0 parse warnings.

- [ ] Steps 1–4 (`edge-baseline.md`, `edge-green.md`).

### Task 6: `rulebook-sync`

**Scenario.** The agent starts from the golden rulebook with the index built and committed. Three edits are applied:
1. the refund window changes to 7 days in `config/shop.json`;
2. `checkPassword` is renamed to `validatePassword` (pure refactor);
3. a new rule is added: a gift card cannot pay for another gift card.

The agent runs `rulebook check`, then receives "Process the rulebook inbox". The checkpoint reply is scripted: "validate".

**Pass criteria:**
- the refund card statement is updated to 7 days, with a `History` line `changed`;
- the password card keeps its statement and is re-anchored (`rulebook index --strict` exits 0), with a `reanchored` line or no history line;
- the new rule becomes a `candidate` card;
- processed inbox entries are **deleted**;
- `rulebook check` afterwards adds nothing.

- [ ] Steps 1–4 (`sync-baseline.md`, `sync-green.md`).

### Task 7: `rulebook-publish`

**Scenario.** The agent works on the golden rulebook and receives "Publish the rulebook". It has no document connector.

**Pass criteria:**
- it runs `rulebook build` (or its documented fallback), and `rulebook/rulebook.html` exists;
- it reports the path;
- it does not claim a publication to Notion or Drive;
- when the prompt states that a Notion-writing tool is available, it **asks** before publishing and does not publish on its own.

- [ ] Steps 1–4 (`publish-baseline.md`, `publish-green.md`).
