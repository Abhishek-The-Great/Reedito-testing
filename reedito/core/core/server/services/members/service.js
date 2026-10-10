const _ = require('lodash');
const MembersSSR = require('./members-ssr');
const db = require('../../data/db');
const MembersConfigProvider = require('./members-config-provider');
const { makeImporter, makeExporter } = require('./import-export');
const { resolveInlineThreshold } = require('./import-export/config');
const MembersStats = require('./stats/members-stats');
const logging = require('@tryghost/logging');
const urlUtils = require('../../../shared/url-utils').default;
const settingsCache = require('../../../shared/settings-cache');
const config = require('../../../shared/config');
const models = require('../../models');
const { ReeditoMailer } = require('../mail');
const jobsService = require('../jobs-service');
const tiersService = require('../tiers');
const giftService = require('../gifts');
const VerificationTrigger = require('../verification-trigger');
const { verificationWebhookService } = require('../verification/verification-webhook-service');
const DatabaseInfo = require('@tryghost/database-info');
const settingsHelpers = require('../settings-helpers');
const RequestIntegrityTokenProvider = require('./request-integrity-token-provider');

const reeditoMailer = new ReeditoMailer();

const membersConfig = new MembersConfigProvider({
  settingsHelpers,
  settingsCache,
  urlUtils,
});

const membersStats = new MembersStats({
  db: db,
  settingsCache: settingsCache,
  isSQLite: DatabaseInfo.isSQLite(db.knex),
});

let membersApi;
let verificationTrigger;

const buildImporterDeps = ({ stripeAPIService }) => {
  // Required here, not statically: boot builds the metafields services before this
  // one (the exporter below relies on the same).
  const metafields = require('../members-metafields');
  return {
    getTimezone: () => settingsCache.get('timezone'),
    // A getter rather than a value because the threshold is an operator
    // setting that can change between requests
    getInlineThreshold: () =>
      resolveInlineThreshold(config.get('members:importer:inlineThreshold')),
    getMembersRepository: async () => {
      const api = await module.exports.api;
      return api.members;
    },
    getDefaultTier: () => {
      return tiersService.api.readDefaultTier();
    },
    getTierByName: async (name) => {
      const tiers = await tiersService.api.browse({
        filter: {
          name,
        },
      });

      if (tiers.data.length > 0) {
        // It is possible that there are multiple tiers with the same name so return the last one in the array -
        // `tiersService.api.browse` returns all tiers, but without any ordering applied, so we assume that
        // the last one in the array is the most recently created
        return tiers.data.pop();
      }

      return null;
    },
    getGiftService: () => giftService.service,
    sendEmail: reeditoMailer.send.bind(reeditoMailer),
    // Resolved per dispatch rather than here: init() also runs where nothing has
    // initialised the jobs service.
    dispatchJob: (job) => jobsService.getInstance().dispatch(job),
    knex: db.knex,
    urlFor: urlUtils.urlFor.bind(urlUtils),
    stripeAPIService,
    productRepository: membersApi.productRepository,
    metafields: {
      definitions: metafields.definitions,
      values: metafields.values,
    },
  };
};

const initVerificationTrigger = () => {
  return new VerificationTrigger({
    getApiTriggerThreshold: () =>
      _.get(config.get('hostSettings'), 'emailVerification.apiThreshold'),
    getAdminTriggerThreshold: () =>
      _.get(config.get('hostSettings'), 'emailVerification.adminThreshold'),
    getImportTriggerThreshold: () =>
      _.get(config.get('hostSettings'), 'emailVerification.importThreshold'),
    isVerified: () => config.get('hostSettings:emailVerification:verified') === true,
    isVerificationRequired: () => settingsCache.get('email_verification_required') === true,
    setVerificationRequired: (value) => settingsCache.set('email_verification_required', { value }),
    sendVerificationWebhook: verificationWebhookService.sendVerificationWebhook.bind(
      verificationWebhookService,
    ),
    membersStats,
    Settings: models.Settings,
    eventRepository: membersApi.events,
  });
};

module.exports = {
  async init() {
    const stripeService = require('../stripe');
    const createMembersApiInstance = require('./api');

    if (!membersApi) {
      membersApi = createMembersApiInstance(membersConfig);

      membersApi.bus.on('error', function (err) {
        logging.error(err);
      });
    }

    module.exports.requestIntegrityTokenProvider = new RequestIntegrityTokenProvider({
      themeSecret: settingsCache.get('theme_session_secret'),
      tokenDuration: 1000 * 60 * 5,
    });

    module.exports.ssr = MembersSSR({
      cookieSecure: urlUtils.isSSL(urlUtils.getSiteUrl()),
      cookieKeys: [settingsCache.get('theme_session_secret')],
      cookieName: 'reedito-members-ssr',
      cookiePath: urlUtils.getSubdir() || '/',
      getMembersApi: () => module.exports.api,
    });

    if (!verificationTrigger) {
      verificationTrigger = initVerificationTrigger();
    }
    module.exports.verificationTrigger = verificationTrigger;

    const importerDeps = buildImporterDeps({ stripeAPIService: stripeService.api });
    const membersCSVImporter = makeImporter(importerDeps);
    // The importer takes plain arguments and returns the domain outcome; callers build
    // the request and shape the response. importCSV decides inline vs deferred by load
    // (the endpoint); importInline always runs now (the Revue data import). This only
    // supplies the verification trigger, a members-service internal.
    module.exports.importCSV = (request) =>
      membersCSVImporter.importCSV(request, verificationTrigger);
    module.exports.importInline = (request) =>
      membersCSVImporter.importInline(request, verificationTrigger);
    // The members-import job handler, registered by boot with the jobs service.
    module.exports.handleImportJob = (job) => membersCSVImporter.handle(job, verificationTrigger);

    // Constructed here rather than required statically: the exporter needs the
    // metafields services, which boot builds before this one.
    const metafields = require('../members-metafields');
    module.exports.export = makeExporter({
      definitions: metafields.definitions,
      values: metafields.values,
    });

  },
  contentGating: require('./content-gating'),

  // Create an "all active paid tiers" member shim for rendering gated content
  // without a logged-in member (post previews, gift-links reader path).
  createPaidMemberShim: require('./create-paid-member-shim').createPaidMemberShim,

  config: membersConfig,

  get api() {
    return membersApi;
  },

  ssr: null,
  verificationTrigger: null,

  requestIntegrityTokenProvider: null,

  importCSV: null,
  importInline: null,
  handleImportJob: null,

  stats: membersStats,
  export: null,
};

module.exports.middleware = require('./middleware');
