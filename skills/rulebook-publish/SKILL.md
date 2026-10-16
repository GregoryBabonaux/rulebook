---
name: rulebook-publish
description: Use when asked to publish, share, export, regenerate or send the rulebook / business-rules reference ("publier le référentiel") — as an HTML page, a PDF, or to Notion, Google Drive, Confluence or another documentation tool.
---

# rulebook-publish — share the reference

## Overview
The Markdown cards in `rulebook/` are the source of truth. Publishing makes a readable copy;
it never changes the cards.

**CLI.** `rulebook …` below means the rulebook CLI: `rulebook`, or `npx --yes rulebook-cli@latest`. Without Node, use the manual column of `references/cli.md`.

## Steps
1. **Check, then build.** Run `rulebook doctor --quiet` and report its warnings (don't fix them
   silently). Then **build the document:** `rulebook build` → `rulebook/rulebook.html` (one self-contained
   file: works offline, can be emailed, prints to PDF from a browser).
   - Options: `--since <YYYY-MM-DD>` to choose the "changes since" baseline, `--out <path>`.
   - Without the CLI: say the HTML could not be built and offer the Markdown files as they are.
2. **External tools — only if you have them.** If you have tools that can write to Notion,
   Google Drive, Confluence or a similar tool, **offer** to publish there and ask where
   (which space or folder, one page or one page per domain). Publish only after an explicit
   yes. Without such tools, do not mention or pretend a publication.
3. **Report** the path of the HTML file, what was published where, and the build summary
   (rules, domains, items to validate).

## Boundaries
- Never send content outside the machine without an explicit yes for that destination.
- Do not commit `rulebook.html` or `.published.json` unless asked.
- Only `rulebook build` writes `rulebook.html`: never write, patch or replace it yourself (`references/cli.md`).
