const TRANSITIONS = {
  pending: ['paid', 'cancelled'],
  paid: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

function transition(order, to) {
  if (!TRANSITIONS[order.status].includes(to)) {
    throw new Error(`Cannot go from ${order.status} to ${to}`);
  }
  return { ...order, status: to };
}

module.exports = { transition, TRANSITIONS };
