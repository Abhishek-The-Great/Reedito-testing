const reeditoBookshelf = require('./base');

const StripePrice = reeditoBookshelf.Model.extend({
  tableName: 'stripe_prices',

  stripeProduct() {
    return this.belongsTo('StripeProduct', 'stripe_product_id', 'stripe_product_id');
  },
});

const StripePrices = reeditoBookshelf.Collection.extend({
  model: StripePrice,
});

module.exports = {
  StripePrice: reeditoBookshelf.model('StripePrice', StripePrice),
  StripePrices: reeditoBookshelf.collection('StripePrices', StripePrices),
};
