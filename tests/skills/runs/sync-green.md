# rulebook-sync — with skill, sonnet, 2026-10-16

Score: 8/8 (baseline 4/8).
- ORD-R001: `Rule.` rewritten to 7 days, Status changed, History `changed`, confidence `conflicting`
  because tests/refund.test.js still asserts 14 days — raised as an open question.
- ACC-R001: classified unchanged (rename), evidence re-pointed to validatePassword, `reanchored` line.
- giftcard.js → PRC-R005 `candidate`. Exports line dismissed with `- [x]`; the 3 processed lines deleted.
- One checkpoint at step 3 covering the four entries.

REFACTOR from this run: the skill allowed "worktree" as the History sha, which the CLI rejects;
the skill now says to use the short sha of HEAD for History and Verified at.
