const errors = require('@tryghost/errors');
const reeditoBookshelf = require('./base');

const MemberStatusEvent = reeditoBookshelf.Model.extend(
  {
    tableName: 'members_status_events',

    member() {
      return this.belongsTo('Member', 'member_id', 'id');
    },

    customQuery(qb, options) {
      if (options.aggregateStatusCounts) {
        if (options.limit || options.filter) {
          throw new errors.IncorrectUsageError({
            message: 'aggregateStatusCounts does not work when passed a filter or limit',
          });
        }
        const knex = reeditoBookshelf.knex;
        return qb
          .clear('select')
          .select(knex.raw('DATE(created_at) as date'))
          .select(
            knex.raw(`SUM(
                    CASE WHEN to_status='paid' THEN 1
                    WHEN from_status='paid' THEN -1
                    ELSE 0 END
                ) as paid_delta`),
          )
          .select(
            knex.raw(`SUM(
                    CASE WHEN to_status='comped' THEN 1
                    WHEN from_status='comped' THEN -1
                    ELSE 0 END
                ) as comped_delta`),
          )
          .select(
            knex.raw(`SUM(
                    CASE WHEN to_status='free' THEN 1
                    WHEN from_status='free' THEN -1
                    ELSE 0 END
                ) as free_delta`),
          )
          .select(
            knex.raw(`SUM(
                    CASE WHEN to_status='gift' THEN 1
                    WHEN from_status='gift' THEN -1
                    ELSE 0 END
                ) as gift_delta`),
          )
          .groupByRaw('DATE(created_at)')
          .orderByRaw('DATE(created_at)');
      }
    },
  },
  {
    permittedOptions(methodName) {
      const options = reeditoBookshelf.Model.permittedOptions.call(this, methodName);

      if (methodName === 'findAll') {
        return options.concat('aggregateStatusCounts');
      }

      return options;
    },
    async edit() {
      throw new errors.IncorrectUsageError({ message: 'Cannot edit MemberStatusEvent' });
    },

    async destroy() {
      throw new errors.IncorrectUsageError({ message: 'Cannot destroy MemberStatusEvent' });
    },
  },
);

const MemberStatusEvents = reeditoBookshelf.Collection.extend({
  model: MemberStatusEvent,
});

module.exports = {
  MemberStatusEvent: reeditoBookshelf.model('MemberStatusEvent', MemberStatusEvent),
  MemberStatusEvents: reeditoBookshelf.collection('MemberStatusEvents', MemberStatusEvents),
};
