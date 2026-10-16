# The rulebook CLI

The skills judge; the CLI checks. Prefer the CLI when it is available
(`rulebook --version`, or `npx --yes rulebook-cli@latest --version`). Every step has a
manual fallback for environments without Node.

| When | Run | Without the CLI |
|---|---|---|
| After writing or editing cards | `rulebook index` — rebuilds `rulebook/.index.json`, reports parse warnings and unresolved evidence. Fix every warning. | Re-open each cited file and check that the lines exist and say what the card claims. |
| To see what changed in the code | `rulebook check` (worktree), `rulebook check --since <sha>` | `git diff` and compare against the evidence lines of each card. |
| To publish | `rulebook build` → `rulebook/rulebook.html` | Leave the Markdown as the deliverable; say the HTML could not be built. |
| To check the installation | `rulebook doctor --quiet` | — |

## The inbox — `rulebook/inbox.md`
Written by `rulebook check` and the agent hooks:

```
- [ ] 2026-10-15 14:02 · modified? · PAY-R012 · app/Policies/OrderPolicy.php:41-47 · key 3f9a1b2c4d5e
```

- Types: `modified?` (the evidence of a rule changed), `removed?` (its code is gone),
  `new?` (rule-bearing code with no card yet; the rule column is `—`).
- `- [ ]` pending. `- [x]` means **dismissed** ("not a rule", "nothing to do"): the CLI will not
  raise that detection again.
- When you have processed an entry, **delete its line**. Do not tick it, or a later change
  to the same rule in the same file will stay silent.

## Card format
`card-template.md` is the contract the CLI parses. A card that does not follow it produces
parse warnings in `rulebook index` and may be missing from the HTML.
