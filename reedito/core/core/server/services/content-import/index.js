"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.init = init;
exports.importCSV = importCSV;
exports.handleJob = handleJob;
exports.allSettled = allSettled;
const zod_1 = require("zod");
const importer_1 = __importDefault(require("./import/importer"));
const completion_email_1 = __importDefault(require("./import/completion-email"));
const post_repository_1 = require("./import/post-repository");
const reader_1 = __importDefault(require("./import/reader"));
const schema_1 = require("./import/schema");
const store_1 = require("./import/store");
const source_1 = require("./import/source");
const media_1 = require("./import/media");
const local_media_url_1 = require("./import/local-media-url");
const post_link_1 = require("./import/post-link");
const staged_file_1 = require("./import/staged-file");
const jobs_service_1 = require("../jobs-service");
// The request is built from HTTP upload metadata, so it is validated at the
// service boundary rather than trusted.
// A junk timezone setting falls back to UTC rather than mis-stamping the batch tag.
const timezoneSchema = zod_1.z.string().min(1).catch('Etc/UTC');
const errors = require('@tryghost/errors');
const logging = require('@tryghost/logging');
const sentry = require('../../../shared/sentry');
// Composition root: models and services are wired behind the collaborators the
// importer declares.
function makeImporter() {
    // Required lazily: boot initialises this service before the model and job layers
    // are guaranteed loaded.
    const models = require('../../models');
    const lexicalLib = require('../../lib/lexical');
    const settingsCache = require('../../../shared/settings-cache');
    const urlService = require('../url');
    const urlUtils = require('../../../shared/url-utils').default;
    const mediaInlinerService = require('../media-inliner');
    const config = require('../../../shared/config');
    const ObjectID = require('bson-objectid').default;
    const { ReeditoMailer } = require('../mail');
    const reeditoMailer = new ReeditoMailer();
    // Row aggregates and best-effort cleanup are intentionally reported without
    // failing a run. Fatal handler errors are reported by the class-based jobs service.
    const report = (error) => {
        try {
            logging.error({ event: { name: 'content.import.error' }, err: error }, '[Background Job] content-import error');
            sentry.captureException(error);
        }
        catch {
            // Callers report from catch blocks, so this must not throw.
        }
    };
    const email = {
        send: (run, recipient) => reeditoMailer.send((0, completion_email_1.default)(run, recipient, urlUtils.urlFor('admin', true))),
        getDefaultRecipient: async () => (await models.User.getOwnerUser()).get('email'),
    };
    return new importer_1.default({
        readRows: reader_1.default,
        prepareSource: source_1.prepareImportSource,
        posts: new post_repository_1.BookshelfPostsRepository(models),
        getHtmlToLexical: () => lexicalLib.htmlToLexicalConverter,
        getMarkdownToHtml: () => require('@reedito/kg-markdown-html-renderer').render,
        getCleanHTML: () => require('@tryghost/mg-clean-html').cleanHTML,
        createMediaInliner: () => new media_1.PostMediaInliner({
            media: mediaInlinerService.getInstance(),
            isLocalMediaUrl: (sourceUrl) => (0, local_media_url_1.isLocalMediaUrl)(sourceUrl, {
                siteUrl: config.getSiteUrl(),
                subdir: config.getSubdir(),
                assetBaseUrls: [
                    config.get('urls:image'),
                    config.get('urls:media'),
                    config.get('urls:files'),
                ],
            }),
        }),
        email,
        dispatchJob: (job) => (0, jobs_service_1.getInstance)().dispatch(job),
        fileStager: (0, staged_file_1.createImportFileStager)(() => require('../adapter-manager').default.getAdapter('storage:imports')),
        report,
        store: new store_1.ImportRunStore(),
        urlForPost: (post) => (0, post_link_1.urlForImportedPost)(post, {
            adminUrl: urlUtils.urlFor('admin', true),
            publishedUrl: (publishedPost) => urlService.getUrlForResource({ ...publishedPost.toJSON(), type: 'posts' }, { absolute: true }),
        }),
        newRunId: () => new ObjectID().toHexString(),
        getTimezone: () => timezoneSchema.parse(settingsCache.get('timezone')),
    });
}
let importer;
// Idempotent because tests may boot more than once per process.
function init() {
    importer ??= makeImporter();
}
function importCSV(request) {
    if (!importer) {
        throw new errors.InternalServerError({ message: 'Content import service used before init' });
    }
    const parsedRequest = schema_1.importRequestSchema.safeParse(request);
    if (!parsedRequest.success) {
        throw new errors.ValidationError({
            message: parsedRequest.error.issues[0]?.message ?? 'Invalid content import request',
            err: parsedRequest.error,
        });
    }
    return importer.importCSV(parsedRequest.data);
}
function handleJob(job) {
    if (!importer) {
        throw new errors.InternalServerError({ message: 'Content import service used before init' });
    }
    return importer.handle(job);
}
// Test-facing parity with the legacy inline queue while the import run store
// remains in memory. M8 removes this together with that store.
function allSettled() {
    if (!importer) {
        return Promise.resolve();
    }
    return importer.allSettled();
}
