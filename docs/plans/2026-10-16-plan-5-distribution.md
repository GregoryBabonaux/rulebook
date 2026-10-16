# rulebook — Plan 5: distribution (plugin, npm bundle, versions, CI, README)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the repository installable through the three channels of spec §8:
- skills.sh;
- the Claude Code plugin marketplace;
- npm (`npx rulebook-cli`).

All three carry **one version**. A CI workflow keeps it consistent, and an English README explains installation for each agent. Nothing is published by this plan: pushing to GitHub and `npm publish` are left to the human.

**Spec:** `E:\Dev\rulebook\docs\specs\2026-10-15-rulebook-design.md` §8, §8.2 and §8.3.

## Global Constraints
- One version everywhere: `cli/package.json`, `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`. `scripts/versions.mjs --check` fails on any mismatch.
- Plugin hooks call the CLI **pinned** to that version (`npx --yes rulebook-cli@<version> hook claude …`) and use the `|| true` guard.
- The npm package bundles the skills (`cli/skills/`, copied at `prepack`). `rulebook skills` installs them for agents that have no plugin channel.
- Every skill copy installed by the CLI carries a `.rulebook-version` stamp. `rulebook update` refreshes only the copies that carry this stamp; copies installed by skills.sh or the plugin are never touched.
- Zero runtime dependencies.

## Review Focus
1. **Skill directory of a user who already has a skill called `rulebook-map`** from another source, with no stamp: `rulebook skills` must not overwrite it. *(Task 2)*
2. **Version drift** after a manual edit of one manifest: the CI check fails. *(Task 1)*
3. **Plugin hooks firing in a repository without `rulebook/`**: they stay silent with exit 0. This is already covered by `hook`; the hooks.json command must keep `|| true`. *(Task 1)*
4. **Windows paths in the target skill directories.** *(Task 2)*
5. **README commands that do not exist.** Every command in it must be runnable. *(Task 4)*

---

### Task 1: Plugin manifests, plugin hooks and the version check
**Files:**
- Create: `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `hooks/hooks.json`
- Create: `scripts/versions.mjs`, `scripts/versions.test.mjs`

Contents:
- `plugin.json`: `{ name: "rulebook", version, description, author: { name }, license: "MIT", keywords }`. Skills sit at `skills/`, the default location, and hooks at `hooks/hooks.json`.
- `marketplace.json`: `{ name: "rulebook", owner: { name }, plugins: [{ name: "rulebook", source: "./", description, version }] }`.
- `hooks/hooks.json`: `PostToolUse` (`Edit|Write|MultiEdit`), which runs `npx --yes rulebook-cli@<v> hook claude post-edit --stamp <v> || true`, and `Stop`, which runs `… hook claude stop …`.
- `scripts/versions.mjs` exports:
  - `readVersions(root)`, which returns `{ cli, plugin, marketplace, hooks: [versions found in hooks.json] }`;
  - `check(root)`, which returns the list of mismatches;
  - `bump(root, version)`, which rewrites all of them.

  Its CLI accepts `--check` or `<version>`.

- [ ] Step 1: Write the failing test. It works on a temporary tree and checks that:
  - `check` reports a plugin/cli mismatch;
  - `bump` aligns everything, hooks commands included;
  - `check` then returns `[]`.
- [ ] Step 2: Run it. It must fail.
- [ ] Step 3: Implement it, and write the manifests at version `0.1.0`.
- [ ] Step 4: Check that `node scripts/versions.mjs --check` exits 0, and that `npm test` at the root passes.
- [ ] Step 5: Commit.

### Task 2: Bundle the skills in the npm package; `rulebook skills`
**Files:**
- Modify: `cli/package.json`:
  - add `"skills"` to `files`;
  - add `"prepack": "node ../scripts/bundle-skills.mjs"`.
- Create: `scripts/bundle-skills.mjs`, which copies `skills/*` into `cli/skills/`. `cli/skills/` is gitignored.
- Create: `cli/src/install/skills.js`
- Modify: `cli/src/cli.js` (adds the `skills` command)
- Modify: `cli/src/install/update.js` (refreshes stamped copies)
- Test: `cli/test/install/skills.test.js`

Behaviour of `rulebook skills [--target <dir>] [--yes]`:
- Default targets: `~/.agents/skills` (read by Codex, Copilot CLI, Gemini CLI, Cursor, OpenCode and Mistral Vibe) and `~/.claude/skills`.
- The home directory is overridable with `RULEBOOK_HOME` for tests.
- Source: `cli/skills/` when bundled, otherwise `<repo>/skills/` (development).
- For each skill: if the destination does not exist, or carries a `.rulebook-version` stamp, copy it and write the stamp. If it exists **without** a stamp, skip it with the warning "managed elsewhere".
- Without `--yes`, it prints the plan only, like `init`.
- `rulebook update` also refreshes every stamped copy in the default targets.

- [ ] Step 1: Write the failing tests:
  - a fresh install into a temporary `RULEBOOK_HOME` copies 5 skills plus their stamps;
  - an unstamped existing skill is skipped and the warning is printed;
  - `update` refreshes a stamped copy whose stamp is older.
- [ ] Step 2: Run them. They must fail.
- [ ] Step 3: Implement it.
- [ ] Step 4: Run the tests: `npm --prefix cli test` must pass.
- [ ] Step 5: Commit.

### Task 3: CI workflow
**Files:** `.github/workflows/ci.yml`

On push and pull request, run a matrix of `ubuntu-latest` and `windows-latest` × Node `20`, `22` and `24`. Steps:
1. checkout;
2. setup-node;
3. `npm test` (root: scripts, skill-eval unit tests and the CLI);
4. `npm run check` (references in sync);
5. `node scripts/versions.mjs --check`.

- [ ] Write the workflow, validate its YAML syntax locally, and commit.

### Task 4: README and the example
**Files:** `README.md`, `examples/demo/README.md`

The README is in English, with the sections below:
1. What rulebook is (2 paragraphs), with a screenshot path from the demo.
2. The two halves: skills (judgment) and companion (detection).
3. Install:
   - skills.sh: `npx skills add <owner>/rulebook`;
   - Claude Code: `/plugin marketplace add <owner>/rulebook`, then `/plugin install rulebook@rulebook`, and how to turn on auto-update for the marketplace;
   - npm: `npx rulebook-cli init` and `npx rulebook-cli skills`;
   - a per-agent table, copied from spec §6.2 in short form.
4. Quick start: map → extract → edge cases → publish, plus the companion.
5. The card format, linking to `references/card-template.md`.
6. Updates (§8.2).
7. FAQ:
   - "Does it change my code?" No.
   - "Which agents?"
   - "Which languages?"
8. License.

`<owner>` stays a placeholder until the GitHub owner is chosen. That is a human decision.

- [ ] Write it, check every CLI command it lists against `rulebook --help`/the command list, and commit.
