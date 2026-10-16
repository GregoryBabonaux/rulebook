const assert = require('node:assert');
const test = require('node:test');
const { canRequestRefund } = require('../src/orders/refund');

const DAY = 24 * 60 * 60 * 1000;
const DELIVERED = 1000;

test('refund refused after the window', () => {
  assert.equal(canRequestRefund({ deliveredAt: DELIVERED }, DELIVERED + 15 * DAY), false);
});

test('refund accepted on the last day', () => {
  assert.equal(canRequestRefund({ deliveredAt: DELIVERED }, DELIVERED + 14 * DAY), true);
});
