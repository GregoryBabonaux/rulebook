# rulebook-edge-cases — baseline (no skill), sonnet, 2026-10-16

Score: 7/7 after fixing the evaluator (its lock-expiry check demanded "15" in the sentence; the
baseline's "locked until T, login at exactly T" case is correct).

The baseline already: followed the card format it found, wrote Given/When/Then, set confidence
honestly (`read`, none `verified` because no test covers them), wrote no test, asked before
treating suspected gaps as documented behaviour. It also found real gaps (no counter reset on
success, case-sensitive email uniqueness).

Consequence: `rulebook-edge-cases` stays short — scope, the probe list, the "never write tests"
and "verified only with a test" lines — no enforcement prose.
