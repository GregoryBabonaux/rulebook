---
name: rulebook-map
description: Use when a codebase's business rules are to be documented and no rulebook/index.md exists yet, or when asked to map, list or split the business domains of an application ("what are the domains", "cartographie des domaines", first step of a rulebook).
---

# rulebook-map — level 1: the domain map

## Overview
Produce the map that every later level hangs on: a few business domains, each with a code,
a one-line description and the places in the code where its rules live. Nothing else.
**The map is validated by a human before anything is written.**

**CLI.** `rulebook …` below means the rulebook CLI: `rulebook`, or `npx --yes rulebook-cli@latest`. Without Node, use the manual column of `references/cli.md`.

## When not to use
- `rulebook/index.md` already exists → extend it only if the user asks; otherwise use `rulebook-extract`.
- The user wants rules or edge cases → `rulebook-extract`, `rulebook-edge-cases`.

## Steps
1. **Scope.** Ask which part of the repository to cover (all of it, or some folders) and the
   language of the reference. Default: whole repository, language of the user's request.
2. **Survey** (read, don't change): entry points (routes, commands, jobs), models and schema,
   module and folder names, configuration, tests, README. Use `references/hotspots.md`.
3. **Propose domains** as a business person would name them — a capability the business
   talks about (Orders, Pricing, Accounts), never a technical layer (Controllers, Utils).
   Keep authentication and authorization of the same users in one domain; keep a lifecycle
   and the refunds of the same orders in one domain unless the business clearly separates them.
   Aim for the smallest set that covers the code: often 3–5 for a small app, rarely above 12.
   For each: a 3-letter code, a title, one sentence, its folders, suggested hotspots.
4. **Checkpoint — stop here.** Show the proposal as a table and ask the user to rename,
   merge, split or drop domains and to confirm the hotspots. Write nothing before the answer.
5. **Write**, exactly in the formats of `references/card-template.md`:
   - `rulebook/index.md` — one line per domain, `- **ORD** · Orders — One sentence.`, then
     indented details: what it **covers**, its key **concepts**, where its **code** lives, and
     what to **check** (traps, hardcoded values, dead code you noticed). The map must be worth
     reading on its own: it is the first thing people see.
   - `rulebook/config.json` — `{ "formatVersion": 1, "language": "<lang>", "repoUrl": <https URL or null>, "hotspots": [<globs>] }`.
     Hotspots are never empty: list the folders and files where the domains' rules live.
6. **Build the document:** `rulebook build` → `rulebook/rulebook.html`. The HTML is the
   deliverable people open and share; give its path first, then the files, and suggest the
   next step: `rulebook-extract` on a domain.

## Boundaries
- Write only under `rulebook/`: `index.md`, `config.json`, and the built `rulebook.html` (with
  its `.published.json`).
- Do not run `rulebook init` and do not create `AGENTS.md`, hooks or other files. If the
  companion is not installed, *mention* `rulebook init` as an option in your report.
- Do not write rule cards. Rules and traps you noticed while surveying (a comment that
  contradicts the code, dead code, hardcoded thresholds) go in the domain's **check** detail.

## Common mistakes
| Mistake | Instead |
|---|---|
| A free-form `domains.md` | `rulebook/index.md` in the domain-map format, with codes |
| One domain per technical folder or per sub-feature | Business capabilities; merge sub-features |
| Writing files, then asking | Ask at step 4, write at step 5 |
| `hotspots: []` | Globs for every domain's rule-bearing code |
| A bare list of domain names | Details under each domain; the map is read on its own |
| Stopping at the Markdown | `rulebook build`: the HTML is the deliverable |
