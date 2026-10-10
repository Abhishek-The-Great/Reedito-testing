const reeditoBookshelf = require('./base');
const reeditoVersion = require('@tryghost/version');

const Webhook = reeditoBookshelf.Model.extend(
  {
    tableName: 'webhooks',

    actionsCollectCRUD: true,
    actionsResourceType: 'webhook',

    defaults() {
      return {
        api_version: `v${reeditoVersion.safe}`,
        status: 'available',
      };
    },

    integration() {
      return this.belongsTo('Integration');
    },

    emitChange: function emitChange(event, options) {
      const eventToTrigger = 'webhook' + '.' + event;
      reeditoBookshelf.Model.prototype.emitChange.bind(this)(this, eventToTrigger, options);
    },

    onCreated: function onCreated(model, options) {
      const result = reeditoBookshelf.Model.prototype.onCreated.apply(this, arguments);

      model.emitChange('added', options);

      return result;
    },

    onUpdated: function onUpdated(model, options) {
      const result = reeditoBookshelf.Model.prototype.onUpdated.apply(this, arguments);

      model.emitChange('edited', options);

      return result;
    },

    onDestroyed: function onDestroyed(model, options) {
      const result = reeditoBookshelf.Model.prototype.onDestroyed.apply(this, arguments);

      model.emitChange('deleted', options);

      return result;
    },
  },
  {
    findAllByEvent: function findAllByEvent(event, unfilteredOptions) {
      const options = this.filterOptions(unfilteredOptions, 'findAll');
      const webhooksCollection = Webhooks.forge();

      return webhooksCollection.query('where', 'event', '=', event).fetch(options);
    },

    getByEventAndTarget: function getByEventAndTarget(event, targetUrl, unfilteredOptions) {
      const options = reeditoBookshelf.Model.filterOptions(unfilteredOptions, 'getByEventAndTarget');
      options.require = true;

      return Webhooks.forge()
        .fetch(options)
        .then(function then(webhooks) {
          const webhookWithEventAndTarget = webhooks.find(function findWebhook(webhook) {
            return (
              webhook.get('event').toLowerCase() === event.toLowerCase() &&
              webhook.get('target_url').toLowerCase() === targetUrl.toLowerCase()
            );
          });

          if (webhookWithEventAndTarget) {
            return webhookWithEventAndTarget;
          }
        })
        .catch(function (error) {
          if (error.message === 'NotFound' || error.message === 'EmptyResponse') {
            return Promise.resolve();
          }

          return Promise.reject(error);
        });
    },
  },
);

const Webhooks = reeditoBookshelf.Collection.extend({
  model: Webhook,
});

module.exports = {
  Webhook: reeditoBookshelf.model('Webhook', Webhook),
  Webhooks: reeditoBookshelf.collection('Webhooks', Webhooks),
};
