const { validateSignup } = require('../accounts/signup');
const { checkPassword, recordFailedLogin, canLogin } = require('../accounts/password');
const { applyStaffDiscount } = require('../orders/checkout');
const { canRequestRefund, approveRefund } = require('../orders/refund');
const { transition } = require('../orders/state');
const { applyCoupons } = require('../pricing/discount');

module.exports = (app) => {
  app.post('/signup', (req, res) => res.json(validateSignup(req.body)));
  app.post('/password', (req, res) => res.json({ ok: checkPassword(req.body.password) }));
  app.post('/login', (req, res) => res.json({ allowed: canLogin(req.account) }));
  app.post('/login/failed', (req, res) => res.json(recordFailedLogin(req.account)));
  app.post('/checkout', (req, res) => res.json(applyStaffDiscount(applyCoupons(req.order, req.body.coupons), req)));
  app.post('/orders/:id/status', (req, res) => res.json(transition(req.order, req.body.to)));
  app.get('/cart', (req, res) => res.render('cart.njk', { order: req.order }));
  app.post('/refunds', (req, res) => res.json({ ok: canRequestRefund(req.order) }));
  app.post('/refunds/approve', (req, res) => res.json(approveRefund(req.refund, req.user)));
};
