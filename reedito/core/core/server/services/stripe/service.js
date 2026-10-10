const _ = require('lodash');
const StripeService = require('./stripe-service');
const membersService = require('../members');
const settings = require('../../../shared/settings-cache');
const models = require('../../models');
const donationService = require('../donations');
const giftService = require('../gifts');
const staffService = require('../staff');
const labs = require('../../../shared/labs');
const settingsCache = require('../../../shared/settings-cache');

module.exports = new StripeService({
  labs,
  membersService,
  models: _.pick(models, [
    'Product',
    'StripePrice',
    'StripeCustomerSubscription',
    'StripeProduct',
    'MemberStripeCustomer',
    'Offer',
    'Settings',
  ]),
  StripeWebhook: {
    async get() {
      return {
        webhook_id: settings.get('members_stripe_webhook_id'),
        secret: settings.get('members_stripe_webhook_secret'),
      };
    },
    async save(data) {
      await models.Settings.edit([
        {
          key: 'members_stripe_webhook_id',
          value: data.webhook_id,
        },
        {
          key: 'members_stripe_webhook_secret',
          value: data.secret,
        },
      ]);
    },
  },
  donationService,
  giftService,
  staffService,
  settingsCache,
});

module.exports.init = async function init() {
  // Keep the service shell for reading legacy subscription records, but never
  // configure a provider client from stored keys or register remote webhooks.
  module.exports.api.configure(null);
};
