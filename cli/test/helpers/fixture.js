export const POLICY_SRC = [
  '<?php',
  'class OrderPolicy',
  '{',
  '    public function view($user, $order)',
  '    {',
  '        return $user->id === $order->user_id;',
  '    }',
  '',
  '    public function refund($user, $order)',
  '    {',
  '        return $order->delivered_at',
  '            && $order->delivered_at->diffInDays(now()) <= 14;',
  '    }',
  '}',
  '',
].join('\n');

export const TEST_SRC = [
  '<?php',
  'class RefundTest {',
  '    public function test_refund_refused_after_window() {',
  '        $this->assertFalse(refund(15));',
  '    }',
  '}',
  '',
].join('\n');

export const DOMAIN_MD = `# PAY · Payments
How the shop takes and refunds money.

## PAY-P03 · Right of withdrawal
- **Kind:** policy · **Nature:** consumer law
**Statement.** A customer may withdraw from a purchase within a legal period.

### PAY-R012 · Refund allowed up to 14 days after delivery
- **Kind:** rule · **Category:** timing · **Implements:** PAY-P03
- **Status:** active · **Confidence:** verified · **Audit:** passed
- **Verified at:** a1b2c3d (2026-10-15)

**Rule.** A refund can be requested only if the order was delivered 14 days ago or less.

**Context.** Applies the withdrawal right.
The window starts at delivery.

**Evidence.**
- enforcement — app/Policies/OrderPolicy.php:9-13 \`OrderPolicy::refund\`
  \`return $order->delivered_at && ...\`
- test — tests/RefundTest.php:3-5 \`test_refund_refused_after_window\`

**Edge cases.**
- **PAY-R012.E1** Given an order never delivered, when a refund is requested, then it is refused. — read — app/Policies/OrderPolicy.php:11
- **PAY-R012.E2** Given delivery exactly 14 days ago, when a refund is requested, then it is accepted. — verified

**Open questions.** Do public holidays count?

**History.**
- 2026-10-14 · b7e8f9a · changed · window 30 → 14 days
- 2026-10-02 · a1b2c3d · created

## Other operating rules

### PAY-R020 · Refunds are paid to the original payment method
- **Kind:** rule · **Category:** integration
- **Status:** active · **Confidence:** inferred

**Rule.** A refund is always sent back to the card used for the order.
`;

export function baseFiles() {
  return {
    'app/Policies/OrderPolicy.php': POLICY_SRC,
    'tests/RefundTest.php': TEST_SRC,
    'rulebook/PAY-payments.md': DOMAIN_MD,
    'rulebook/config.json': JSON.stringify({ language: 'en', hotspots: ['app/Rules/**'] }, null, 2),
  };
}
