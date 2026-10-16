# Writing the cards

Readers are business people first, developers second. Everything above the evidence
line must make sense to someone who never opened the code.

## The statement (`Rule.` / `Statement.`)
- One sentence, RuleSpeak style: "must", "only if", "may not", "at most", "no later than".
- Concrete values in the sentence: "14 days", "500 €", "5 attempts".
- No function, class or variable names. Parameters go in `Parameters.`.

| Avoid | Write |
|---|---|
| `canRefund()` returns false when diff > REFUND_WINDOW_DAYS | A refund can be requested only up to 14 days after delivery. |
| Validation on password length | A password must have at least 12 characters. |

## Context
1 to 3 plain sentences: why it matters, who it affects, a common misunderstanding.
Anything you deduced rather than read is phrased as such ("Probably…", "The code suggests…").

## Evidence
- Cite the code that **decides**, not the code that merely passes the value along.
- Exact lines: `path:start-end`, plus the symbol when there is one.
- At most one excerpt line per evidence item, 5 lines in total per card. Point, don't copy.
- Comments and names are never evidence on their own.

## Edge cases
`Given <situation>, when <action>, then <outcome>.` One case per bullet, plain words,
with its own confidence and a `path:line` reference when you have one.

## Open questions
Anything a human must decide or confirm: ambiguous behaviour, contradictions,
a value that looks accidental. Ask the question; do not answer it yourself.

## Language
Write the cards in the reference's language (`config.json` → `language`).
Labels may be English or French (see `card-template.md`); closed vocabulary values stay English codes.
