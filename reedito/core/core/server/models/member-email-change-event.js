const errors = require('@tryghost/errors');
const reeditoBookshelf = require('./base');

const MemberEmailChangeEvent = reeditoBookshelf.Model.extend(
  {
    tableName: 'members_email_change_events',

    member() {
      return this.belongsTo('Member', 'member_id', 'id');
    },
  },
  {
    async edit() {
      throw new errors.IncorrectUsageError({ message: 'Cannot edit MemberEmailChangeEvent' });
    },

    async destroy() {
      throw new errors.IncorrectUsageError({ message: 'Cannot destroy MemberEmailChangeEvent' });
    },
  },
);

const MemberEmailChangeEvents = reeditoBookshelf.Collection.extend({
  model: MemberEmailChangeEvent,
});

module.exports = {
  MemberEmailChangeEvent: reeditoBookshelf.model('MemberEmailChangeEvent', MemberEmailChangeEvent),
  MemberEmailChangeEvents: reeditoBookshelf.collection(
    'MemberEmailChangeEvents',
    MemberEmailChangeEvents,
  ),
};
