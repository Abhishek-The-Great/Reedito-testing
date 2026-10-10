const reeditoBookshelf = require('./base');

const StripeProduct = reeditoBookshelf.Model.extend(
  {
    tableName: 'stripe_products',

    product() {
      return this.belongsTo('Product', 'product_id', 'id');
    },

    stripePrices() {
      return this.hasMany('StripePrice', 'stripe_product_id', 'stripe_product_id');
    },
  },
  {
    async upsert(data, unfilteredOptions = {}) {
      const stripeProductId = data.stripe_product_id;
      const model = await this.findOne({ stripe_product_id: stripeProductId }, unfilteredOptions);
      if (model) {
        return this.edit(
          data,
          Object.assign({}, unfilteredOptions, {
            id: model.id,
          }),
        );
      }
      return this.add(data, unfilteredOptions);
    },

    add(data, unfilteredOptions = {}) {
      if (!unfilteredOptions.transacting) {
        return reeditoBookshelf.transaction((transacting) => {
          return this.add(data, Object.assign({ transacting }, unfilteredOptions));
        });
      }
      return reeditoBookshelf.Model.add.call(this, data, unfilteredOptions);
    },

    edit(data, unfilteredOptions = {}) {
      if (!unfilteredOptions.transacting) {
        return reeditoBookshelf.transaction((transacting) => {
          return this.edit(data, Object.assign({ transacting }, unfilteredOptions));
        });
      }
      return reeditoBookshelf.Model.edit.call(this, data, unfilteredOptions);
    },

    destroy(unfilteredOptions = {}) {
      if (!unfilteredOptions.transacting) {
        return reeditoBookshelf.transaction((transacting) => {
          return this.destroy(Object.assign({ transacting }, unfilteredOptions));
        });
      }
      return reeditoBookshelf.Model.destroy.call(this, unfilteredOptions);
    },
  },
);

const StripeProducts = reeditoBookshelf.Collection.extend({
  model: StripeProduct,
});

module.exports = {
  StripeProduct: reeditoBookshelf.model('StripeProduct', StripeProduct),
  StripeProducts: reeditoBookshelf.collection('StripeProducts', StripeProducts),
};
