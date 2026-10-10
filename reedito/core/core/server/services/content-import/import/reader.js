"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = readPostRows;
const csv_1 = require("../csv");
const row_1 = require("./row");
const FIELD_BY_HEADER = Object.fromEntries(row_1.EDITORIAL_POST_FIELDS.map((field) => [field, field]));
async function readPostRows(path, mapping) {
    const parsed = await (0, csv_1.parseWithSource)(path, mapping ?? FIELD_BY_HEADER);
    return {
        columns: parsed.columns,
        rows: parsed.rows.map(({ data, source, line }) => ({
            data: row_1.postImportRowSchema.parse(data),
            source,
            line,
        })),
    };
}
