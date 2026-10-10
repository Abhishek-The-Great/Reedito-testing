const errors = require('@tryghost/errors');
const reeditoBookshelf = require('./base');

const MemberCancelEvent = reeditoBookshelf.Model.extend(
  {
    tableName: 'members_cancel_events',

    member() {
      return this.belongsTo('Member', 'member_id', 'id');
    },
  },
  {
    async edit() {
      throw new errors.IncorrectUsageError({ message: 'Cannot edit MemberCancelEvent' });
    },

    async destroy() {
      throw new errors.IncorrectUsageError({ message: 'Cannot destroy MemberCancelEvent' });
    },
  },
);

const MemberCancelEvents = reeditoBookshelf.Collection.extend({
  model: MemberCancelEvent,
});

module.exports = {
  MemberCancelEvent: reeditoBookshelf.model('MemberCancelEvent', MemberCancelEvent),
  MemberCancelEvents: reeditoBookshelf.collection('MemberCancelEvents', MemberCancelEvents),
};
