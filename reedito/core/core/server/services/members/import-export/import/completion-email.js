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
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = buildImportEmail;
const csv_1 = require("../csv");
const email_template_1 = __importStar(require("./email-template"));
const csv_2 = require("@reedito/metafield-types/csv");
// Turn an ORM validation error into copy a member manager can act on. Presentation
// only: the API response keeps the raw messages, and just the emailed report is
// rewritten. Takes one reason at a time, so a rewrite matching to the end of its input
// cannot consume the reason after it.
function humaniseReason(message) {
    return message
        .replace('Value in [members.email] cannot be blank.', 'Missing email address')
        .replace('Value in [members.note] exceeds maximum length of 2000 characters.', '"Note" exceeds maximum length of 2000 characters')
        .replace('Value in [members.subscribed] must be one of true, false, 0 or 1.', 'Value in "Subscribed to emails" must be "true" or "false"')
        .replace('Validation (isEmail) failed for email', 'Invalid email address')
        .replace(/No such customer:[\s\S]*/, 'Could not find Stripe customer');
}
function humaniseError(row) {
    return row.errors.map(humaniseReason).join('\n');
}
function stringifyLabels(labels) {
    return labels.map((label) => (typeof label === 'string' ? label : label.name)).join(',');
}
function metafieldCells(row) {
    return Object.fromEntries(Object.entries(row).filter(([column]) => (0, csv_2.isMetafieldColumn)(column)));
}
// Shape a failed import row into its fixed error-report cells, with the raw ORM message
// rewritten into copy the member manager can act on. Metafield cells are merged on by
// buildErrorReport, which owns the dynamic column set.
function toErrorReportRow(row) {
    return {
        id: row.id,
        email: row.email,
        name: row.name,
        note: row.note,
        subscribed_to_emails: row.subscribed,
        complimentary_plan: row.complimentary_plan,
        stripe_customer_id: row.stripe_customer_id,
        created_at: row.created_at,
        deleted_at: undefined,
        labels: stringifyLabels(row.labels),
        tiers: '',
        gift_id: row.gift_id || null,
        error: humaniseError(row),
    };
}
// The error report attached to the completion email: the failed rows as CSV, called only
// when there are rows to list. It shares the serialiser with the export but not the
// shaping -- the export writes db members, this echoes submitted rows. Member columns
// come from the shaper's keys, so the type stays the single source.
function buildErrorReport(errors) {
    const memberColumns = Object.keys(toErrorReportRow(errors[0])).filter((column) => column !== 'error');
    const customColumns = [...new Set(errors.flatMap((row) => Object.keys(metafieldCells(row))))];
    const columns = [...memberColumns, ...customColumns, 'error'];
    const rows = errors.map((row) => ({ ...toErrorReportRow(row), ...metafieldCells(row) }));
    return (0, csv_1.serialize)(rows, { columns });
}
// The one email an import sends, whatever became of it. What the publisher is told and
// what is attached both follow from the result: no result means nothing was written, so
// there is nothing in their file to fix and an attached CSV would say there was, and no
// failed rows means there is nothing for a report to list.
function buildImportEmail({ result, recipient, labelName, links, }) {
    const summary = !result
        ? 'did-not-run'
        : result.imported > 0
            ? 'added'
            : 'all-failed';
    return {
        to: recipient,
        subject: email_template_1.headingFor[summary],
        html: (0, email_template_1.default)({
            summary,
            imported: result?.imported ?? 0,
            errorCount: result?.errors.length ?? 0,
            siteUrl: links.siteUrl(),
            membersUrl: links.membersUrl(result?.importLabel?.slug),
            emailRecipient: recipient,
        }),
        forceTextContent: true,
        attachments: result?.errors.length
            ? [
                {
                    filename: `${labelName} - Errors.csv`,
                    content: buildErrorReport(result.errors),
                    contentType: 'text/csv',
                    contentDisposition: 'attachment',
                },
            ]
            : [],
    };
}
