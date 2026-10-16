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

### JEU, third run (skill with every-branch, asserting tests, audit checklist, scan follow)

| | v1 (0.1.0) | v2 (scan) | v3 (precision) |
|---|---|---|---|
| Cards | 43 | 78 | 37 |
| Old rules found again | — | 46 / 48 | 46 / 48 |
| First audit failures | 21 / 43 (49 %) | 17 / 78 (22 %) | 6 / 37 (16 %) |
| — statement wrong or too broad | ~5 | 8 | 2 |
| — a cited test does not assert the rule | ~8 | 9 | 1 |
| — edge case or detail | — | — | 4 |
| not-rules.md sample wrong (every 3rd entry) | — | 1 / 25 | 0 / 30 |

- v3 groups decisions into fewer, broader cards (2.2 enforcement lines per card, against 1.7)
  and leaves the admin field review to PAR, as the map says: 63 of v2's 78 cards are covered.
  The skill now asks for one card per decision.
- The scan follow found the recap badges (Blade view), missed by v1 and v2.
- A name-based check "the cited test mentions the rule's class or method" was tried and
  dropped: 12 hints on v2, only 2 of them among the 10 cards the audit failed for a test.
- v3 is installed in Cluengo after fixing its 6 audit failures.

### JEU, fourth run (one card per decision, readers in the foreground)

| | v1 | v2 | v3 | v4 |
|---|---|---|---|---|
| Cards | 43 | 78 | 37 | 62 |
| Enforcement lines per card | — | 1.7 | 2.2 | 1.7 |
| v1 rules found again | — | 46 / 48 | 46 / 48 | 47 / 48 |
| First audit failures | 49 % | 22 % | 16 % | 18 % (11 / 62) |
| — statement wrong or too broad | ~5 | 8 | 2 | 0 (1 context claim) |
| — wrong test cited, or a test that does not assert | ~8 | 9 | 1 | 6 |
| — edge-case value copied wrong | — | — | 4 | 4 |
| not-rules.md sample wrong | — | 1 / 25 | 0 / 30 | 0 / 30 |

- v4 keeps v2's level of detail with v3's reliability on statements, and covers all 37 v3 rules.
- What remains is citations: a test from the neighbouring case, or an edge case whose value
  differs from the test it cites. The two auditors of v4 disagree in severity (10 / 31 and
  1 / 31): audit variance is of the same order as the differences between v3 and v4.
