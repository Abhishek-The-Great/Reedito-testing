const errors = require('@tryghost/errors');
const reeditoBookshelf = require('./base');

const MemberPaymentEvent = reeditoBookshelf.Model.extend(
  {
    tableName: 'members_payment_events',

    member() {
      return this.belongsTo('Member', 'member_id', 'id');
    },

    customQuery(qb, options) {
      if (options.aggregatePaymentVolume) {
        if (options.limit || options.filter) {
          throw new errors.IncorrectUsageError({
            message: 'aggregatePaymentVolume does not work when passed a filter or limit',
          });
        }
        const knex = reeditoBookshelf.knex;
        return qb
          .clear('select')
          .select(knex.raw('DATE(created_at) as date'))
          .select(knex.raw('SUM(amount) as volume_delta'))
          .select('currency')
          .groupByRaw('currency, DATE(created_at)')
          .orderByRaw('DATE(created_at)');
      }
    },
  },
  {
    permittedOptions(methodName) {
      const options = reeditoBookshelf.Model.permittedOptions.call(this, methodName);

      if (methodName === 'findAll') {
        return options.concat('aggregatePaymentVolume');
      }

      return options;
    },
    async edit() {
      throw new errors.IncorrectUsageError({ message: 'Cannot edit MemberPaymentEvent' });
    },

    async destroy() {
      throw new errors.IncorrectUsageError({ message: 'Cannot destroy MemberPaymentEvent' });
    },
  },
);

const MemberPaymentEvents = reeditoBookshelf.Collection.extend({
  model: MemberPaymentEvent,
});

module.exports = {
  MemberPaymentEvent: reeditoBookshelf.model('MemberPaymentEvent', MemberPaymentEvent),
  MemberPaymentEvents: reeditoBookshelf.collection('MemberPaymentEvents', MemberPaymentEvents),
};
