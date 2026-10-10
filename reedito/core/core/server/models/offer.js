const reeditoBookshelf = require('./base');

const Offer = reeditoBookshelf.Model.extend({
  tableName: 'offers',

  actionsCollectCRUD: true,
  actionsResourceType: 'offer',

  defaults: {
    redemption_type: 'signup',
  },

  product() {
    return this.belongsTo('Product', 'product_id', 'id');
  },
});

module.exports = {
  Offer: reeditoBookshelf.model('Offer', Offer),
};
