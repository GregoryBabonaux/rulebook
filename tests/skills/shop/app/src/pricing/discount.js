const config = require('../../config/shop.json');

function applyCoupons(order, coupons, now = Date.now()) {
  if (coupons.length > 1) {
    throw new Error('Only one coupon per order');
  }
  const [coupon] = coupons;
  if (!coupon) return order;
  if (coupon.expiresAt < now) {
    throw new Error('Coupon expired');
  }
  const rate = Math.min(coupon.rate, config.MAX_DISCOUNT);
  const discount = roundCents(order.subtotal * rate);
  return { ...order, discount, total: roundCents(order.subtotal - discount) };
}

function roundCents(amount) {
  return Math.round(amount * 100) / 100;
}

module.exports = { applyCoupons, roundCents };
