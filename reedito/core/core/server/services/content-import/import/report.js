"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = buildImportReport;
const csv_1 = require("../csv");
const REPORT_COLUMNS = [
    'line',
    'title',
    'outcome',
    'reason',
    'duplicate_origin',
    'matched_by',
    'warnings',
    'media_failures',
    'post_url',
];
function formatMediaFailures(row) {
    return (row.mediaFailures?.map(({ sourceUrl, reason }) => `${sourceUrl}: ${reason}`).join('\n') ?? '');
}
function buildImportReport(run) {
    if (!run.rows.length) {
        return undefined;
    }
    return (0, csv_1.serialize)(run.rows.map((row) => ({
        line: row.line,
        title: row.title ?? '',
        outcome: row.duplicate ? 'duplicate' : row.status,
        reason: row.reason ?? '',
        duplicate_origin: row.duplicate?.origin ?? '',
        matched_by: row.duplicate?.matchedBy ?? '',
        warnings: row.warnings?.join('\n') ?? '',
        media_failures: formatMediaFailures(row),
        post_url: row.url ?? '',
    })), { columns: REPORT_COLUMNS });
}
