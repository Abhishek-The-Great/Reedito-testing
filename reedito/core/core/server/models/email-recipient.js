const reeditoBookshelf = require('./base');

const EmailRecipient = reeditoBookshelf.Model.extend({
  tableName: 'email_recipients',
  hasTimestamps: false,

  filterRelations: function filterRelations() {
    return {
      email: {
        // Mongo-knex doesn't support belongsTo relations
        tableName: 'emails',
        tableNameAs: 'email',
        type: 'manyToMany',
        joinTable: 'email_recipients',
        joinFrom: 'id',
        joinTo: 'email_id',
      },
    };
  },

  email() {
    return this.belongsTo('Email', 'email_id');
  },
  emailBatch() {
    return this.belongsTo('EmailBatch', 'batch_id');
  },
  member() {
    return this.belongsTo('Member', 'member_id');
  },
});

const EmailRecipients = reeditoBookshelf.Collection.extend({
  model: EmailRecipient,
});

module.exports = {
  EmailRecipient: reeditoBookshelf.model('EmailRecipient', EmailRecipient),
  EmailRecipients: reeditoBookshelf.collection('EmailRecipients', EmailRecipients),
};
