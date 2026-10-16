const assert = require('node:assert');
const test = require('node:test');
const { hasFreeDelivery } = require('../src/orders/loyalty');

test('ten orders give free delivery', () => {
  assert.equal(hasFreeDelivery({ orderCount: 10 }), true);
});
