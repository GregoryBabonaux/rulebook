# Closed vocabularies

Always write these values as the English codes below, whatever the reference's language.
The HTML document translates them for readers.

## Kind
| Code | Means | Ask yourself |
|---|---|---|
| `policy` | Business policy (*règle métier*): **why**. True even without the software. | Would a lawyer, accountant or domain expert state it without knowing the app? |
| `rule` | Operating rule (*règle de gestion*): **how** the system enforces something. | Does it describe a check, a calculation, a state change the code performs? |

See `policy-vs-rule.md` for examples.

## Category (operating rules only)
| Code | Use when the code… | Example |
|---|---|---|
| `validation` | accepts or rejects input | password ≥ 12 characters |
| `calculation` | computes a value | discount = 10% of subtotal |
| `authorization` | decides who may do something | only an admin approves refunds > 500 |
| `state-transition` | moves an entity between states | an order can be cancelled only before shipping |
| `derivation` | infers a value from others | an order is "late" when not shipped after 3 days |
| `data-constraint` | enforces integrity in storage | email is unique |
| `timing` | involves deadlines, expiry, schedules | refund window of 14 days |
| `integration` | follows a contract with an external system | refunds go back to the original card |

## Confidence
| Code | Only if |
|---|---|
| `verified` | You read the enforcing code **and** a test asserts the behaviour. |
| `read` | You followed the execution path end to end; no test asserts it. |
| `inferred` | Based on names, comments or config only, or a path you could not follow fully. |
| `conflicting` | Two paths disagree, or code and test disagree. Describe both; do not pick one. |

Never raise confidence because a comment or a function name agrees with you.

## Audit
`passed`, or `failed: <reason>`, set by the blind audit only.

## Status
| Code | Means |
|---|---|
| `candidate` | Proposed (e.g. detected by the companion), not yet validated by a human. |
| `active` | Validated and current. |
| `changed` | Validated, and its meaning changed since the previous published version. |
| `retired` | No longer enforced. Keep the card and its ID. |

## Evidence kind
`enforcement` (code that applies the rule), `test`, `config`, `schema`, `doc`, `data` (a value
or rows read in a declared data source, see `data.md`).
