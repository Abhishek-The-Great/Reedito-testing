const reeditoBookshelf = require('./base');

const EmailRecipientFailure = reeditoBookshelf.Model.extend(
  {
    tableName: 'email_recipient_failures',
    hasTimestamps: false,

    defaults() {
      return {};
    },

    email() {
      return this.belongsTo('Email', 'email_id');
    },

    member() {
      return this.belongsTo('Member', 'member_id');
    },

    emailRecipient() {
      return this.belongsTo('EmailRecipient', 'email_recipient_id');
    },
  },
  {},
);

module.exports = {
  EmailRecipientFailure: reeditoBookshelf.model('EmailRecipientFailure', EmailRecipientFailure),
};
