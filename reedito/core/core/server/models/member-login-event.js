const errors = require('@tryghost/errors');
const reeditoBookshelf = require('./base');

const MemberLoginEvent = reeditoBookshelf.Model.extend(
  {
    tableName: 'members_login_events',

    member() {
      return this.belongsTo('Member', 'member_id', 'id');
    },
  },
  {
    async edit() {
      throw new errors.IncorrectUsageError({ message: 'Cannot edit MemberLoginEvent' });
    },

    async destroy() {
      throw new errors.IncorrectUsageError({ message: 'Cannot destroy MemberLoginEvent' });
    },
  },
);

const MemberLoginEvents = reeditoBookshelf.Collection.extend({
  model: MemberLoginEvent,
});

module.exports = {
  MemberLoginEvent: reeditoBookshelf.model('MemberLoginEvent', MemberLoginEvent),
  MemberLoginEvents: reeditoBookshelf.collection('MemberLoginEvents', MemberLoginEvents),
};
