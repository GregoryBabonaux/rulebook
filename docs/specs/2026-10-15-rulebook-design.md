# rulebook — design spec

- **Date:** 2026-10-15
- **Status:** draft, awaiting review
- **Author:** Grégory Babonaux, with Claude

## 1. Purpose

`rulebook` is an open-source, agent-agnostic pack that extracts the business rules buried in a codebase and keeps them in a **living reference** that people can read: product owners, business experts and developers alike.

It does two jobs:

1. **Extract.** It does this progressively, at three levels: domains, then rules, then edge cases. Every rule is written in plain language, gives its context, and carries **evidence** (`file:line`, tests).
2. **Keep it alive.** A **companion** watches code edits during normal or vibe-coding sessions and detects rules that were created, changed or deleted. It works whatever toolbox the developer uses (superpowers, spec-kit, BMAD, none) and whatever coding agent they use (Claude Code, Codex, Cursor, Gemini CLI, Copilot, Mistral Vibe, Kiro, OpenCode, Windsurf).

### Success criteria

- On an unfamiliar repository, a PO can read the generated document and understand what the product enforces and why, without reading code.
- A developer can jump from any rule to the exact code and test that prove it.
- Changing a rule's code during a session produces a one-line notice and an inbox entry. No manual step is needed, whichever agent made the edit.
- No rule is ever rewritten silently. A human validates every change.
- It installs on any supported agent in one command, with no lock-in to Claude.

### Non-goals (v1)

- Modifying the analysed code. rulebook never edits source and never writes tests (it may suggest them).
- Reading external specs or wikis as input. External tools (Notion, Drive, Confluence) are **output targets only**.
- Editing or commenting inside the HTML document. Collaboration happens in external tools.
- Multi-agent parallel extraction. This can be added later as an option of `rulebook-extract`.

## 2. Prior art (research, 2026-10-15)

We found no public skill that produces a three-level rule reference with line-level evidence. The ideas below are borrowed:

| Idea | Source |
|---|---|
| Rule card: hierarchical ID, category, exact location, snippet, SME validation | AWS Kiro AS/400 business-rule-extraction guide |
| Blind audit: a reviewer that never saw the extraction re-checks each rule from its text alone | `extract-rules` (hiroro-work/claude-plugins) |
| Rules must hold on executing code, not on names or comments | AWS Transform for mainframe |
| Show discrepancies, never hide them; keep open questions visible | rulelift |
| Normalised rule phrasing; Given/When/Then for edge cases | RuleSpeak, Gherkin |
| Coverage sweep, because an LLM alone misses rules | Swimm 2.0 findings |
| Scoping question first (scope, depth) | `code-to-spec` (smallnest/goal-workflow) |

## 3. Key concepts

### 3.1 Two kinds of rule

| Kind | Label (FR / EN) | Question it answers | Evidence |
|---|---|---|---|
| **Policy** | Règle métier / Business policy | *Why?* It would be true even without software (law, contract, nature of the trade). | Indirect: the operating rules that implement it, plus optional external docs. Carries a one-sentence `nature` justification. |
| **Rule** | Règle de gestion / Operating rule | *How?* How the system enforces something (validation, calculation, state, workflow). | Direct: code, tests, config, schema. |

An operating rule points to the policy it implements (`implements`). It may have none, in which case it is an organisational or technical choice and the card says so.

### 3.2 Identifiers

- Domain code: 3 uppercase letters, fixed at level 1 (`PAY`).
- Policy: `PAY-P03`. Operating rule: `PAY-R012`. Edge case: `PAY-R012.E2`.
- IDs are **never reused**. A rule that disappears becomes `retired` and keeps its ID.

### 3.3 Closed vocabularies

- **Category:** `validation`, `calculation`, `authorization`, `state-transition`, `derivation`, `data-constraint`, `timing`, `integration`.
- **Confidence:**
  - `verified`: enforcing code + a test that asserts it.
  - `read`: execution path read end to end, no test.
  - `inferred`: only names, comments or config, or a partial path.
  - `conflicting`: paths disagree, or code disagrees with a test. Shown without picking a side.
- **Audit:** `passed` / `failed` (with reason), set by the blind audit.
- **Status:** `candidate`, `active`, `changed`, `retired`.

### 3.4 Language

Skills, CLI, README and this spec are written in English. **The generated reference is written in the project's or user's language** (detected from the request, then from README and code comments, and overridable in config). UI labels in the HTML follow that language.

## 4. Generated reference — files

Everything lives in a `rulebook/` folder at the analysed project's root (configurable):

```
rulebook/
├── config.json          # language, repo URL (for evidence links), domain hotspots, output dir
├── index.md             # domain map (level 1) + summary counts
├── PAY-payments.md      # one file per domain: policies, then their rules, with edge cases
├── ORD-orders.md
├── inbox.md             # companion detections awaiting validation
├── rulebook.html        # generated, never hand-edited
└── .index.json          # evidence index (machine-readable, committed)
```

**Markdown is the single source of truth.** `rulebook.html` and `.index.json` are derived from it. A `.state.json` (gitignored) holds per-machine companion state.

### 4.1 Domain file layout

```markdown
# PAY · Payments
<one-paragraph description of the domain>

## PAY-P03 · Right of withdrawal
- **Kind:** policy · **Nature:** consumer law (14-day withdrawal right)
<plain-language statement and context>

### PAY-R012 · Refund allowed up to 14 days after delivery
...rule card...
```

Policies are level-2 headings. Their operating rules are level-3 headings beneath them. Rules with no policy go under a final `## Other operating rules` section.

### 4.2 Rule card template (strict)

The headings and their order are fixed so the CLI can parse cards without ambiguity. Labels are localised. The template below shows the English labels; the CLI maps localised labels through `references/labels.json`.

```markdown
### PAY-R012 · Refund allowed up to 14 days after delivery
- **Kind:** rule · **Category:** timing · **Implements:** PAY-P03
- **Status:** active · **Confidence:** verified · **Audit:** passed
- **Verified at:** a1b2c3d (2026-10-15)

**Rule.** A refund can be requested only if the order was delivered 14 days ago or less.

**Context.** Applies the withdrawal right (PAY-P03). The window starts at delivery,
not at order time — a frequent support misunderstanding.

**Parameters.** `REFUND_WINDOW_DAYS = 14` — config/shop.php:14

**Evidence.**
- enforcement — app/Policies/OrderPolicy.php:41-47 `OrderPolicy::refund`
  `return $order->delivered_at?->diffInDays(now()) <= config('shop.refund_window_days');`
- test — tests/Feature/RefundTest.php:88 `test_refund_refused_after_window`

**Edge cases.**
- **PAY-R012.E1** Given an order never delivered, when a refund is requested, then it is refused. — read — OrderPolicy.php:41
- **PAY-R012.E2** Given delivery exactly 14 days ago, when…, then it is accepted. — verified — RefundTest.php:102

**Open questions.** Do public holidays count? The code does not exclude them.

**History.**
- 2026-10-14 · b7e8f9a · changed · window 30 → 14 days (validated by G.B.)
- 2026-10-02 · a1b2c3d · created
```

Rules for writing cards:

- The `Rule.` sentence uses RuleSpeak-style wording ("must", "only if", "may not").
- `Context.` is 1 to 3 sentences of plain language. Anything not backed by evidence is phrased as an inference.
- Snippets are at most 5 lines. Point to code, never copy it.
- Evidence kinds: `enforcement`, `test`, `config`, `schema`, `doc`.
- A policy card has `Kind`, `Nature`, statement, context, the list of implementing rules, and open questions. It has no direct code evidence.

### 4.3 Evidence index (`.index.json`)

```json
{
  "version": 1,
  "verifiedAt": "a1b2c3d",
  "anchors": [
    {
      "rule": "PAY-R012",
      "kind": "enforcement",
      "path": "app/Policies/OrderPolicy.php",
      "symbol": "OrderPolicy::refund",
      "lines": [41, 47],
      "snippetHash": "sha1:…"
    }
  ],
  "hotspots": ["app/Policies/**", "app/Rules/**", "app/Http/Requests/**", "database/migrations/**"]
}
```

- Line numbers drift, so an anchor is identified by **symbol + snippet hash**. Lines are only a hint.
- `snippetHash` is computed on the snippet with whitespace normalised.
- `hotspots` are rule-bearing locations proposed by `rulebook-map` and validated by the user. They drive creation detection.

## 5. Architecture

Two halves share the same reference files:

- **Skills (the brain)** do the judgment work: they read code, write cards and assess changes. They follow the Agent Skills standard and run in any agent that supports SKILL.md.
- **CLI (the ears)** is a deterministic Node tool with zero dependencies. It matches diffs against the index, writes the inbox, builds the HTML and installs the agent adapters. It never calls an LLM.

### 5.1 Skills

| Skill | Level | Trigger (description intent) |
|---|---|---|
| `rulebook-map` | 1 | "map the business domains", first run on a repo |
| `rulebook-extract` | 2 | "extract the rules of <domain>", after the map is validated |
| `rulebook-edge-cases` | 3 | "find edge cases for <domain or rule>" |
| `rulebook-sync` | companion | "process the rulebook inbox", "sync rulebook", or any agent instruction or hook that says rules may have changed |
| `rulebook-publish` | output | "publish / regenerate the rulebook", "send it to Notion" |

**Portability rules for every SKILL.md:**

1. No vendor tool names (`AskUserQuestion`, `Agent`, `Artifact`…). Describe capabilities: "ask the user", "if you can spawn a sub-agent…".
2. Degrade gracefully. When the agent cannot spawn a sub-agent, the blind audit runs as a separate pass that reads only the cards and their cited files, never the extraction notes.
3. When the CLI is unavailable (no Node), each step that uses it has a manual fallback described in the skill.
4. External publishing targets are detected by capability ("if you have tools that can write to Notion, Google Drive or Confluence…"), never by tool name.

**Shared references** (`references/`) are the source of truth in the repo and are **copied into each skill folder at release**. CI fails if the copies differ. Contents:

- `card-template.md`: the card and domain-file formats.
- `vocabulary.md`: kinds, categories, confidence, audit, status.
- `ids.md`: ID rules.
- `policy-vs-rule.md`: how to tell a policy from an operating rule, with examples and counter-examples.
- `writing-style.md`: RuleSpeak phrasing, plain-language context, no jargon above the evidence line.
- `labels.json`: localised labels.
- `hotspots.md`: rule-bearing patterns per stack (Laravel, Rails, Django, Spring, NestJS/Express, .NET, Go).

### 5.2 Skill flows

**`rulebook-map` (level 1)**

1. Ask about scope (whole repo or sub-folders) and the language of the reference.
2. Survey the tree, routes and entry points, models, schema and migrations, module names, README.
3. Propose 4 to 12 domains, each with a code, a one-sentence description, its folders and suggested hotspots.
4. **Build, then corrections:** the map is written and the HTML built; the user then renames, merges, splits or drops domains and confirms the hotspots.
5. Write `config.json`, `index.md` and an initial `.index.json` (hotspots, no anchors).

**`rulebook-extract` (level 2, per domain)**

1. Read from the entry points (routes, commands, jobs, listeners) down to the code that actually decides.
2. Draft the operating-rule cards, then group the rules that share a *why* into policy cards.
3. **Coverage sweep:** scan hotspots, validators, policies, guards, enums, DB constraints, scheduled jobs and config. List every decision point not attached to a card, then either create a card or record it as "out of scope" with a reason.
4. **Blind audit:** a fresh reviewer (a sub-agent if available) gets only the cards. For each card it opens the cited lines, checks that they exist and support the statement, and returns `passed` or `failed: <reason>`. Cards that fail are fixed or downgraded to `inferred`.
5. **Build, then corrections:** after the audit, `index --strict` and `build` run; the user then reviews the policies, `conflicting` rules and open questions in the document.
6. Write the domain file and update `.index.json` (`rulebook index` rebuilds the anchors from the cards).

**`rulebook-edge-cases` (level 3, on demand)**

1. For each target rule, probe boundaries (`<` vs `<=`), null and absent values, forbidden states, operation order, timezones, rounding, concurrency and retries.
2. Write each case as Given/When/Then with its own confidence and evidence. If no test covers it, mark it so and optionally suggest a test (never write it).
3. Write the cases into the cards and build, then offer corrections.

**`rulebook-sync` (companion brain)**

1. Run `rulebook check` (or read `inbox.md` when entries are already there).
2. For each entry, open the diff and the card, then classify it:
   - `changed`: the meaning moved. Propose the new statement.
   - `unchanged`: refactor only, so refresh the anchor.
   - `removed`: propose retirement.
   - `new`: draft a candidate card.
3. **Checkpoint:** the user validates in batch.
4. Apply: update the cards, append `History` lines, set `Verified at`, rebuild the index and clear the processed inbox entries.

**`rulebook-publish`**

1. Run `rulebook build` to render `rulebook.html`.
2. If the agent has tools that can write to Notion, Google Drive or Confluence, **offer** to publish there. Never publish without a yes.

### 5.3 CLI (`rulebook`, npm package `rulebook-cli`, name to confirm on npm)

| Command | Purpose |
|---|---|
| `rulebook init [--agents …] [--yes] [--dry-run]` | Detect installed agents and write the project-level adapters (§6), the AGENTS.md block and the git pre-commit hook. Show the planned changes first, back up existing files and stay idempotent. |
| `rulebook check [--worktree\|--staged\|--since <sha>] [--format line\|json]` | Match the diff against the index and hotspots, write deduplicated inbox entries and print one line per affected rule. Always exits 0 in agent hooks. Non-zero exit is possible in CI with `--strict`. |
| `rulebook hook <agent> <event>` | Adapter entry point: read the agent's hook payload on stdin, call `check`, and answer in that agent's output format. |
| `rulebook index` | Rebuild `.index.json` anchors from the cards and report anchors that cannot be resolved. |
| `rulebook build` | Parse the Markdown and render `rulebook.html` from the bundled template. |
| `rulebook doctor` | Check the installation: adapters present, Node version, index resolvable. |

**Detection algorithm (`check`):**

1. Get the changed hunks for the chosen scope. For `--worktree`, compare against the last checked tree recorded in `.state.json`, so the same change is not reported twice.
2. For each anchor whose file changed:
   - if the snippet hash is still present in the file and no hunk overlaps it → unaffected;
   - if a hunk overlaps it or the hash is gone but the symbol exists → `modified?`;
   - if the symbol is gone → `removed?`.
3. For added hunks inside hotspots, or that match rule-bearing patterns (raise/throw/abort, validation rule arrays, guards, enum or constant changes, DB constraints) and are not covered by any anchor → `new?`.
4. Deduplicate by (rule or file, hunk hash) and append to `inbox.md`.
5. Print, for example, `rulebook: PAY-R012 may have changed (OrderPolicy.php) → rulebook/inbox.md`.

**Inbox entry format:**

```markdown
- [ ] 2026-10-15 14:02 · modified? · PAY-R012 · app/Policies/OrderPolicy.php:41-47 · hunk 3f9a…
```

## 6. Companion — triggering across agents

### 6.1 Two-stage detection (validated by spike, see §10)

1. **Edit-time signal:** a post-edit hook calls `rulebook hook <agent> post-edit` for the edited file. It is immediate and targeted.
2. **Turn-end safety net:** a turn-end hook (or pre-commit) calls `rulebook check --worktree`. It catches edits made through shell commands and edits made by sub-agents, which the edit-time hook misses or reports only to the sub-agent.

`inbox.md` is the common channel. Whoever made the edit, the detection ends up there. The LLM judgment is deferred to `rulebook-sync`, so coding is never interrupted: the user sees a one-line notice and validates later in batch.

### 6.2 Adapters written by `rulebook init`

All adapters are **project-level files, committed to the repo**, so the whole team gets the companion whatever agent each member uses.

| Agent | Post-edit event | Turn-end / fallback | File written | Auto-active |
|---|---|---|---|---|
| Claude Code | `PostToolUse` (`Edit\|Write\|MultiEdit`), `additionalContext` | `Stop` → `systemMessage` | `.claude/settings.json`, or the plugin's `hooks/hooks.json` | Yes |
| GitHub Copilot (CLI, VS Code, cloud agent) | `postToolUse`, `additionalContext` | pre-commit | `.github/hooks/rulebook.json` | Yes (the cloud agent reads only repo hooks) |
| Gemini CLI | `AfterTool` (`write_file\|replace`) | pre-commit | `.gemini/settings.json` hooks or extension | To verify |
| Codex CLI | `PostToolUse` (`apply_patch\|Edit\|Write`), payload in `tool_input.command` | `Stop` / pre-commit | `.codex/hooks.json` | After a one-time `/hooks` approval |
| Mistral Vibe | `post_tool`, `additional_context` | pre-commit | `.vibe/hooks.toml` | Yes (trusted folder) |
| Kiro | `PostToolUse` / `PostFileSave` | pre-commit | `.kiro/hooks/rulebook.*` | To verify |
| Cursor | `postToolUse` (context) / `afterFileEdit` (no context) | pre-commit | `.cursor/hooks.json` (Cursor also reads `.claude/settings.json` hooks) | To verify |
| OpenCode | JS plugin `tool.execute.after` | pre-commit | `.opencode/plugins/rulebook.js` | Yes, via plugin |
| Windsurf / Devin Desktop | `post_write_code` (no context injection) | AGENTS.md + pre-commit | `.devin/hooks.json` | Partial: a notice goes to the log only |

**Universal layers, always installed:**

- An **AGENTS.md block**: "After changing validation, permissions, calculations, states or deadlines, run `rulebook check` and mention its output."
- A **git pre-commit hook**: `rulebook check --staged`, which prints a notice and does not block by default.
- An optional **GitHub Action**: comment on the PR with the affected rules, and `--strict` to require that the inbox is processed.

### 6.3 Toolbox independence

Hooks fire at the agent's tool layer, below any workflow toolbox. The spike confirmed in Claude Code that superpowers' `SessionStart` hook and rulebook's hooks run side by side. spec-kit and BMAD drive the agent through prompts and commands, so their edits go through the same tools and trigger the same hooks. rulebook never depends on a toolbox and never modifies one.

## 7. HTML document (`rulebook.html`)

### 7.1 What it is

- A **single self-contained file**: no CDN, works offline, can be emailed or attached.
- Generated by `rulebook build` from the Markdown, by injecting JSON into the bundled `viewer.html` template. Text is copied verbatim and never reworded.
- Read like a **document**, top to bottom, not like a dashboard.

### 7.2 Structure

1. Header: project, version date, commit, rule counts, and a one-line purpose.
2. **"Since <previous version>"** block: rules that are new, changed (old → new value) or retired, computed from `History`. It also shows the count of items awaiting validation.
3. Table of contents: domains with rule counts. Domains not yet extracted are listed and greyed out.
4. One section per domain, in this order:
   - the domain description;
   - its policies (with their statements);
   - beneath each policy, its operating rules;
   - for each rule, its statement in a serif "voice", a one-line evidence footer (confidence in plain words, linked locations, history link), edge cases in plain sentences, and open questions as a quiet side note.
5. A final "To validate" section that gathers all open questions, `conflicting` rules, failed audits and unprocessed inbox items.
6. Footer: commit analysed, coverage (domains mapped and extracted) and rulebook version.

### 7.3 Behaviour

- Full-text search and filters (kind, category, confidence, status).
- Deep links (`rulebook.html#PAY-R012`).
- Evidence becomes links to the hosting platform at the exact line when `config.json` has a repo URL.
- Light and dark themes, mobile-friendly, a print stylesheet for a clean PDF export.

### 7.4 Visual direction

The direction validated in brainstorming is calm, editorial and text-first:

- generous whitespace;
- one confidence indicator per rule, written in plain words ("Proven by code and a test");
- IDs and categories visually secondary;
- no badge clutter;
- status tags only for new, changed and retired rules.

## 8. Distribution

One public GitHub repo, `rulebook`, published through three channels:

| Channel | Command | Covers |
|---|---|---|
| skills.sh | `npx skills add <owner>/rulebook` | Skills on every Agent-Skills-compatible agent (no hooks) |
| Claude Code plugin marketplace | `/plugin marketplace add <owner>/rulebook` | Skills plus plugin hooks, auto-active |
| npm | `npx rulebook-cli init` | CLI plus project adapters for every detected agent (the REA-style setup) |

The README explains:

- the two halves (skills plus companion);
- installation per agent;
- an example reference generated on a known open-source project (kept in `examples/`).

### 8.2 Updates

None of the three channels updates on its own by default:
- Claude Code: auto-update is off for third-party marketplaces.
- skills.sh: updates run through `npx skills update`.
- npm: updates are manual.

Four parts can also drift apart: skills, CLI, project adapters and card format. The design closes both gaps:

1. **One version for the whole pack.** Skills, CLI and adapter templates are released together, by an automated release that also bumps `.claude-plugin/plugin.json`. Claude Code ignores a push whose `version` is unchanged.
2. **The CLI is the update hub (REA model).**
   - The npm package bundles the skills.
   - `rulebook update` refreshes the skill copies the CLI installed and re-runs `init` to refresh the project adapters. `init` is idempotent.
   - Every generated file carries a `rulebook <version>` stamp so outdated ones can be detected.
   - If skills were installed through the plugin marketplace or skills.sh, `update` leaves them alone and prints that channel's command (`claude plugin update rulebook@<marketplace>` / `npx skills update`).
3. **Update notice, off the hot path.**
   - At most once per 24 h, `rulebook check` starts a detached background lookup of the latest npm version, with a 2 s timeout and the result cached in the user cache directory.
   - When a newer version is cached, `check` prints one extra line, at most once a day: `rulebook <x.y.z> available — npx rulebook-cli@latest update`.
   - There is never a network call in the foreground of a hook.
   - Disabled with `RULEBOOK_NO_UPDATE_CHECK=1`, and automatically in CI (`CI` env var set).
4. **Compatibility contract.**
   - `rulebook/config.json` carries `formatVersion` (starting at `1`).
   - Each skill's first step runs `rulebook doctor --quiet` when the CLI is available. `doctor` reports skew between skills, CLI, adapters and format.
   - A major format change ships with `rulebook migrate`.
5. **Teams on Claude Code.** `init` can declare the marketplace and plugin in the project's `.claude/settings.json` (`extraKnownMarketplaces`, `enabledPlugins`) so teammates are offered the plugin. The README explains how to turn on auto-update for the marketplace.

Implementation lands in plan 2 (`update`, notice, `doctor`, stamps) and plan 5 (single release, plugin version bump).

### 8.3 Repository layout

```
rulebook/
├── skills/
│   ├── rulebook-map/SKILL.md (+ references/ copy)
│   ├── rulebook-extract/SKILL.md
│   ├── rulebook-edge-cases/SKILL.md
│   ├── rulebook-sync/SKILL.md
│   └── rulebook-publish/SKILL.md
├── references/              # source of truth, copied into each skill at release
├── cli/                     # Node, zero deps: init, check, hook, index, build, doctor
│   ├── adapters/            # per-agent hook templates
│   └── viewer/viewer.html   # HTML template
├── .claude-plugin/          # plugin.json, marketplace.json, hooks/hooks.json
├── examples/                # generated reference on an open-source project
├── tests/                   # CLI unit tests + fixture repos + skill evals
├── docs/specs/
└── README.md
```

## 9. Testing and evaluation

- **CLI unit tests** on fixture repos with known anchors. They cover modified, removed and new detection, dedup, line drift (an insert above the anchor must not trigger), renamed symbols, and edits made through the shell.
- **Adapter tests:** for each agent, a recorded hook payload goes through `rulebook hook`, and the output must match that agent's expected format.
- **End-to-end companion test**, scripted in headless Claude Code and in at least one other agent (Codex or Vibe). Three edit paths, direct, sub-agent and shell, must all produce an inbox entry.
- **Skill evals** on a fixture app with a hand-written ground-truth catalogue (around 30 rules, of which 10 are policies, plus edge cases). The metrics are rule recall and precision, citation validity (100% expected after the audit), and policy-vs-rule agreement.
- **Dogfooding:** the first real run is on a real Laravel project. A second run on a well-known open-source project produces `examples/`.

## 10. Spike evidence (2026-10-15, throwaway)

We ran a throwaway Claude Code plugin with `PostToolUse` and `Stop` hooks in headless sessions, with superpowers active:

| Scenario | Result |
|---|---|
| Direct edit | `PostToolUse` fired, `additionalContext` reached the model |
| Edit by sub-agent | Hook fired (`agent_id` set), but context reached only the sub-agent |
| Edit via `sed` | `PostToolUse` did not fire |
| `Stop` hook + `git diff` | Caught the `sed` edit and wrote the inbox entry |
| Coexistence with superpowers | Both ran with no conflict |

Not verified: whether `systemMessage` is displayed in an interactive session (headless mode does not show it).

## 11. Risks and open questions

| # | Item | Mitigation / next step |
|---|---|---|
| 1 | Post-edit hooks inside sub-agents are unverified for Codex, Cursor, Gemini, OpenCode and Kiro | The turn-end and pre-commit net covers it. Verify during adapter tests. |
| 2 | Auto-activation of packaged hooks is unverified on Gemini, Kiro and Cursor | Project-level files written by `init` don't rely on packaging. |
| 3 | Codex requires a one-time `/hooks` approval | `init` prints the exact instruction. `doctor` detects when approval is missing. |
| 4 | Windsurf cannot inject context | Notice is shown via log, AGENTS.md and pre-commit. Documented as partial support. |
| 5 | Creation detection is heuristic and may be noisy | Restrict it to validated hotspots and patterns, dedup, let the user dismiss an entry with "not a rule", and remember dismissals. |
| 6 | Anchors break on large refactors | `rulebook index` reports unresolved anchors, and `rulebook-sync` re-anchors them. |
| 7 | Policy vs rule is a judgment call | Shared `policy-vs-rule.md` with examples. The `nature` justification is mandatory. A human validates every policy. |
| 8 | npm name `rulebook` may be taken | Check before the first release, fallback `rulebook-cli`. |
| 9 | Node is absent in some environments (for example a Python-only Vibe user) | Skills keep manual fallbacks. `doctor` explains what is lost. |

## 12. Decisions log (from brainstorming)

1. Generic pack, for any codebase. A real Laravel project is the first test ground.
2. Three levels, each validated before the next. *Amended 2026-10-16:* each level writes its cards and builds the HTML first, then offers corrections; the user reviews the document, not a chat summary. Sync keeps its validation before rewriting validated cards.
3. Policy = why, rule = how, linked by `implements`.
4. Readers are both business and dev: plain language on top, evidence below.
5. Output is Markdown (the source of truth) plus a generated HTML document, with external tools (Notion, Drive…) **proposed** as output targets when an MCP is detected.
6. Architecture B: five focused skills plus shared references, copied into each skill (option a).
7. Skills in English, public on GitHub, no lock-in to Claude.
8. Living reference: statuses, per-rule history, a "since last version" block.
9. Companion: one-line notice plus inbox, with batch validation and never a silent rewrite.
10. Companion = deterministic CLI + per-agent project adapters + AGENTS.md + pre-commit + optional CI.
11. Updates: one version for the whole pack, the CLI as the update hub, a once-a-day notice off the hot path, and a `formatVersion` compatibility contract (§8.2).
