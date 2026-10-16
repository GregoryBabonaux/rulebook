# rulebook-sync — baseline (no skill), sonnet, 2026-10-16

Score: 4/8 (`node tests/skills/evaluate.mjs sync <ws>`)

Observed failures:
- Ticked every processed inbox entry `- [x]` instead of deleting it (the CLI treats a tick as a permanent dismissal).
- Refund card: statement left at 14 days (title/parameters edited, `Rule.` not), no `History` line.
- New gift-card rule written as an active card, not `candidate`.
- No checkpoint before applying changes.

Good instincts to keep: recognised the rename as a false `removed?` and re-anchored; dismissed the `module.exports` `new?`; lowered confidence because the test still asserts 14 days.
