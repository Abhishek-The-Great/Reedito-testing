import errors from '@tryghost/errors';

const reeditoBookshelf = require('./base');

const GiftDeliveryModel = reeditoBookshelf.Model.extend(
  {
    tableName: 'gift_deliveries',
    hasTimestamps: false,

    defaults: {
      status: 'pending',
      outcome: 'unknown',
    },

    gift() {
      return this.belongsTo('Gift', 'gift_id', 'id');
    },
  },
  {
    async destroy() {
      throw new errors.IncorrectUsageError({ message: 'Cannot destroy GiftDelivery' });
    },
  },
);

export const GiftDelivery = reeditoBookshelf.model('GiftDelivery', GiftDeliveryModel);
