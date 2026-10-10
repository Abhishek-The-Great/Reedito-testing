"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const moment_timezone_1 = __importDefault(require("moment-timezone"));
const post_data_1 = __importStar(require("./post-data"));
const media_1 = require("./media");
const content_csv_import_job_1 = __importDefault(require("../jobs/content-csv-import-job"));
const errors = require('@tryghost/errors');
const logging = require('@tryghost/logging');
const tpl = require('@tryghost/tpl');
const messages = {
    unreadableFile: 'The file could not be parsed as a CSV file.',
    tooManyPosts: 'This file contains more than {max} posts. Imports are temporarily limited to {max} posts at a time — please split the file into smaller files and try again.',
    allWritesFailed: 'Content import failed to write all {count} attempted {postNoun}.',
    urlResolutionFailed: 'Content import could not resolve a URL for {count} imported {postNoun}.',
};
function logLifecycle(message) {
    try {
        logging.info(`[Background Job] ${content_csv_import_job_1.default.type} ${message}`);
    }
    catch {
        // Observability must not change whether an import is queued or resolves.
    }
}
const MAX_POSTS = 100;
// Two batch tags for every imported post: a date stamp matching the JSON
// importer's (api/endpoints/db.js), and a run tag unique to this import, which
// the report milestones key on.
function buildImportTagNames(runId, timezone, now) {
    return [`#Import ${(0, moment_timezone_1.default)(now).tz(timezone).format('YYYY-MM-DD HH:mm')}`, `#Import Run ${runId}`];
}
class ContentCSVImporter {
    _readRows;
    _prepareSource;
    _posts;
    _getHtmlToLexical;
    _getMarkdownToHtml;
    _getCleanHTML;
    _createMediaInliner;
    _email;
    _dispatchJob;
    _fileStager;
    _report;
    _store;
    _urlForPost;
    _newRunId;
    _getTimezone;
    _now;
    constructor({ readRows, prepareSource = async ({ filePath }) => ({ filePath, cleanup: async () => { } }), posts, getHtmlToLexical, getMarkdownToHtml, getCleanHTML, createMediaInliner, email, dispatchJob, fileStager, report, store, urlForPost, newRunId, getTimezone, now = () => new Date(), }) {
        this._readRows = readRows;
        this._prepareSource = prepareSource;
        this._posts = posts;
        this._getHtmlToLexical = getHtmlToLexical;
        this._getMarkdownToHtml = getMarkdownToHtml;
        this._getCleanHTML = getCleanHTML;
        this._createMediaInliner = createMediaInliner;
        this._email = email;
        this._dispatchJob = dispatchJob;
        this._fileStager = fileStager;
        this._report = report;
        this._store = store;
        this._urlForPost = urlForPost;
        this._newRunId = newRunId;
        this._getTimezone = getTimezone;
        this._now = now;
    }
    async importCSV(request) {
        const emailRecipient = request.requestUserEmail ?? (await this._email.getDefaultRecipient());
        let stagedFile;
        try {
            stagedFile = await this._fileStager.stage(request);
        }
        catch (error) {
            throw new errors.ValidationError({
                message: tpl(messages.unreadableFile),
                err: error,
            });
        }
        let handedOff = false;
        try {
            const stagedRequest = {
                filePath: stagedFile.path,
                fileName: stagedFile.name,
                mapping: request.mapping,
                requestUserEmail: request.requestUserEmail,
            };
            const { source, preparedRows } = await this.readPreparedRows(stagedRequest);
            await this.cleanupSource(source.cleanup);
            this.assertWithinPostLimit(preparedRows.rows);
            const runId = this._newRunId();
            const importTagNames = buildImportTagNames(runId, this._getTimezone(), this._now());
            this._store.create(runId, preparedRows.rows.length, preparedRows.columns);
            const job = new content_csv_import_job_1.default({
                importId: runId,
                file: stagedFile,
                mapping: request.mapping,
                importTagNames,
                emailRecipient,
            });
            logLifecycle('queued');
            try {
                await this._dispatchJob(job);
            }
            catch (error) {
                this._store.fail(runId, messageOf(error));
                this._store.release(runId);
                throw error;
            }
            handedOff = true;
            return { importId: runId, total: preparedRows.rows.length };
        }
        finally {
            if (!handedOff) {
                await this.cleanupStagedFile(stagedFile);
            }
        }
    }
    async handle(job) {
        let source;
        try {
            const prepared = await this.readPreparedRows({
                filePath: job.file.path,
                fileName: job.file.name,
                mapping: job.mapping,
            });
            source = prepared.source;
            this.assertWithinPostLimit(prepared.preparedRows.rows);
            await this.processRows(job.importId, job.importTagNames, prepared.preparedRows.rows, prepared.source);
        }
        catch (error) {
            this._store.fail(job.importId, messageOf(error));
            throw error;
        }
        finally {
            if (source) {
                await this.cleanupSource(source.cleanup);
            }
            const run = this._store.get(job.importId);
            if (run) {
                await this.settle(() => this._email.send(run, job.emailRecipient));
            }
            this._store.release(job.importId);
            await this.cleanupStagedFile(job.file);
        }
    }
    allSettled() {
        return this._store.allSettled();
    }
    async processRows(runId, importTagNames, rows, source) {
        let urlFailureCount = 0;
        let firstUrlFailure;
        try {
            if (source.assets) {
                await source.assets.store();
                source.assets.rewriteRows(rows.map(({ data }) => data));
            }
            const htmlToLexical = this._getHtmlToLexical();
            const markdownToHtml = this._getMarkdownToHtml();
            const cleanHTML = this._getCleanHTML();
            const media = this._createMediaInliner();
            let successfulWrites = 0;
            let failedRows = 0;
            let firstRowFailure;
            for (const preparedRow of rows) {
                const { data: row, source: sourceCells, line } = preparedRow;
                let data;
                try {
                    data = (0, post_data_1.default)(row, htmlToLexical, importTagNames, markdownToHtml, cleanHTML);
                }
                catch (error) {
                    if (error instanceof post_data_1.RowSkipped) {
                        this.recordOutcome(runId, sourceCells, {
                            line,
                            title: row.title || null,
                            status: 'failed',
                            reason: messageOf(error),
                        });
                        continue;
                    }
                    // Anything other than an expected source-row refusal is an importer
                    // failure. Stop the run before misclassifying it as a lost write.
                    throw error;
                }
                try {
                    await media.inline(data);
                }
                catch (error) {
                    if (error instanceof media_1.MediaInliningFailure) {
                        if (failedRows === 0) {
                            firstRowFailure = error;
                        }
                        failedRows += 1;
                        this.recordOutcome(runId, sourceCells, {
                            line,
                            title: row.title,
                            status: 'failed',
                            reason: messageOf(error),
                            mediaFailures: error.failures,
                        });
                        continue;
                    }
                    throw error;
                }
                let post;
                let writeStatus;
                let warnings;
                try {
                    // options.importing preserves the supplied timestamps and keeps the import silent:
                    // the webhook, Slack, IndexNow and mention consumers all stand down on it, and a
                    // newsletter can only be attached in the API layer (post-scheduling does not check
                    // it, one reason status is never 'scheduled'). Pinned by
                    // test/e2e-webhooks/posts-importer.test.js. A fresh options object per row: the
                    // model layer mutates it.
                    const result = await this._posts.write(data, {
                        importing: true,
                        context: { internal: true },
                    }, {
                        sourceUpdatedAt: row.updated_at,
                        runTagName: importTagNames[1],
                        authorNames: row.authors,
                        authorEmails: row.author_emails,
                        tagNames: row.tags,
                    });
                    if (result.status === 'skipped') {
                        this.recordOutcome(runId, sourceCells, {
                            line,
                            title: row.title,
                            status: 'skipped',
                            reason: result.reason,
                            duplicate: result.duplicate,
                        });
                        continue;
                    }
                    post = result.post;
                    writeStatus = result.status;
                    warnings = result.warnings;
                    successfulWrites += 1;
                }
                catch (error) {
                    if (failedRows === 0) {
                        firstRowFailure = error;
                    }
                    failedRows += 1;
                    this.recordOutcome(runId, sourceCells, {
                        line,
                        title: row.title,
                        status: 'failed',
                        reason: messageOf(error),
                    });
                    continue;
                }
                const outcome = {
                    line,
                    title: row.title,
                    status: writeStatus,
                    postId: post.id,
                    postType: data.type,
                    ...(warnings.length > 0 ? { warnings } : {}),
                };
                try {
                    outcome.url = this._urlForPost(post);
                }
                catch (error) {
                    if (urlFailureCount === 0) {
                        firstUrlFailure = error;
                    }
                    urlFailureCount += 1;
                }
                this.recordOutcome(runId, sourceCells, outcome);
            }
            if (failedRows > 0 && successfulWrites === 0) {
                this._report(new errors.InternalServerError({
                    message: tpl(messages.allWritesFailed, {
                        count: failedRows,
                        postNoun: failedRows === 1 ? 'post' : 'posts',
                    }),
                    err: firstRowFailure,
                }));
            }
            this.reportUrlFailures(urlFailureCount, firstUrlFailure);
            this._store.finish(runId);
        }
        catch (error) {
            this.reportUrlFailures(urlFailureCount, firstUrlFailure);
            throw error;
        }
    }
    async readPreparedRows(request) {
        const source = await this._prepareSource(request);
        try {
            const result = await this._readRows(source.filePath, request.mapping);
            const preparedRows = Array.isArray(result)
                ? { columns: [], rows: result.map((data, index) => ({ data, line: index + 2 })) }
                : result;
            return { source, preparedRows };
        }
        catch (error) {
            await this.cleanupSource(source.cleanup);
            throw new errors.ValidationError({
                message: tpl(messages.unreadableFile),
                err: error,
            });
        }
    }
    assertWithinPostLimit(rows) {
        // Temporary while import state is held in memory: M8 removes the cap.
        if (rows.length > MAX_POSTS) {
            throw new errors.ValidationError({
                message: tpl(messages.tooManyPosts, { max: MAX_POSTS }),
            });
        }
    }
    recordOutcome(runId, source, outcome) {
        this._store.record(runId, source ? { ...outcome, source } : outcome);
    }
    reportUrlFailures(count, firstFailure) {
        if (count > 0) {
            this._report(new errors.InternalServerError({
                message: tpl(messages.urlResolutionFailed, {
                    count,
                    postNoun: count === 1 ? 'post' : 'posts',
                }),
                err: firstFailure,
            }));
        }
    }
    async cleanupSource(cleanup) {
        try {
            await cleanup();
        }
        catch (error) {
            this._report(error);
        }
    }
    async cleanupStagedFile(file) {
        try {
            await this._fileStager.remove(file);
        }
        catch (error) {
            this._report(error);
        }
    }
    async settle(operation) {
        try {
            await operation();
        }
        catch (error) {
            this._report(error);
        }
    }
}
function messageOf(error) {
    if (error &&
        typeof error === 'object' &&
        'message' in error &&
        typeof error.message === 'string' &&
        error.message) {
        return error.message;
    }
    return 'Unknown error';
}
exports.default = ContentCSVImporter;
