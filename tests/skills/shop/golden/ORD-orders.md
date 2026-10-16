# ORD · Orders
How orders move from payment to delivery, and when they can be cancelled or refunded.

## ORD-P01 · Right of withdrawal
- **Kind:** policy · **Nature:** consumer law (right of withdrawal)
**Statement.** A customer may give back a purchase within a limited period after receiving it.

### ORD-R001 · Refund only up to 14 days after delivery
- **Kind:** rule · **Category:** timing · **Implements:** ORD-P01
- **Status:** active · **Confidence:** verified · **Audit:** passed

**Rule.** A refund can be requested only up to 14 days after delivery.

**Context.** The window starts at delivery, not at order time. A code comment still says 30 days; the code uses the configured 14.

**Parameters.** `REFUND_WINDOW_DAYS = 14` — config/shop.json:2

**Evidence.**
- enforcement — src/orders/refund.js:7-10 `canRequestRefund`
- config — config/shop.json:2
- test — tests/refund.test.js:8-14

**Edge cases.**
- **ORD-R001.E1** Given an order delivered exactly 14 days ago, when a refund is requested, then it is accepted. — verified — tests/refund.test.js:13
- **ORD-R001.E2** Given an order never delivered, when a refund is requested, then it is refused. — read — src/orders/refund.js:8

## ORD-P02 · Large refunds need a second person
- **Kind:** policy · **Nature:** company fraud-prevention rule
**Statement.** A large refund must be approved by someone with authority, not only by the person handling it.

### ORD-R002 · Refunds above 500 need an admin
- **Kind:** rule · **Category:** authorization · **Implements:** ORD-P02
- **Status:** active · **Confidence:** read · **Audit:** passed

**Rule.** A refund above 500 can be approved only by a user with the admin role.

**Evidence.**
- enforcement — src/orders/refund.js:12-17 `approveRefund`
- enforcement — src/accounts/roles.js:1-3 `isAdmin`

## ORD-P03 · No cancellation once shipped
- **Kind:** policy · **Nature:** logistics reality: a shipped parcel cannot be recalled
**Statement.** An order cannot be cancelled once it has left the warehouse.

### ORD-R003 · Cancel only before shipping
- **Kind:** rule · **Category:** state-transition · **Implements:** ORD-P03
- **Status:** active · **Confidence:** read · **Audit:** passed

**Rule.** An order may be cancelled only while it is pending or paid.

**Evidence.**
- enforcement — src/orders/state.js:2-3 `TRANSITIONS`

## Other operating rules

### ORD-R004 · Orders follow a fixed lifecycle
- **Kind:** rule · **Category:** state-transition
- **Status:** active · **Confidence:** read · **Audit:** passed

**Rule.** An order moves only from pending to paid, paid to shipped, and shipped to delivered; any other move is refused.

**Evidence.**
- enforcement — src/orders/state.js:1-14 `transition`

### ORD-R005 · An order total is never negative
- **Kind:** rule · **Category:** data-constraint
- **Status:** active · **Confidence:** read · **Audit:** passed

**Rule.** The total of an order must be zero or more.

**Evidence.**
- schema — db/schema.sql:11
