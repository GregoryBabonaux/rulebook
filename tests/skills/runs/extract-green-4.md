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

## On a real project (Cluengo, Laravel), 2026-10-16

| Domain | Skill | Rules | Decision points examined | First blind audit |
|---|---|---|---|---|
| JEU | 0.1.0 | 43 | 53 / 196 (27 %) | 21 / 43 failed (49 %) |
| ENQ | detection | 21 | 28 / 28 (100 %) | 3 / 21 failed (14 %) |

- JEU's second pass with the scan found 5 rules the first extraction missed and 8 pieces of
  dead code.
- The 3 ENQ failures share one cause: `verified` claimed where no cited test asserts the rule
  (downgraded to `read`). JEU's failures were mostly evidence outside the deciding lines and
  over-broad statements.
- Not a controlled experiment: two domains of different difficulty, written differently (JEU
  by an orchestrator from three readers' notes, ENQ by a single agent), one run each.

### JEU redone from scratch with the detection skill (same code, commit 238ea8f)

| | JEU, skill 0.1.0 | JEU, detection skill |
|---|---|---|
| Rules | 43 (48 after the scan pass) | 78 |
| Decision points examined | 53 / 196 | 196 / 196 |
| First blind audit failures | 21 / 43 (49 %) | 17 / 78 (22 %) |
| — wrong lines or parameters | ~10 | 2 |
| — statement wrong or too broad | ~5 | 8 |
| — a cited test does not assert the rule | ~8 | 9 |
| Old rules found again | — | 46 / 48 |

- The two old rules not found again live outside the paths the map gives JEU (badges decided
  in a Blade view, the AI circuit breaker in app/Ai): the scan only inventories mapped paths.
- The gain is on mechanical errors; a test cited that does not assert the rule is now the
  main failure, and the next thing to check mechanically.
- Found while running: the agent handed back before its parallel readers finished (skill fixed).
