const config = require('../../config/shop.json');

// Books are sold at the reduced VAT rate; other products keep their own rate.
function checkVatRate(product) {
  if (product.category === 'book' && product.vat_rate !== config.BOOK_VAT_RATE) {
    throw new Error('Books must use the reduced VAT rate');
  }
  return product;
}

module.exports = { checkVatRate };
