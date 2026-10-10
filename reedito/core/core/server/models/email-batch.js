const reeditoBookshelf = require('./base');

const EmailBatch = reeditoBookshelf.Model.extend(
  {
    tableName: 'email_batches',

    defaults() {
      return {
        status: 'pending',
        fallback_sending_domain: false,
      };
    },

    email() {
      return this.belongsTo('Email', 'email_id');
    },
    recipients() {
      return this.hasMany('EmailRecipient', 'batch_id');
    },
    members() {
      return this.belongsToMany('Member', 'email_recipients', 'batch_id', 'member_id');
    },
  },
  {
    countRelations() {
      return {
        recipients(modelOrCollection) {
          modelOrCollection.query('columns', 'email_batches.*', (qb) => {
            qb.count('email_recipients.id')
              .from('email_recipients')
              .whereRaw('email_batches.id = email_recipients.batch_id')
              .as('count__recipients');
          });
        },
      };
    },
  },
);

const EmailBatches = reeditoBookshelf.Collection.extend({
  model: EmailBatch,
});

module.exports = {
  EmailBatch: reeditoBookshelf.model('EmailBatch', EmailBatch),
  EmailBatches: reeditoBookshelf.collection('EmailBatches', EmailBatches),
};
