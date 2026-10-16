# Blind audit

The audit is a second pass that sees only the card files and the repository — not the notes
of whoever wrote the cards. Give this checklist, unchanged, to the auditor (a sub-agent, or
yourself in a separate pass). Read only; it never edits a file.

For **each operating rule card**, using only the card and the code:

1. **Lines and symbol.** The cited lines exist, and the cited symbol is there (or declared just
   above).
2. **Statement.** The enforcement lines support the `Rule.` as written: the values, the
   conditions, who and when. Walk every branch of the deciding code (each type, each status,
   each enum case, the order of the checks): a statement that says "always", "never", "only",
   "every" or "any" fails if one branch does otherwise.
3. **Tests.** Each cited test exists at its lines and one of its assertions checks the rule's
   outcome — not just that the code runs. Check its name and setup: it is the test of this
   case, not of the neighbouring one (accepted vs refused, enabled vs disabled, another type). With `Confidence: verified`, at least one cited test
   must do so; otherwise the card should say `read`.
4. **Conflicts.** For a `conflicting` card, both sides are real.
5. **Edge cases.** The line each case points at supports it. A `verified` case points at the
   assertion of the test of that very case, and its values are the ones that test uses.
6. **Context and parameters.** No claim the code contradicts (values, line numbers).
7. **Client-held state.** If the rule relies on a value the client can change (a form field,
   a request body, an unlocked component property, a phase sent by the browser), the card says so.

Comments never count: the code is the only truth. A small line offset that still covers the
deciding code passes; a wrong value, a wrong condition, a test that does not assert the claim
or lines that do not hold the decision fail.

Then check a sample of `rulebook/not-rules.md` for this domain: every 5th entry. Each reason
must be true — "applique <ID>" only if that card's rule states what the line decides;
another domain only if the line concerns it; technical only if it decides nothing a business
reader cares about; dead code only if nothing calls it. An entry that hides a rule fails.

Answer one line per card: `<ID> — passed` or `<ID> — failed: <reason and the fix>`, then one line per
wrong `not-rules.md` entry, then the list of failures and their count.
