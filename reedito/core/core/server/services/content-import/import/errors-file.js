"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = buildErrorsFile;
const csv_1 = require("../csv");
const ANNOTATION_NAMES = ['import_status', 'import_reason', 'import_media_failures'];
function isActionable(row) {
    return Boolean(row.source) && row.status === 'failed';
}
function uniqueColumnName(preferred, used) {
    let candidate = preferred;
    let suffix = 2;
    while (used.has(candidate)) {
        candidate = `${preferred}_${suffix}`;
        suffix += 1;
    }
    used.add(candidate);
    return candidate;
}
function buildErrorsFile(run) {
    const rows = run.rows.filter(isActionable);
    if (!rows.length) {
        return undefined;
    }
    const usedColumns = new Set(run.sourceColumns);
    const [outcomeColumn, reasonColumn, mediaFailuresColumn] = ANNOTATION_NAMES.map((name) => uniqueColumnName(name, usedColumns));
    const columns = [outcomeColumn, reasonColumn, mediaFailuresColumn, ...run.sourceColumns];
    return (0, csv_1.serialize)(rows.map((row) => {
        const sourceCells = Object.fromEntries(run.sourceColumns.map((column) => [column, row.source?.[column] ?? '']));
        return {
            ...sourceCells,
            [outcomeColumn]: row.status,
            [reasonColumn]: row.reason ?? '',
            [mediaFailuresColumn]: row.mediaFailures?.length ? JSON.stringify(row.mediaFailures) : '',
        };
    }), { columns });
}
