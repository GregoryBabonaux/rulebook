# rulebook-extract — scan and coverage (plan "stronger detection"), sonnet, 2026-10-16

Fixture: the shop with the traps seen on Cluengo (a discount on a client-sent flag, a function
only tests call, two contradictory password minimums, a rule decided in a template).

| Run | Skill | CLI | Criteria | Recall | Precision | Traps |
|---|---|---|---|---|---|---|
| baseline | 0.1.0 (published) | 0.1.0 | 18/20 | 1.00 | 0.93 | 7/7 |
| green 4a | detection | local | 20/20 | 1.00 | 0.93 | 7/7 |
| green 4b | detection | local | 20/20 | 1.00 | 0.84 | 7/7 |

- The baseline misses only the two new criteria: three decision points left unaccounted for
  (two dead functions, a unit constant) and no Scope paragraph. On nine files a careful agent
  reads everything; the scan matters on large domains (Cluengo JEU: 122 points the first
  extraction never examined).
- Both green runs ran the scan first, dismissed dead code in `not-rules.md` with a reason,
  and left 0 points to review.
- 4b's lower precision: finer cards (the login counter split in two, rounding of subtotal and
  total) — not wrong rules.
- Found while measuring, fixed: the scan missed comparisons with constants or configuration,
  calculations, boolean conditions and transition tables (scan recall 8/14 → 14/14);
  reachability counted an export list as a call; the fixture's functions were not wired to any
  route, and its login route was inverted (flagged by the 4b blind audit).
