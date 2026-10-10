const errors = require('@tryghost/errors');
const reeditoBookshelf = require('./base');

const MemberFeedback = reeditoBookshelf.Model.extend(
  {
    tableName: 'members_feedback',

    post() {
      return this.belongsTo('Post', 'post_id', 'id');
    },

    member() {
      return this.belongsTo('Member', 'member_id', 'id');
    },
  },
  {
    async destroy() {
      throw new errors.IncorrectUsageError({ message: 'Cannot destroy MemberFeedback' });
    },
  },
);

module.exports = {
  MemberFeedback: reeditoBookshelf.model('MemberFeedback', MemberFeedback),
};
