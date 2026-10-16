<div align="center">

# rulebook

**Turn the business rules buried in your code into a reference people can read, and keep it true while you code.**

[![npm](https://img.shields.io/npm/v/rulebook-cli?color=6366f1&label=npm)](https://www.npmjs.com/package/rulebook-cli)
[![CI](https://github.com/GregoryBabonaux/rulebook/actions/workflows/ci.yml/badge.svg)](https://github.com/GregoryBabonaux/rulebook/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-8b5cf6)](https://github.com/GregoryBabonaux/rulebook/blob/main/LICENSE)
![Node 22+](https://img.shields.io/badge/node-%E2%89%A522-06b6d4)

**English** · [Français](https://github.com/GregoryBabonaux/rulebook/blob/main/README.fr.md) · [Español](https://github.com/GregoryBabonaux/rulebook/blob/main/README.es.md) · [Deutsch](https://github.com/GregoryBabonaux/rulebook/blob/main/README.de.md) · [Português](https://github.com/GregoryBabonaux/rulebook/blob/main/README.pt.md) · [Italiano](https://github.com/GregoryBabonaux/rulebook/blob/main/README.it.md)

<img src="https://raw.githubusercontent.com/GregoryBabonaux/rulebook/main/docs/images/document.png" alt="A rulebook document: a refund rule with its context, edge cases, contradictory evidence and an open question" width="900">

</div>

## Why

Every product hides its rules in code: a refund window, a lock after five failed logins, a discount cap. Nobody can list them, the comments lie, and the specs are out of date. **rulebook** gives your coding agent the skills to read the code, write those rules in plain language with the proof attached, and notice when a change in the code touches one of them.

- **Readable by everyone.** Each rule says what the product does, why, and the exceptions, for product owners and developers alike.
- **Proven.** Each rule cites the exact lines and tests that decide it, with a confidence level. The code wins over comments.
- **Alive.** A companion watches your edits and flags the rules that may have changed. Nothing is rewritten without your approval.
- **Any agent.** Claude Code, Codex, Cursor, Gemini CLI, GitHub Copilot, Mistral Vibe, and any agent that reads `SKILL.md` files, alongside superpowers, spec-kit or BMAD.

## One document, three views

The result is a single HTML file: it works offline, you can email it, and it prints to PDF.

| Map | Dashboard (dark mode) |
|---|---|
| <img src="https://raw.githubusercontent.com/GregoryBabonaux/rulebook/main/docs/images/map.png" alt="Interactive map: domains, policies and rules as a tree you can unfold and rearrange" width="440"> | <img src="https://raw.githubusercontent.com/GregoryBabonaux/rulebook/main/docs/images/dashboard-dark.png" alt="Dashboard: key figures, rules per domain coloured by confidence, recent changes and items to validate" width="440"> |
| Unfold domains, policies, rules and edge cases. Drag a node to move its branch. | Key figures, confidence per domain, recent changes, open questions. |

The screenshots come from a fictional shop with planted traps: a comment that announces 30 days while the code applies 7, and dead code. The sample document is in French; yours is written in your project's language.

## How it works

| Level | Skill | What you get |
|---|---|---|
| 1 | `rulebook-map` | the business domains, with what each covers and where its code lives |
| 2 | `rulebook-extract` | the rules of one domain: policies (*why*) and operating rules (*how*), checked by a blind audit |
| 3 | `rulebook-edge-cases` | what happens at the limits of a rule (*Given… when… then…*) |
| — | `rulebook-sync` | processes the inbox after code changes |
| — | `rulebook-publish` | builds the HTML document and, if you have a connector (Notion, Drive…), offers to publish it |

Each level stops for your validation before it writes. rulebook never touches your source code or your tests.

The **skills** do the judging: your agent reads the code. The **companion** does the detecting: a small CLI with no AI, run by your agent's hooks and by a git pre-commit hook.

## Installation guide

**Requirements:** git, and Node.js 22 or later for the companion and the HTML. The skills work without Node; you then get the Markdown only.

### Step 1 — Install the skills (choose one)

| You use | Run | You get |
|---|---|---|
| **Claude Code** (recommended) | `/plugin marketplace add GregoryBabonaux/rulebook`<br>`/plugin install rulebook@rulebook` | skills + companion hooks |
| **Any agent** (Codex, Cursor, Gemini, Copilot, Vibe…) | `npx skills add GregoryBabonaux/rulebook` | skills, in the project or globally (`-g`) |
| **No skills.sh** | `npx rulebook-cli skills --yes` | skills copied to `~/.agents/skills` and `~/.claude/skills` |

### Step 2 — Turn on the companion in your project

In the project folder:

```bash
npx rulebook-cli init
```

The command shows what it will write: hooks for the agents it detects, an `AGENTS.md` block and a git pre-commit hook. Nothing is written until you confirm:

```bash
npx rulebook-cli init --yes
```

With the Claude Code plugin, this step is optional: the plugin already brings the hooks.

### Step 3 — Check

```bash
npx rulebook-cli doctor
```

Each line starts with `✓` (fine) or `!` (to fix, with the command to run).

### Supported agents

| Agent | Detection after an edit | Notes |
|---|---|---|
| Claude Code | `PostToolUse` + `Stop` | verified end to end |
| GitHub Copilot | `postToolUse` | `.github/hooks/rulebook.json`, read by the cloud agent too |
| Gemini CLI | `AfterTool` | |
| Codex | `PostToolUse` + `Stop` | approve once with `/hooks` |
| Cursor | `postToolUse` | |
| Mistral Vibe | `post_tool` | |
| Kiro, OpenCode, Windsurf | — | `AGENTS.md` + pre-commit only |

Hook formats other than Claude Code's follow each vendor's documentation as of October 2026. Reports are welcome.

## Quick start

Talk to your agent:

1. *"Map the business domains of this codebase."* → `rulebook-map`, then open `rulebook/rulebook.html`
2. *"Extract the business rules of the ORD domain."* → `rulebook-extract`
3. *"Find the edge cases of ORD-R001."* → `rulebook-edge-cases`
4. Keep coding. When a rule's code changes, a single line appears:
   `rulebook: ORD-R001 may have changed (refund.js) → rulebook/inbox.md`
5. *"Process the rulebook inbox."* → `rulebook-sync`, then *"Publish the rulebook."* → `rulebook-publish`

What ends up in your project:

```
rulebook/
├── index.md          # the business domains
├── ORD-orders.md     # one file per domain: policies and rules, with their evidence
├── inbox.md          # changes detected by the companion, waiting for validation
└── rulebook.html     # the document, one self-contained file
```

## Update guide

Skills, CLI and hooks share **one version number**. The CLI tells you when a new one is out, at most once a day: `rulebook 0.2.0 available — …`. Turn the notice off with `RULEBOOK_NO_UPDATE_CHECK=1`; it is off in CI.

### 1. Update the skills, the way you installed them

| Installed with | Update with |
|---|---|
| Claude Code plugin | `claude plugin update rulebook@rulebook`, or `/plugin` → Marketplaces → rulebook → *Enable auto-update* to stop thinking about it |
| skills.sh | `npx skills update` in the project folder (`npx skills update -g` for a global install) |
| npm | `npx rulebook-cli@latest update` |

### 2. Refresh the project

In each project that uses rulebook:

```bash
npx rulebook-cli@latest update
```

It refreshes only what rulebook installed (hooks, skill copies) and never installs anything new by surprise. Then rebuild the document with the new template:

```bash
npx rulebook-cli@latest build
```

### 3. Check

```bash
npx rulebook-cli@latest doctor
```

`doctor` flags hooks from an older version and a `rulebook.html` built by another version.

## CLI

```
rulebook index      # rebuild the evidence index, report problems
rulebook check      # detect rule changes, write the inbox
rulebook build      # render rulebook/rulebook.html
rulebook doctor     # check the installation
rulebook update     # refresh the hooks and skill copies installed by the CLI
rulebook --help
```

No dependencies. Use it with `npx rulebook-cli <command>` or install it with `npm i -g rulebook-cli`.

## The same document for everyone

The agent never writes `rulebook.html`. Only `rulebook build` renders it, from a template shipped in the package, with no AI involved. The same version and the same cards give the same file, byte for byte; set `SOURCE_DATE_EPOCH` to pin the date. The file is signed with `<meta name="generator" content="rulebook-cli x.y.z">`, and `rulebook doctor` flags one the CLI did not produce.

## FAQ

**Does it change my code?** No. The skills write only under `rulebook/`. `init --yes` writes the hook files you approved, `update` refreshes only what rulebook installed, and `skills --yes` copies the skills into your home folder.

**Which languages?** The skills are written in English. The reference is written in your project's language (`rulebook/config.json` → `language`). The labels of the HTML document exist in English and French.

**How do I know a rule is right?** Each rule cites the lines that decide it and carries a confidence level: *proven by code and a test*, *read in the code*, *inferred*, or *contradictory*. A blind audit checks it: a second pass that sees only the card and the cited code. `rulebook index --strict` fails when a citation no longer exists.

**How is it tested?** With a fixture app full of traps (a lying comment, dead code, a technical choice disguised as a rule) and a scorer. Each skill was first run *without* the skill to observe the failures, then written to fix them. See [`tests/skills/runs/`](https://github.com/GregoryBabonaux/rulebook/tree/main/tests/skills/runs).

**Where is the card format?** In [`references/card-template.md`](https://github.com/GregoryBabonaux/rulebook/blob/main/references/card-template.md).

## License

MIT © Grégory Babonaux
