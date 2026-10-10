const reeditoBookshelf = require('./base');

const AutomatedEmailRecipient = reeditoBookshelf.Model.extend({
  tableName: 'automated_email_recipients',
  hasTimestamps: true,

  automatedEmail() {
    return this.belongsTo('WelcomeEmailAutomatedEmail', 'automated_email_id');
  },
  member() {
    return this.belongsTo('Member', 'member_id');
  },
});

const AutomatedEmailRecipients = reeditoBookshelf.Collection.extend({
  model: AutomatedEmailRecipient,
});

module.exports = {
  AutomatedEmailRecipient: reeditoBookshelf.model('AutomatedEmailRecipient', AutomatedEmailRecipient),
  AutomatedEmailRecipients: reeditoBookshelf.collection(
    'AutomatedEmailRecipients',
    AutomatedEmailRecipients,
  ),
};
