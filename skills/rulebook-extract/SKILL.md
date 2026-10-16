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

## Steps
1. **Read from the entry points** of the domain (routes, commands, jobs, exported functions)
   down to the code that decides. Note each decision: a check that refuses, a calculation,
   a state change, a permission, a limit, a constraint.
2. **Draft operating-rule cards** (`### <CODE>-R<nnn> · <Title>`), one per decision:
   statement in plain words with the real values, category, confidence, exact evidence lines,
   `Verified at: <short HEAD sha> (<today>)` and a `History` line `created`.
   - A comment that contradicts the code: the card follows the **code**; mention the comment in `Context.`.
   - Code that is never called (dead code): **no card**; report it.
3. **Group into policies.** Rules that share a *why* true outside the software go under a
   `## <CODE>-P<nn> · <Title>` policy with a mandatory `Nature`. Technical choices (rounding,
   retries…) and rules with no clear why go under `## Other operating rules`.
4. **Coverage sweep.** Go through the domain's hotspots (`config.json`), validators, guards,
   enums and state tables, DB constraints, scheduled jobs and config values. Every decision
   point must end up in a card or in your report as "not a rule" with a reason.
5. **Write the domain files** directly in `rulebook/` (the audit needs them; no drafts folder),
   with `Verified at` and `History` as above.
6. **Blind audit.** If you can start a sub-agent, give it only the card files and the
   repository, and ask it to check each card: do the cited lines exist and do they support the
   statement as written? Otherwise, do it yourself as a separate pass, reading only the cards
   and the cited lines — not your notes. **Wait for the audit result before going on**: if
   sub-agents run in the background, wait for it to finish; never stop or hand back with
   `Audit: pending`. Set `Audit: passed` or `failed: <reason>`; fix or downgrade (`inferred`)
   every failure.
7. **Checkpoint — stop here.** Show the policies, the rule titles, every `conflicting` card,
   every audit fix and every open question. Ask the user to validate. Change nothing more
   before the answer.
8. **Apply the answer**, then run `rulebook index --strict` and fix every warning and
   unresolved anchor until it exits 0 (fallback without the CLI: re-open every cited line).

## Boundaries
Write only under `rulebook/`. Never change source code or tests. Next free IDs only (`ids.md`).

## Common mistakes
| Mistake | Instead |
|---|---|
| One file per rule, or headings like `## Rule` | The card template, one file per domain |
| Trusting a comment or a function name | Read the executing code; cite it |
| A card for dead code | Report it, no card |
| A policy for rounding or a technical limit | `## Other operating rules`, no policy |
| Evidence pointing at the caller | Cite the lines that decide |
| No `Audit:` line | Every rule card gets one from step 6 |
