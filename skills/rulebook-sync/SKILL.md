---
name: rulebook-sync
description: Use when rulebook/inbox.md has pending detections ("traiter l'inbox", "mettre à jour les règles"), when a hook or `rulebook check` reports that a rule "may have changed", "may have been removed" or "possible new rule", or when asked to sync, realign or update the rulebook after code changes.
---

# rulebook-sync — keep the reference true after the code moved

## Overview
The CLI detects; you judge. Each inbox entry says *where* the code moved. Decide *what it
means* for the rule, propose it, and apply it only after the human validates.
**Never rewrite a card silently.**

**CLI.** `rulebook …` below means the rulebook CLI: `rulebook`, or `npx --yes rulebook-cli@latest`. Without Node, use the manual column of `references/cli.md`.

## Steps
1. **Collect.** Run `rulebook check` (fallback: read `rulebook/inbox.md`). Work on the
   `- [ ]` lines. A `- [x]` line is a past dismissal: leave it.
2. **Classify each entry** — open the diff (`git diff`, or `git diff <sha>`) and the card:

   | Entry | Classification | What to propose |
   |---|---|---|
   | `modified?` | **changed** — the behaviour moved | new `Rule.` sentence, updated values everywhere in the card (title, parameters, edge cases), confidence re-checked |
   | `modified?` / `removed?` | **unchanged** — refactor, rename, move | same statement, evidence re-pointed to the new lines and symbol |
   | `removed?` | **removed** — the behaviour is gone | `Status: retired`, keep the card and its ID |
   | `new?` | **new** — rule-bearing code with no card | a `candidate` card in the right domain, next free ID |
   | `new?` | **not a rule** — exports, logging, wiring | dismiss |

   A test that still asserts the old behaviour lowers confidence to `read` (or `conflicting`
   if it contradicts the code) and becomes an open question — never a reason to keep the old text.
3. **Checkpoint — stop here.** Show one line per entry: classification, before → after.
   Ask the user to validate, correct or dismiss. Apply nothing before the answer.
4. **Apply**, in the formats of `references/card-template.md`:
   - `<sha>` below is the short sha of HEAD (`git rev-parse --short HEAD`) — the CLI only
     accepts a hex sha. For uncommitted changes it is the commit the change is based on; say
     "uncommitted" in the history note.
   - **changed:** rewrite `Rule.` (the statement readers see), set `Status: changed`, add
     `- <today> · <sha> · changed · <old> → <new>` to `History`.
   - **unchanged:** fix evidence lines and symbol; add `- <today> · <sha> · reanchored`.
   - **removed:** `Status: retired`; add `- <today> · <sha> · retired · <why>`.
   - **new:** full card with `Status: candidate`, `Confidence` honest, no `Audit` yet (it is
     audited when a human promotes it), `History` `created`.
   - Set `Verified at: <sha> (<today>)` on every card you touched.
5. **Clean the inbox:** **delete the line** of every entry you processed, including every
   `modified?`/`removed?` entry. Tick `- [x]` only **`new?`** entries the user dismissed as
   "not a rule" — a tick tells the CLI never to raise it again.
6. **Verify:** `rulebook index --strict` (no unresolved evidence, no warnings), then
   `rulebook check` must add nothing (without the CLI: re-open every cited line and compare
   with `git diff`). Report what changed, card by card.

## Boundaries
Write only under `rulebook/`. Never edit source or tests, never commit unless asked.
- If `rulebook/rulebook.html` exists, finish with `rulebook build` so the document matches the cards. Never edit the HTML yourself (`references/cli.md`).

## Common mistakes
| Mistake | Instead |
|---|---|
| Ticking processed entries | Delete them; tick only dismissals |
| Editing title or parameters but not `Rule.` | The `Rule.` sentence is what readers see — update it first |
| No `History` line | Every change, re-anchor and retirement gets one |
| New rule written as `active` | `candidate` until a human validates it in a later review |
| Applying, then asking | Checkpoint at step 3 |
