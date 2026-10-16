// Staff members get 20% off their own orders.
function applyStaffDiscount(order, request) {
  if (request.body.isStaff === true) {
    return { ...order, total: Math.round(order.total * 0.8 * 100) / 100 };
  }
  return order;
}

module.exports = { applyStaffDiscount };
