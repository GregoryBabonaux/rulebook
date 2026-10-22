# The rulebook CLI

The skills judge; the CLI checks. Prefer the CLI when it is available
(`rulebook --version`, or `npx --yes rulebook-cli@latest --version`). Every step has a
manual fallback for environments without Node.

| When | Run | Without the CLI |
|---|---|---|
| Before reading a domain, and after writing its cards | `rulebook scan --domain <CODE> --format md` — the decision points of the domain's code that no card covers yet, identical lines grouped. `rulebook scan` alone prints the coverage of every domain and writes `rulebook/.scan.json`, which the HTML shows. It also follows the domain's references (PHP `use`, Laravel views, relative imports) two steps into files no domain owns, and lists their points under "Reached from <CODE>'s code". | `grep` the domain's folders for refusals, conditions on fixed values, permissions, validation rules, state changes and constants. |
| After writing or editing cards | `rulebook index` — rebuilds `rulebook/.index.json`; reports parse warnings, unresolved evidence, a cited symbol absent from its lines, a test cited outside a test file, and methods referenced only by tests or never (**possible dead code**). Fix every warning; `--strict` fails on all but the dead-code hints. | Re-open each cited file and check that the lines exist and say what the card claims. |
| To see what changed in the code | `rulebook check` (worktree), `rulebook check --since <sha>` | `git diff` and compare against the evidence lines of each card. |
| To publish | `rulebook build` → `rulebook/rulebook.html` | Leave the Markdown as the deliverable; say the HTML could not be built. |
| To check the installation | `rulebook doctor --quiet` (also lists the declared data sources) | — |
| To read a SQL dump or a JSON export | `rulebook data <source> tables`, `rulebook data <source> rows <table> --where col=value --columns a,b --limit 20` or `--count` (read only, see `data.md`) | Open the file and search it. |
| To share the rulebook with other tools | `rulebook export okf` → `rulebook/okf/`, an Open Knowledge Format bundle (see `okf.md`) | Leave the Markdown cards as the deliverable. |

**The HTML document is only ever produced by `rulebook build`.** Never write, rewrite or patch
`rulebook.html` yourself, and never generate an HTML page of your own in its place: every
rulebook, in every project, must be the same document. Without the CLI, deliver the Markdown
and say the HTML could not be built. `rulebook doctor` flags an HTML file the CLI did not sign.

## The inbox — `rulebook/inbox.md`
Written by `rulebook check` and the agent hooks:

```
- [ ] 2026-10-15 14:02 · modified? · PAY-R012 · app/Policies/OrderPolicy.php:41-47 · key 3f9a1b2c4d5e
```

- Types: `modified?` (the evidence of a rule changed), `removed?` (its code is gone),
  `new?` (rule-bearing code with no card yet; the rule column is `—`).
- `- [ ]` pending.
- `- [x]` means **dismissed**: the CLI will not raise that detection again. Tick **only `new?`
  entries** a human called "not a rule" (their key includes the code, so a different new rule in
  the same file is still raised).
- `modified?` and `removed?` entries are **always deleted** once processed — even "nothing to do"
  ones (re-anchor the card instead). Their key is the rule and the file, so a tick would silence
  every later change to that rule in that file.

## Not rules — `rulebook/not-rules.md`
A decision point the scan found that is not a business rule (a technical guard, a geometry
constant, the same check repeated) is dismissed with its key and a reason:

```
# Not rules
- 3f9a1b2c4d5e · app/Services/Geo.php:157 · Earth radius for the distance formula, geometry
```

The key survives line moves. Write a reason a reviewer can check; a point that applies an
existing rule says which one (`applies JEU-R033`).

## Reachability hints
`rulebook index` reports a cited method that only tests reference, or that nothing
references. It matches names, so two methods with the same name mask each other, and code
called by a framework convention may look unused. Before giving such code a card, check it
is really called; dead code gets **no card** and is mentioned in your report.

## Card format
`card-template.md` is the contract the CLI parses. A card that does not follow it produces
parse warnings in `rulebook index` and may be missing from the HTML.
