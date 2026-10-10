"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const moment_timezone_1 = __importDefault(require("moment-timezone"));
const completion_email_1 = __importDefault(require("./completion-email"));
const csv_1 = require("../csv");
const csv_2 = require("@reedito/metafield-types/csv");
const members_import_job_1 = __importDefault(require("../../jobs/members-import-job"));
const metrics = require('@tryghost/metrics');
const errors = require('@tryghost/errors');
const logging = require('@tryghost/logging');
const tpl = require('@tryghost/tpl');
const messages = {
    freeMemberNotAllowedImportTier: 'You cannot import a free member with a specified tier.',
    invalidImportTier: '"{tier}" is not a valid tier.',
    giftCannotCombineWithImportTier: 'Cannot specify both gift_id and import_tier.',
    giftCannotCombineWithComplimentary: 'Cannot specify both gift_id and complimentary_plan.',
    giftReassignFailed: 'Failed to reassign gift to member.',
    metafieldWriteFailed: 'Failed to save the custom field values for this member.',
};
// Columns whose presence makes a row slow to import (they reach out to Stripe), so
// a file carrying any of them is deferred regardless of size. The routing decision
// only ever sees the boolean this produces, never the column names themselves.
const EXPENSIVE_COLUMNS = ['stripe_customer_id'];
// The context each repository call runs under: the import identifies itself, and a
// created member is additionally flagged as imported so downstream hooks can tell.
const IMPORT_CONTEXT = { importer: true };
const CREATE_CONTEXT = { import: true };
// The import label members are tagged with, named for the request time. Shared by
// the kernel (the label) and the deferred email (the error CSV filename).
function buildImportLabelName(timezone) {
    return `Import ${(0, moment_timezone_1.default)().tz(timezone).format('YYYY-MM-DD HH:mm')}`;
}
function hasExpensiveColumns(rows) {
    return rows.some((row) => EXPENSIVE_COLUMNS.some((column) => !!row[column]));
}
// The routing decision, in terms it can reason about without knowing what a member
// or a Stripe customer is: an empty or small, cheap file imports inline (an empty
// one simply imports nothing); a large one, or one carrying expensive columns, is
// too slow to hold a request open, so it is deferred to a background job.
function canImportInline(rowCount, expensive, inlineThreshold) {
    return rowCount <= inlineThreshold && !expensive;
}
class MembersCSVImporter {
    _knex;
    _readRows;
    _spool;
    _members;
    _tiers;
    _stripe;
    _gifts;
    _metafields;
    _email;
    _report;
    _dispatchJob;
    _getTimezone;
    _getInlineThreshold;
    constructor({ knex, readRows, spool, members, tiers, stripe, gifts, metafields, email, report, dispatchJob, getTimezone, getInlineThreshold, }) {
        this._knex = knex;
        this._readRows = readRows;
        this._spool = spool;
        this._members = members;
        this._tiers = tiers;
        this._stripe = stripe;
        this._gifts = gifts;
        this._metafields = metafields;
        this._email = email;
        this._report = report;
        this._dispatchJob = dispatchJob;
        this._getTimezone = getTimezone;
        this._getInlineThreshold = getInlineThreshold;
    }
    async importCSV(request, verificationTrigger) {
        const rows = await this._readRows(request.filePath, request.mapping);
        const labelName = buildImportLabelName(this._getTimezone());
        const extraLabels = request.extraLabels ?? [];
        if (canImportInline(rows.length, hasExpensiveColumns(rows), this._getInlineThreshold())) {
            const result = await this.importRows(rows, labelName, extraLabels, verificationTrigger);
            return { deferred: false, originalImportSize: rows.length, result };
        }
        await this.deferImport(rows, {
            labelName,
            extraLabels,
            requestUserEmail: request.requestUserEmail,
        });
        return { deferred: true, originalImportSize: rows.length };
    }
    async importInline(request, verificationTrigger) {
        const rows = await this._readRows(request.filePath, request.mapping);
        return this.importRows(rows, buildImportLabelName(this._getTimezone()), request.extraLabels ?? [], verificationTrigger);
    }
    async deferImport(rows, { labelName, extraLabels, requestUserEmail, }) {
        // Resolved here, not at the API boundary, so the owner lookup only runs when
        // a request without a user actually reaches the deferred path.
        const emailRecipient = requestUserEmail ?? (await this._email.getDefaultRecipient());
        const spoolKey = await this._spool.write(rows);
        logging.info({ event: { name: 'members.import.queued' }, rows: rows.length }, 'Members import queued');
        try {
            await this._dispatchJob(new members_import_job_1.default({ spoolKey, labelName, extraLabels, emailRecipient }));
        }
        catch (error) {
            // No job will ever read the rows, so they are not left behind for one.
            await this.settle(() => this._spool.remove(spoolKey));
            throw error;
        }
    }
    // The members-import job handler. Resolves in every case, as the legacy inline job did:
    // everything that can fail is already reported here, so a rejection would only make the
    // jobs service report it again, and there is no retry behind it.
    async handle({ spoolKey, labelName, extraLabels, emailRecipient }, verificationTrigger) {
        const startedAt = Date.now();
        logging.info({ event: { name: 'members.import.started' } }, 'Members import started');
        // Null until the import produces one: parsing and mapping already happened inside
        // the request, so anything failing from here is ours rather than the file's.
        let result = null;
        try {
            const spooledRows = await this._spool.read(spoolKey);
            result = await this.importRows(spooledRows, labelName, extraLabels, verificationTrigger);
        }
        catch (error) {
            // importRows only throws before its write loop, so nothing was written.
            this._report(error);
        }
        finally {
            await this.settle(() => this._spool.remove(spoolKey));
        }
        // Whatever became of it, the publisher hears exactly once. If this is what fails,
        // there is nobody left to tell but us.
        await this.settle(() => this._email.send((0, completion_email_1.default)({
            result,
            recipient: emailRecipient,
            labelName,
            links: this._email.links,
        })));
        if (result) {
            logging.info({
                event: { name: 'members.import.completed' },
                durationMs: Date.now() - startedAt,
                imported: result.imported,
                rejected: result.errors.length,
            }, 'Members import completed');
        }
        else {
            logging.info({ event: { name: 'members.import.failed' }, durationMs: Date.now() - startedAt }, 'Members import failed');
        }
    }
    // Only the write itself may throw. Callers rely on that to tell an import that never
    // ran from one that ran and then failed to tidy up after itself.
    async importRows(rows, labelName, extraLabels, verificationTrigger) {
        const startedAt = Date.now();
        const prepared = await this.prepareRun(labelName, extraLabels);
        const written = await this.writeRows(rows, prepared);
        const result = { imported: written.imported, errors: written.errors };
        // Bookkeeping, and the publisher's result is already in hand. Nothing below is
        // load-bearing for what they are told, so it is left to throw into one report
        // rather than each step defending itself. The label is read first because only
        // it reaches the publisher, as the link their email arrives with.
        await this.settle(async () => {
            if (written.imported > 0) {
                result.importLabel = (await this._members.getImportLabel(labelName))?.toJSON();
            }
            await metrics.metric('members-import', {
                imported: written.imported,
                errors: written.errors.length,
                value: Date.now() - startedAt,
            });
            await this.archiveStripePrices(written.archivableStripePriceIds);
            await verificationTrigger.testImportThreshold();
        });
        return result;
    }
    async prepareRun(labelName, extraLabels) {
        return {
            defaultTier: await this._tiers.getDefault(),
            // Empty when the feature is off, so a carried-through column is dropped.
            activeMetafields: await this._metafields.activeFields(),
            globalLabels: [{ name: labelName }, ...extraLabels],
        };
    }
    // Must not throw: once a row has committed, an import that failed halfway is not one
    // that never ran.
    async writeRows(rows, prepared) {
        const { defaultTier, activeMetafields } = prepared;
        const tierIdCache = new Map();
        const archivableStripePriceIds = [];
        // Copied per row: the member model stamps ids and trims names onto these in
        // place, and each row runs in its own transaction that can roll back. A
        // caller can hand in a nameless label, which the model would drop anyway.
        const cloneGlobalLabels = () => prepared.globalLabels.map((label) => ({ ...label })).filter((label) => label.name);
        let imported = 0;
        let rollbackFailures = 0;
        let firstRollbackFailure;
        const importErrors = [];
        for (const row of rows) {
            let trx;
            try {
                if (row.gift_id) {
                    if (row.import_tier) {
                        throw wrapGiftError(new errors.DataImportError({
                            message: tpl(messages.giftCannotCombineWithImportTier),
                        }));
                    }
                    if (row.complimentary_plan) {
                        throw wrapGiftError(new errors.DataImportError({
                            message: tpl(messages.giftCannotCombineWithComplimentary),
                        }));
                    }
                }
                // Validate the row's metafield values before the transaction opens.
                // planWrite only reads, and it throws on an invalid value to fail the row
                // before any member write -- so there is no reason to hold a transaction
                // across it, and doing so would deadlock the single-connection SQLite pool.
                const metafieldPlan = activeMetafields.length > 0
                    ? await namingTheColumn(() => this._metafields.planWrite((0, csv_2.fieldValuesFromCsvRow)(activeMetafields, row, csv_1.stripFormulaGuard)))
                    : [];
                trx = await this._knex.transaction(undefined, { doNotRejectOnRollback: false });
                const options = { transacting: trx, context: IMPORT_CONTEXT };
                const createdAt = row.created_at && (0, moment_timezone_1.default)(row.created_at).isAfter((0, moment_timezone_1.default)())
                    ? (0, moment_timezone_1.default)().toDate()
                    : row.created_at;
                const memberValues = {
                    email: row.email,
                    name: row.name,
                    note: row.note,
                    subscribed: row.subscribed,
                    created_at: createdAt,
                    labels: [...row.labels, ...cloneGlobalLabels()],
                };
                const existingMember = row.email
                    ? await this._members.get({ email: row.email }, { ...options, withRelated: ['labels', 'newsletters'] })
                    : null;
                let member;
                if (existingMember) {
                    const existingLabels = existingMember.related('labels').toJSON();
                    const existingNewsletters = existingMember.related('newsletters');
                    if (existingNewsletters.length > 0 && memberValues.subscribed) {
                        memberValues.newsletters = existingNewsletters.toJSON();
                    }
                    if (!existingNewsletters.length && memberValues.subscribed) {
                        memberValues.subscribed = false;
                    }
                    if (!row.name) {
                        memberValues.name = existingMember.name;
                    }
                    if (!row.note) {
                        memberValues.note = existingMember.note;
                    }
                    member = await this._members.update({
                        ...memberValues,
                        labels: existingLabels.concat(memberValues.labels),
                    }, { ...options, id: existingMember.id });
                }
                else {
                    member = await this._members.create(memberValues, Object.assign({}, options, { context: CREATE_CONTEXT }));
                }
                let importTierId;
                if (row.import_tier) {
                    if (!tierIdCache.has(row.import_tier)) {
                        const tier = await this._tiers.getByName(row.import_tier);
                        tierIdCache.set(row.import_tier, tier ? tier.id.toString() : null);
                    }
                    importTierId = tierIdCache.get(row.import_tier);
                    if (!importTierId) {
                        throw new errors.DataImportError({
                            message: tpl(messages.invalidImportTier, { tier: row.import_tier }),
                        });
                    }
                }
                if (row.stripe_customer_id) {
                    let stripeCustomerId;
                    if (row.stripe_customer_id.toLowerCase() === 'auto') {
                        stripeCustomerId = row.email
                            ? await this._members.getCustomerIdByEmail(row.email)
                            : undefined;
                    }
                    else {
                        stripeCustomerId = row.stripe_customer_id;
                    }
                    if (stripeCustomerId) {
                        if (row.import_tier) {
                            const { isNewStripePrice, stripePriceId } = await this._stripe.forceStripeSubscriptionToProduct({
                                customer_id: stripeCustomerId,
                                product_id: importTierId,
                            }, options);
                            if (isNewStripePrice) {
                                archivableStripePriceIds.push(stripePriceId);
                            }
                        }
                        await this._members.linkStripeCustomer({ customer_id: stripeCustomerId, member_id: member.id }, options);
                    }
                }
                else if (row.complimentary_plan) {
                    const products = [];
                    if (row.import_tier) {
                        products.push({ id: importTierId });
                    }
                    else {
                        products.push({ id: defaultTier.id.toString() });
                    }
                    await this._members.update({ products }, { ...options, id: member.id });
                }
                else if (row.import_tier) {
                    throw new errors.DataImportError({
                        message: tpl(messages.freeMemberNotAllowedImportTier),
                    });
                }
                if (row.gift_id) {
                    try {
                        await this._gifts.reassignRedeemer(row.gift_id, member.id, { transacting: trx });
                    }
                    catch (giftError) {
                        throw wrapGiftError(giftError);
                    }
                }
                // On the row's transaction, so the values commit or roll back with the member.
                try {
                    await this._metafields.applyWrite(member.id, metafieldPlan, trx);
                }
                catch (writeError) {
                    // planWrite passed every value before the transaction opened, so a failure
                    // here is ours and not the row's. Operators get the original, which a driver
                    // will have written a query into; the publisher gets a sentence instead, in a
                    // file they open next to a spreadsheet.
                    this._report(writeError);
                    throw new errors.DataImportError({ message: tpl(messages.metafieldWriteFailed) });
                }
                await trx.commit();
                imported += 1;
            }
            catch (error) {
                const errorList = Array.isArray(error) ? error : [error];
                const reasons = errorList
                    .map((e) => typeof e === 'object' && e !== null && 'message' in e ? e.message : undefined)
                    .filter((message) => typeof message === 'string');
                const errorMessage = reasons.join('\n');
                // trx is unset if the row failed before the transaction opened (a bad
                // metafield value or gift combination). A rejected rollback must not
                // escape: rows before this one are already committed, and a throw leaving
                // here would be read as an import that never wrote anything.
                if (trx) {
                    try {
                        await trx.rollback();
                    }
                    catch (rollbackError) {
                        firstRollbackFailure ??= rollbackError;
                        rollbackFailures += 1;
                    }
                }
                importErrors.push({ ...row, error: errorMessage, errors: reasons });
            }
        }
        if (rollbackFailures > 0) {
            this._report(new errors.InternalServerError({
                message: `Failed to roll back ${rollbackFailures} of ${rows.length} member rows`,
                err: firstRollbackFailure,
            }));
        }
        return { imported, errors: importErrors, archivableStripePriceIds };
    }
    async settle(work) {
        try {
            return await work();
        }
        catch (error) {
            this._report(error);
            return undefined;
        }
    }
    async archiveStripePrices(priceIds) {
        // allSettled so one unarchivable price neither hides the others nor stops them
        // being attempted.
        const attempts = await Promise.allSettled(priceIds.map((id) => this._stripe.archivePrice(id)));
        const failed = attempts.filter((attempt) => attempt.status === 'rejected');
        if (failed.length > 0) {
            throw new errors.InternalServerError({
                message: `Failed to archive ${failed.length} of ${attempts.length} Stripe prices created by this import`,
                err: failed[0].reason,
            });
        }
    }
}
// A row error is read next to a spreadsheet, and a value rejection states only what the
// value should be — the same sentence Admin shows under a single input, where the field is
// already on screen. `property` is the dotted path a default export writes as its column
// header, so prefixing with it names the column a publisher has to go and fix.
//
// A rejection about the whole request carries the bare namespace and names no field after
// it, so it is left alone rather than made to point at a column that does not exist.
async function namingTheColumn(plan) {
    try {
        return await plan();
    }
    catch (error) {
        const { property, message } = (error ?? {});
        const namesAField = typeof property === 'string' && property.includes('.');
        if (!namesAField || typeof message !== 'string') {
            throw error;
        }
        throw new errors.DataImportError({ message: `${property}: ${message}` });
    }
}
function wrapGiftError(error) {
    const err = error;
    const message = (err && typeof err.message === 'string' && err.message) || tpl(messages.giftReassignFailed);
    return new errors.DataImportError({
        message: `Member cannot be assigned to a gift: ${message}`,
    });
}
exports.default = MembersCSVImporter;
