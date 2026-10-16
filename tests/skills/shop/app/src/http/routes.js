const { validateSignup } = require('../accounts/signup');
const { applyStaffDiscount } = require('../orders/checkout');
const { canRequestRefund, approveRefund } = require('../orders/refund');

module.exports = (app) => {
  app.post('/signup', (req, res) => res.json(validateSignup(req.body)));
  app.post('/checkout', (req, res) => res.json(applyStaffDiscount(req.order, req)));
  app.get('/cart', (req, res) => res.render('cart.njk', { order: req.order }));
  app.post('/refunds', (req, res) => res.json({ ok: canRequestRefund(req.order) }));
  app.post('/refunds/approve', (req, res) => res.json(approveRefund(req.refund, req.user)));
};
