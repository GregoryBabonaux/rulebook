# Business policy or operating rule?

**The test:** would the statement still be true if the software did not exist?
Yes → **policy** (*règle métier*, the why). No, it describes what the system does → **operating rule** (*règle de gestion*, the how).

| Policy (why) | Operating rule (how) |
|---|---|
| A customer may withdraw from a purchase within a legal period. | A refund can be requested only up to 14 days after delivery. |
| Large refunds need a second person's approval (fraud prevention). | A refund above 500 must be approved by a user with the admin role. |
| Accounts must resist password guessing. | After 5 failed logins the account is locked for 15 minutes. |
| A customer cannot stack promotions. | An order accepts at most one coupon. |
| An order cannot be cancelled once it has left the warehouse. | Cancel is allowed only in the states `pending` and `paid`. |

## Not a policy
Technical or organisational choices are operating rules **without** a policy:
rounding amounts to cents, retry counts, cache durations, pagination sizes.
Put them under `## Other operating rules`. Do not invent a "why" for them.

## Writing a policy card
- `Nature` is mandatory: one short phrase saying what makes it true outside the software —
  a law, a contract, the nature of the trade, a company decision. If you cannot name one,
  it is not a policy.
- A policy has **no direct code evidence**. Its evidence is the operating rules under it.
- A policy with no operating rule under it does not belong in the reference yet.
- Group rules under one policy only when they share the same why.
- Every policy is reviewed by a human after the first build: you propose, they decide.
