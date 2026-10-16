---
name: rulebook-edge-cases
description: Use when asked for the edge cases, boundary conditions, corner cases or "cas limites" of a documented business rule or domain in rulebook/, or when a rule card has no Edge cases section and someone asks what happens at its limits.
---

# rulebook-edge-cases — level 3: what happens at the limits

## Overview
For each target rule, find the situations where its behaviour is not obvious and state, from
the code, what actually happens. Facts only: you describe the system, you do not fix it.

## Steps
1. **Target.** One rule (`PAY-R012`) or a whole domain (`ACC`). Read the cards and their evidence.
2. **Probe** the code behind each rule:
   - boundaries: `<` vs `<=`, the exact limit value, one past it;
   - missing or null values, empty collections, zero, negative numbers;
   - forbidden or unexpected states, the order of checks (which error wins);
   - time: the exact instant of an expiry, time zones, daylight saving;
   - rounding, units, character counting;
   - repetition and concurrency: retries, double submission, counters that never reset.
3. **Write each case** as one bullet in the card's `Edge cases.` section:
   `- **<rule id>.E<n>** Given <situation>, when <action>, then <outcome>. — <confidence> — <path>:<line>`
   - Exactly one reference: `path:line` or `path:start-end` — never a list like `path:3,9`
     (the card would lose its confidence). Pick the line that decides.
   - `verified` only when a test asserts exactly that case; otherwise `read` (or `inferred`).
   - A case that looks like a gap or a bug is still written as what the code does, and is
     also added to `Open questions.` for a human to decide.
4. **Checkpoint.** Show the new cases per rule; ask the user to validate before writing.
5. **Write** into the cards, then run `rulebook index` and fix any warning.

## Boundaries
- Never write or change tests or source code. You may *suggest* a test in your report.
- Write only the `Edge cases.` and `Open questions.` sections of the target cards.
- Number cases after the highest existing `.E<n>`; never renumber.

## Common mistakes
| Mistake | Instead |
|---|---|
| Restating the rule ("refund refused after 14 days") | A limit: "delivered exactly 14 days ago → accepted" |
| `verified` because the code is obvious | `verified` needs a test |
| Silently treating a gap as intended | Write the fact, and ask in `Open questions.` |
