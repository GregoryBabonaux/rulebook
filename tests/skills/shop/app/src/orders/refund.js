const config = require('../../config/shop.json');
const { isAdmin } = require('../accounts/roles');

const DAY = 24 * 60 * 60 * 1000;

// Customers have 30 days to ask for a refund.
function canRequestRefund(order, now = Date.now()) {
  if (!order.deliveredAt) return false;
  return (now - order.deliveredAt) / DAY <= config.REFUND_WINDOW_DAYS;
}

function approveRefund(refund, user) {
  if (refund.amount > 500 && !isAdmin(user)) {
    throw new Error('Refunds above 500 need an admin');
  }
  return { ...refund, status: 'approved', approvedBy: user.id };
}

// Kept for the old back-office, no longer called.
function legacyRefund(order, now = Date.now()) {
  return (now - order.createdAt) / DAY <= 30;
}

module.exports = { canRequestRefund, approveRefund };
