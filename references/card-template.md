# Rule card template

This is the strict format every skill writes and the CLI parses. Headings, label syntax
and order are fixed. Values may be in the reference's language, except for the
closed vocabularies, which always use the English codes below.

## Domain file — `rulebook/<CODE>-<slug>.md`

```markdown
# PAY · Payments
One paragraph describing the domain.

## PAY-P03 · Right of withdrawal
- **Kind:** policy · **Nature:** consumer law (withdrawal right)
**Statement.** A customer may withdraw from a purchase within a legal period.

### PAY-R012 · Refund allowed up to 14 days after delivery
- **Kind:** rule · **Category:** timing · **Implements:** PAY-P03
- **Status:** active · **Confidence:** verified · **Audit:** passed
- **Verified at:** a1b2c3d (2026-10-15)

**Rule.** A refund can be requested only if the order was delivered 14 days ago or less.

**Context.** Applies the withdrawal right. The window starts at delivery.

**Parameters.** `REFUND_WINDOW_DAYS = 14` — config/shop.php:14

**Evidence.**
- enforcement — app/Policies/OrderPolicy.php:41-47 `OrderPolicy::refund`
  `return $order->delivered_at?->diffInDays(now()) <= 14;`
- test — tests/Feature/RefundTest.php:88 `test_refund_refused_after_window`

**Edge cases.**
- **PAY-R012.E1** Given an order never delivered, when a refund is requested, then it is refused. — read — app/Policies/OrderPolicy.php:41

**Open questions.** Do public holidays count?

**History.**
- 2026-10-14 · b7e8f9a · changed · window 30 → 14 days
- 2026-10-02 · a1b2c3d · created

## Other operating rules

### PAY-R020 · …
```

## Domain map — `rulebook/index.md`

```markdown
# Business domains

- **PAY** · Payments — How the shop takes and refunds money.
- **STK** · Stock — Inventory and reservations.
```

One line per domain: `- **CODE** · Title — one-sentence description`. Domains listed here
without a domain file yet are shown as "not extracted yet".

## Syntax rules

- **Metadata line:** `- **Label:** value`, with segments separated by ` · `. Put the colon inside the bold.
- **Section:** `**Label.** text`. The text may continue on the following lines until a blank line.
- **Evidence:** `- <kind> — <path>:<start>[-<end>] [`Symbol`]`. It may be followed by one indented excerpt line in backticks. The excerpt is 5 lines max in total.
- **Edge case:** `- **<ID>** <Given/When/Then sentence> [— <confidence>] [— <path>:<line>]`.
- **History:** `- <YYYY-MM-DD> · <sha> · <created|changed|retired|reanchored> [· note]`.
- **Rules that implement no policy** go under `## Other operating rules`, or under any level-2 heading without a policy ID.

## Labels

| Key | English | Français |
|---|---|---|
| kind | Kind | Type |
| category | Category | Catégorie |
| implements | Implements | Applique |
| status | Status | Statut |
| confidence | Confidence | Confiance |
| audit | Audit | Audit |
| verifiedAt | Verified at | Vérifié sur |
| nature | Nature | Nature |
| statement | Statement | Énoncé |
| rule | Rule | La règle |
| context | Context | Contexte |
| parameters | Parameters | Paramètres |
| evidence | Evidence | Preuves |
| edgeCases | Edge cases | Cas limites |
| openQuestions | Open questions | Questions ouvertes |
| history | History | Historique |
| implementedBy | Implemented by | Appliquée par |

## Closed vocabularies (always English codes)

| Field | Allowed values |
|---|---|
| kind | `policy`, `rule` |
| category | `validation`, `calculation`, `authorization`, `state-transition`, `derivation`, `data-constraint`, `timing`, `integration` |
| confidence | `verified`, `read`, `inferred`, `conflicting` |
| audit | `passed`, `failed: <reason>` |
| status | `candidate`, `active`, `changed`, `retired` |
| evidence kind | `enforcement`, `test`, `config`, `schema`, `doc` |
