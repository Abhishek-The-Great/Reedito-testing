"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeImporter = makeImporter;
exports.makeExporter = makeExporter;
const members_metafields_1 = require("../../members-metafields");
const importer_1 = __importDefault(require("./import/importer"));
const reader_1 = __importDefault(require("./import/reader"));
const spool_1 = require("./import/spool");
const exporter_1 = __importDefault(require("./export/exporter"));
const MembersCSVImporterStripeUtils = require('./import/stripe-utils');
const db = require('../../../data/db');
const models = require('../../../models');
const logging = require('@tryghost/logging');
const sentry = require('../../../../shared/sentry');
// Build the members CSV importer. This is the composition root: today's models and
// services are wired behind the collaborators the importer declares, one per
// concern, so nothing Bookshelf-shaped leaks into the import service itself.
function makeImporter(deps) {
    // The members repository resolves asynchronously and is stable once ready, so
    // cache the promise and reuse it across every call the import makes.
    let membersRepositoryPromise;
    const getMembersRepository = () => (membersRepositoryPromise ??= deps.getMembersRepository());
    // The members aggregate, plus the import label lookup folded in so the label
    // (member-tagging data) does not need a source of its own.
    const members = {
        get: async (query, options) => (await getMembersRepository()).get(query, options),
        create: async (values, options) => (await getMembersRepository()).create(values, options),
        update: async (values, options) => (await getMembersRepository()).update(values, options),
        getCustomerIdByEmail: async (email) => (await getMembersRepository()).getCustomerIdByEmail(email),
        linkStripeCustomer: async (link, options) => (await getMembersRepository()).linkStripeCustomer(link, options),
        getImportLabel: (name) => models.Label.findOne({ name }),
    };
    // The completion email: its recipient, links and delivery in one collaborator.
    const email = {
        send: deps.sendEmail,
        getDefaultRecipient: async () => (await models.User.getOwnerUser()).get('email'),
        links: {
            siteUrl: () => new URL(deps.urlFor('home', null, true)),
            membersUrl: (labelSlug) => {
                const url = new URL('members', deps.urlFor('admin', null, true));
                if (labelSlug) {
                    url.searchParams.set('label', labelSlug);
                }
                return url;
            },
        },
    };
    // Gifts is initialised at boot and always present at request time; the getter
    // resolves it lazily so the ready service is picked up whenever a row uses it.
    const gifts = {
        reassignRedeemer: (giftId, memberId, options) => deps.getGiftService().reassignRedeemer({
            giftId,
            memberId,
            transacting: options.transacting,
        }),
    };
    const metafields = {
        activeFields: async () => deps.metafields.definitions.browse({}, members_metafields_1.INTERNAL),
        planWrite: (values) => deps.metafields.values.planWrite(values, members_metafields_1.INTERNAL),
        // Every value the import writes came out of the file, whichever column carried it.
        // An import has no id to give until runs are tracked, so it names its kind only.
        applyWrite: (memberId, plan, executor) => deps.metafields.values.applyWrite(memberId, plan, {
            writtenBy: { type: 'import', id: null },
            source: 'import',
            executor,
        }),
    };
    // The import job never rejects, so the jobs service never sees its failures, and the
    // inline path's bookkeeping failures never reach the request: a throw here would be
    // seen by nobody.
    const report = (error) => {
        try {
            logging.error({ event: { name: 'members.import.error' }, err: error }, '[Background Job] members-import error');
            sentry.captureException(error);
        }
        catch {
            // Callers report from catch and finally blocks, so this must not throw.
        }
    };
    return new importer_1.default({
        knex: deps.knex,
        readRows: reader_1.default,
        spool: (0, spool_1.createRowSpool)(require('../../adapter-manager').default.getAdapter('storage:imports')),
        members,
        tiers: {
            getDefault: deps.getDefaultTier,
            getByName: deps.getTierByName,
        },
        stripe: new MembersCSVImporterStripeUtils({
            stripeAPIService: deps.stripeAPIService,
            productRepository: deps.productRepository,
        }),
        gifts,
        metafields,
        email,
        report,
        dispatchJob: deps.dispatchJob,
        getTimezone: deps.getTimezone,
        getInlineThreshold: deps.getInlineThreshold,
    });
}
// Build the members CSV exporter. The same composition root from the other direction:
// knex and the members id lookup are wired here, and the metafields definitions and
// values services are injected (boot builds them before this one).
function makeExporter({ definitions, values, }) {
    const exporter = new exporter_1.default({
        knex: db.knex,
        members: {
            // Minimal query, only to fetch the ids of the filtered members; the stream
            // reads their related data itself.
            findFilteredIds: async (options) => {
                const page = await models.Member.findPage({
                    ...options,
                    withRelated: [],
                    columns: ['id'],
                    limit: 'all',
                });
                return page.data.map((member) => member.id);
            },
        },
        metafields: {
            // Boot builds the definitions and values services before this one, so they
            // are always present -- no not-initialised state to guard.
            activeDefinitions: async () => definitions.browse({}, members_metafields_1.INTERNAL),
            valuesForMembers: (memberIds) => values.getValuesForMembers(memberIds, members_metafields_1.INTERNAL),
        },
    });
    return (options = {}) => exporter.export(options);
}
