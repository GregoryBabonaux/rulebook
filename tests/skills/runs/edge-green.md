# rulebook-edge-cases — with skill, sonnet, 2026-10-16

Score: 6/7 (baseline 7/7 — the baseline already complied; the skill must not regress it).
- 21 cases on ACC-R001..R003 and PRC-R002: boundaries, exact expiry instants, null/missing values,
  check order, concurrency; gap-like ones also put in `Open questions.`; none `verified` (no tests).
- Checkpoint at step 4. No test or source file written; suggested 3 tests in the report.

Failure: PRC-R002.E7 cited `src/pricing/discount.js:3,9` — a list the card format does not accept,
so the parser dropped its confidence and reference.
REFACTOR: the skill now requires exactly one `path:line` or `path:start-end` reference per case.
Follow-up for the CLI (plan 1 parser): warn when an edge-case tail cannot be parsed.
