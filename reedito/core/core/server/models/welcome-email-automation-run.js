const reeditoBookshelf = require('./base');

const WelcomeEmailAutomationRun = reeditoBookshelf.Model.extend({
  tableName: 'welcome_email_automation_runs',

  defaults() {
    return {
      stepAttempts: 0,
    };
  },

  automation() {
    return this.belongsTo('Automation', 'welcome_email_automation_id', 'id');
  },

  member() {
    return this.belongsTo('Member', 'member_id', 'id');
  },

  nextWelcomeEmailAutomatedEmail() {
    return this.belongsTo(
      'WelcomeEmailAutomatedEmail',
      'next_welcome_email_automated_email_id',
      'id',
    );
  },
});

module.exports = {
  WelcomeEmailAutomationRun: reeditoBookshelf.model(
    'WelcomeEmailAutomationRun',
    WelcomeEmailAutomationRun,
  ),
};
