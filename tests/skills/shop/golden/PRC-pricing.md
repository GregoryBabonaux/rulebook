# PRC · Pricing
How coupons and discounts change what a customer pays.

## PRC-P01 · Promotions do not stack
- **Kind:** policy · **Nature:** commercial policy of the shop
**Statement.** A customer cannot combine several promotions on the same purchase.

### PRC-R001 · One coupon per order
- **Kind:** rule · **Category:** validation · **Implements:** PRC-P01
- **Status:** active · **Confidence:** read · **Audit:** passed

**Rule.** An order accepts at most one coupon.

**Evidence.**
- enforcement — src/pricing/discount.js:4-6 `applyCoupons`

## Other operating rules

### PRC-R002 · Expired coupons are refused
- **Kind:** rule · **Category:** validation
- **Status:** active · **Confidence:** read · **Audit:** passed

**Rule.** A coupon may not be used after its expiry date.

**Evidence.**
- enforcement — src/pricing/discount.js:9-11 `applyCoupons`

### PRC-R003 · A discount is capped at 30%
- **Kind:** rule · **Category:** calculation
- **Status:** active · **Confidence:** read · **Audit:** passed

**Rule.** A discount can never exceed 30% of the subtotal, whatever the coupon says.

**Parameters.** `MAX_DISCOUNT = 0.3` — config/shop.json:3

**Evidence.**
- enforcement — src/pricing/discount.js:12
- config — config/shop.json:3

### PRC-R004 · Amounts are rounded to the cent
- **Kind:** rule · **Category:** calculation
- **Status:** active · **Confidence:** read · **Audit:** passed

**Rule.** Discounts and totals are rounded to the nearest cent.

**Context.** A technical choice, not a business policy.

**Evidence.**
- enforcement — src/pricing/discount.js:17-19 `roundCents`

### PRC-R005 · Books use the reduced VAT rate
- **Kind:** rule · **Category:** validation
- **Status:** active · **Confidence:** read · **Audit:** passed

**Rule.** A product of the book category can only be saved with a VAT rate of 5.5 %.

**Context.** The check runs when a product is saved; rows saved before it are not re-checked. The reference data holds one book at 20 % (Dune, id 2).

**Parameters.** `BOOK_VAT_RATE = 0.055` — config/shop.json:4

**Evidence.**
- enforcement — src/pricing/vat.js:4-9 `checkVatRate`
- config — config/shop.json:4
- data — reference:products.vat_rate `category = 'book' AND vat_rate <> 0.055`

**Open questions.** Should the book with id 2, at 20 %, be corrected to 5.5 %?
