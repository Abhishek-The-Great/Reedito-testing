const errors = require('@tryghost/errors');
const reeditoBookshelf = require('./base');

const DonationPaymentEvent = reeditoBookshelf.Model.extend(
  {
    tableName: 'donation_payment_events',

    member() {
      return this.belongsTo('Member', 'member_id', 'id');
    },

    postAttribution() {
      return this.belongsTo('Post', 'attribution_id', 'id');
    },

    userAttribution() {
      return this.belongsTo('User', 'attribution_id', 'id');
    },

    tagAttribution() {
      return this.belongsTo('Tag', 'attribution_id', 'id');
    },
  },
  {
    async edit() {
      throw new errors.IncorrectUsageError({ message: 'Cannot edit DonationPaymentEvent' });
    },

    async destroy() {
      throw new errors.IncorrectUsageError({ message: 'Cannot destroy DonationPaymentEvent' });
    },
  },
);

module.exports = {
  DonationPaymentEvent: reeditoBookshelf.model('DonationPaymentEvent', DonationPaymentEvent),
};
