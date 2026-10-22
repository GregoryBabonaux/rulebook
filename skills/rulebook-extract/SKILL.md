---
name: rulebook-extract
description: Use when rulebook/index.md exists and the business rules of one or more domains must be written down — "extract the rules", "document the business rules of ORD", "règles de gestion", "règles métier" — or when a domain listed in the map has no rulebook/<CODE>-*.md file yet.
---

# rulebook-extract — level 2: the rules of a domain

## Overview
Turn what the code actually enforces into rule cards a business reader understands, each one
proven by the lines that decide it. **The code is the only evidence**: comments, names and
docs can point you somewhere, never prove anything.

**CLI.** `rulebook …` below means the rulebook CLI: `rulebook`, or `npx --yes rulebook-cli@latest`. Without Node, use the manual column of `references/cli.md`.

## When not to use
- No `rulebook/index.md` yet → use `rulebook-map` first.
- `rulebook/inbox.md` has pending entries → use `rulebook-sync` first.

## Before you start
If `rulebook/.index.json` exists, run `rulebook check` first: a later `rulebook index` would
silently accept code that moved since the last sync. Read `references/card-template.md` — the CLI parses that exact layout; anything else is
invisible (0 cards). Also skim `references/vocabulary.md`, `policy-vs-rule.md`, `writing-style.md`.
One file per domain: `rulebook/<CODE>-<slug>.md`, starting with `# <CODE> · <Title>`.

**Data.** Settle the data question once, as `references/data.md` says: use the sources recorded
in `config.json`, respect a refusal, otherwise ask one question and record the answer. Read
only, always, and never copy personal data. Read OKF knowledge already in the project as
context, never as evidence (`references/okf.md`).

## Steps
0. **Inventory.** Run `rulebook scan --domain <CODE> --format md`: the decision points of the
   domain's code, found by line patterns. It is your checklist, not the truth — it misses
   decisions spread over several lines and lists lines that are not rules. If the domain is
   large (more than about 80 points to review or 3,000 lines), split the reading between
   parallel readers when you can start sub-agents: one sub-area each, its list of points,
   and the instruction to return each decision with its exact lines, the tests that assert
   it, dead code and open gaps. **Wait for every reader to finish** before writing: start
   them in the foreground when your tools allow it, and never end your turn or hand back
   while a reader is still running. You write the cards.
1. **Read from the entry points** of the domain (routes, commands, jobs, exported functions)
   down to the code that decides. Note each decision: a check that refuses, a calculation,
   a state change, a permission, a limit, a constraint.
2. **Draft operating-rule cards** (`### <CODE>-R<nnn> · <Title>`), one per decision — never
   several decisions merged into one card to save work:
   statement in plain words with the real values, category, confidence, exact evidence lines,
   `Verified at: <short HEAD sha> (<today>)` and a `History` line `created`.
   - A comment that contradicts the code: the card follows the **code**; mention the comment in `Context.`.
   - Code that is never called (dead code): **no card**; report it.
   - **Every branch.** Before writing "always", "never", "only", "every" or "any", walk each
     branch of the deciding code (each type, status or enum case, the order of the checks) and
     state the exceptions. Most wrong cards are statements broader than the code.
   - **A test is evidence only if one of its assertions checks this rule's outcome.** Quote
     that assertion as the evidence excerpt. A test that merely runs the code, or checks
     another case, is not evidence: say `read`.
   - **Client-held state.** When a server check relies on a value the client can change (a
     form field, a request body, an unlocked component property, a state sent by the
     browser), say so in `Context.` and add an open question.
3. **Group into policies.** Rules that share a *why* true outside the software go under a
   `## <CODE>-P<nn> · <Title>` policy with a mandatory `Nature`. Technical choices (rounding,
   retries…) and rules with no clear why go under `## Other operating rules`.
4. **Coverage sweep.** Every point of the inventory ends up covered by a card (its evidence,
   parameters or an edge case cite the line) or listed in `rulebook/not-rules.md` with a
   reason (`references/cli.md`) — including the points "reached from the domain's code"
   (views, helpers, providers the domain uses outside its paths): a rule only this domain
   uses gets a card here; one that belongs to another domain is dismissed with
   "relève du domaine XXX". `not-rules.md` is a list of decisions you read, one by one:
   never generate it with a script or give reasons by file; "applique <ID>" only when that
   card's rule states what the line decides. Then go through what line patterns miss: enums and state
   tables, DB constraints, scheduled jobs, rules decided in views or templates.
   **With a data source:** for each rule the data can show, follow `references/data.md` —
   values that decide (cite them in `Parameters.`), rows that break the rule (count, up to
   three ids), data that contradicts the code or itself (`conflicting`, or an open question),
   states the code does not handle. Data never rewrites what the code does.
5. **Write the domain files** directly in `rulebook/` (the audit needs them; no drafts folder),
   with `Verified at` and `History` as above, and a `**Scope.**` paragraph under the domain
   title: what you read, and what you did not. Run `rulebook index`: a method it reports as
   referenced only by tests, or never, is probably dead — check, and remove its card if so.
   Run `rulebook scan --domain <CODE>` again until no point is left to review.
6. **Blind audit.** If you can start a sub-agent, give it only the card files, the repository
   and the checklist of `references/audit.md`, unchanged. For more than about 30 rule cards,
   run **two independent auditors on every card** and fix the union of their failures: on a
   67-card domain each auditor found 13 failures, they agreed on 8, and each missed 5 of the
   other's. Split very large domains in halves to keep each audit short. Otherwise, do it yourself as a separate pass with that checklist, reading only
   the cards and the cited lines — not your notes. **Wait for the audit result before going on**: if
   sub-agents run in the background, wait for it to finish; never stop or hand back with
   `Audit: pending`. Set `Audit: passed` or `failed: <reason>`; fix or downgrade (`inferred`)
   every failure, then have the fixed cards audited again before marking them `passed`.
7. **Check and build — without asking.** Run `rulebook index --strict` and fix every warning
   and unresolved anchor until it exits 0 (fallback without the CLI: re-open every cited line).
   Then run `rulebook build`: the document is produced first, corrections come after.
8. **Report and offer corrections.** Give the path of `rulebook/rulebook.html` first, and say
   that `rulebook export okf` can share the rulebook with other tools (`references/okf.md`). Then show
   the policies, the rule titles, every `conflicting` card, every audit fix and the main open
   questions, and ask what to correct: rename, merge or drop a policy, reword or remove a rule.
9. **Apply the corrections** the user asks for, then run `rulebook index --strict` and
   `rulebook build` again.

**Tests as runtime evidence.** You may run the tests a card cites to confirm `verified`, only
when they cannot touch a real database: they use an in-memory or dedicated test database, and
nothing in the project's instructions forbids it. Otherwise read them; never run anything
that resets or seeds a developer's database.

## Boundaries
Write only under `rulebook/`. Never change source code or tests. Next free IDs only (`ids.md`).
- Always end with `rulebook build`, so the document matches the cards. Never edit the HTML yourself (`references/cli.md`).

## Common mistakes
| Mistake | Instead |
|---|---|
| One file per rule, or headings like `## Rule` | The card template, one file per domain |
| Trusting a comment or a function name | Read the executing code; cite it |
| A card for dead code | Report it, no card |
| A policy for rounding or a technical limit | `## Other operating rules`, no policy |
| Evidence pointing at the caller | Cite the lines that decide |
| No `Audit:` line | Every rule card gets one from step 6 |
| Asking for validation before building | Build the HTML first (step 7), then offer corrections |
| Points left "to review" in the scan | A card or a `not-rules.md` line for each |
| A card for a method only tests call | Dead code: no card, say it in the report |
| "Only" or "always" checked against one branch | Walk every branch, write the exceptions |
| A scripted `not-rules.md` to reach 0 to review | Read each point; a hidden rule is a missed rule |
| `verified` because a test runs the code | A test whose assertion checks this rule, quoted |
