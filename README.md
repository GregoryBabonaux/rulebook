# rulebook

**Turn the business rules buried in a codebase into a reference people can read — and keep it true while you code.**

rulebook is a set of [Agent Skills](https://agentskills.io) and a small CLI for coding agents. The skills read your code and write rule cards in plain language, for product owners and developers alike. Each card says what the product enforces and why, and points to the exact lines and tests that prove it. The CLI is the companion: after each edit, it notices when a rule's code moved and leaves a one-line note in an inbox, so the reference never drifts silently.

It works with Claude Code, Codex, Cursor, Gemini CLI, GitHub Copilot, Mistral Vibe and any agent that reads `SKILL.md` files, whatever toolbox you use on top (superpowers, spec-kit, BMAD…).

See [`examples/demo/rulebook/rulebook.html`](examples/demo/rulebook/rulebook.html) for a generated reference, in French.

## What you get

```
rulebook/
├── index.md            # the business domains
├── ORD-orders.md       # one file per domain: policies (why) and operating rules (how)
├── inbox.md            # changes detected by the companion, waiting for validation
└── rulebook.html       # the readable document, one self-contained file
```

Every rule card has:
- a statement in plain words;
- its context;
- a confidence level (*proven by code and a test*, *read in the code*, *inferred*, *contradictory*);
- the evidence (`path:line`);
- its edge cases (Given/When/Then);
- its open questions;
- a history.

The format is in [`references/card-template.md`](references/card-template.md).

## Two halves

| | Skills (judgment) | Companion (detection) |
|---|---|---|
| What | Read code, write and update cards | Notice that code behind a rule changed |
| How | `SKILL.md` files your agent loads | `rulebook` CLI, run by agent hooks and git pre-commit |
| LLM? | Yes, your agent | No, deterministic |

The five skills:

| Skill | Use it to |
|---|---|
| `rulebook-map` | map the business domains (level 1) |
| `rulebook-extract` | write the rules of a domain, with a coverage sweep and a blind audit (level 2) |
| `rulebook-edge-cases` | find what happens at the limits of a rule (level 3) |
| `rulebook-sync` | process the inbox after code changes |
| `rulebook-publish` | build the HTML document and, if you have a connector, offer to publish it |

Every level stops for your validation before it writes. Nothing touches your source code or your tests.

## Install

Pick one way to get the skills, then (optionally) install the companion in your project.

**skills.sh** (any agent):
```bash
npx skills add <owner>/rulebook
```

**Claude Code plugin** (skills and companion hooks):
```
/plugin marketplace add <owner>/rulebook
/plugin install rulebook@rulebook
```
Auto-update is off by default for third-party marketplaces. To turn it on, open `/plugin` → Marketplaces → rulebook → *Enable auto-update*. The plugin's hooks only run in projects that have a `rulebook/` folder, and step aside when the project installed its own with `rulebook init`.

**npm** (skills for agents that read `~/.agents/skills` or `~/.claude/skills`):
```bash
npx rulebook-cli skills --yes
```

**Companion in a project**, which writes the hooks for the agents it detects plus an `AGENTS.md` block and a git pre-commit hook. It shows the plan first; add `--yes` to apply:
```bash
npx rulebook-cli init
```

| Agent | After an edit | Notes |
|---|---|---|
| Claude Code | `PostToolUse` + `Stop` | verified end to end |
| GitHub Copilot | `postToolUse` | `.github/hooks/rulebook.json`, read by the cloud agent too |
| Gemini CLI | `AfterTool` | |
| Codex | `PostToolUse` + `Stop` | approve once with `/hooks` |
| Cursor | `postToolUse` | |
| Mistral Vibe | `post_tool` | |
| Kiro, OpenCode, Windsurf | — | AGENTS.md + pre-commit only |

Hook formats other than Claude Code's follow each vendor's documentation as of October 2026. Reports are welcome.

## Quick start

1. Ask your agent: *"Map the business domains of this codebase."* → `rulebook-map`
2. *"Extract the business rules of the ORD domain."* → `rulebook-extract`
3. *"Find the edge cases of ORD-R001."* → `rulebook-edge-cases`
4. *"Publish the rulebook."* → `rulebook-publish` (runs `rulebook build`)
5. Keep coding. When a rule's code changes, you get a line like
   `rulebook: ORD-R001 may have changed (refund.js) → rulebook/inbox.md`.
   Later: *"Process the rulebook inbox."* → `rulebook-sync`.

## CLI

```
rulebook --help
rulebook index      # rebuild the evidence index, report problems
rulebook check      # detect rule changes, write the inbox
rulebook build      # render rulebook/rulebook.html
rulebook doctor     # check the installation
rulebook update     # refresh hooks and skill copies installed by the CLI
```

Node 22 or later, no dependencies. Without Node, the skills fall back to manual checks.

## Updates

skills, CLI and hooks share one version.
- **Plugin:** `claude plugin update rulebook@rulebook`.
- **skills.sh:** `npx skills update`.
- **npm:** `npx rulebook-cli@latest update`.

The CLI prints `rulebook <version> available — …` at most once a day, from a background check. Turn it off with `RULEBOOK_NO_UPDATE_CHECK=1`; it is off automatically in CI.

## FAQ

**Does it change my code?** No. Skills write only under `rulebook/`. The CLI writes `rulebook/.index.json`, `rulebook/inbox.md` and the HTML; `init --yes` writes the hook files you approved, `update` refreshes only what rulebook already installed, and `skills --yes` copies the skills into your home directory.

**Which languages?** The skills are written in English. The reference is written in your project's language (`rulebook/config.json` → `language`). The document's labels exist in English and French.

**How do I know a card is right?** Each card cites the lines that decide, carries a confidence level, and was checked by a blind audit: a second pass that sees only the card and the cited code. `rulebook index --strict` fails when a citation no longer exists.

**How is it tested?** A fixture app with planted traps (a comment that lies, dead code, a technical choice disguised as a rule), plus a scorer. Each skill was first run *without* the skill to observe the failures, then written to fix them. See [`tests/skills/runs/`](tests/skills/runs/).

## License

MIT
