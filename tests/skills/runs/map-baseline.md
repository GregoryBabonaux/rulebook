# rulebook-map — baseline (no skill), sonnet, 2026-10-16

Score: 2/5 (`node tests/skills/evaluate.mjs map <ws>`)

Observed failures:
- Wrote the map to `rulebook/domains.md` in free form, not `rulebook/index.md` in the domain-map format; no domain codes.
- Proposed 5 domains, splitting Accounts into authentication/authorization and Orders into lifecycle/refunds (too fine for a first map).
- Ran `rulebook init --yes` on its own: created `AGENTS.md` and a git pre-commit hook — outside `rulebook/`, without asking.
- `config.json` came from init: `hotspots: []`.
- Listed rules while mapping (out of scope for level 1) — useful notes, wrong place.
- Asked validation questions only after writing files.

Good instincts to keep: spotted the lying comment and the dead `legacyRefund`.
