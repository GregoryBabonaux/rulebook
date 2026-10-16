// Loyal customers (10 orders or more) get free delivery.
function hasFreeDelivery(customer) {
  return customer.orderCount >= 10;
}

module.exports = { hasFreeDelivery };
