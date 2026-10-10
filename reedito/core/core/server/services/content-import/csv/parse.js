"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = parse;
exports.parseWithSource = parseWithSource;
const papaparse_1 = __importDefault(require("papaparse"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const formula_1 = require("./formula");
const errors = require('@tryghost/errors');
// A column named after an Object.prototype member is unsafe as a key.
function isSafeColumnName(name) {
    return !(name in Object.prototype);
}
// Quote errors mean cells are being glued together and rows can no longer be told
// apart, so the file is refused. Ragged rows (FieldMismatch) and delimiter guesses
// stay tolerated: an overflow cell is dropped per row, not per file.
function isFatal(error) {
    return error.type === 'Quotes';
}
function isEmptyRow(row) {
    return !Object.values(row).some((value) => {
        if (Array.isArray(value)) {
            return value.some((cell) => typeof cell === 'string' && cell.trim().length > 0);
        }
        return value.trim().length > 0;
    });
}
// headerMapping renames headers to the columns they emit under; unmapped columns
// carry through, and one mapped to an empty target is dropped.
async function parse(path, headerMapping) {
    const parsed = await parseWithSource(path, headerMapping);
    return parsed.rows.map(({ data }) => data);
}
async function parseWithSource(path, headerMapping) {
    // Buffered rather than streamed: files are bounded by the interim row cap, and
    // papaparse's stream mode drops results.errors, which is what catches a
    // malformed quoted field before it imports as garbage.
    const content = (await fs_extra_1.default.readFile(path, 'utf8')).replace(/^\ufeff/, '');
    const parsed = papaparse_1.default.parse(content, {
        header: true,
        // Empty records stay in the parser output long enough to contribute to the
        // publisher-visible spreadsheet line number, then are dropped below.
        skipEmptyLines: false,
    });
    const fatal = parsed.errors.find(isFatal);
    if (fatal) {
        throw new errors.ValidationError({ message: `${fatal.code}: ${fatal.message}` });
    }
    const rows = [];
    for (const [index, parsedRow] of parsed.data.entries()) {
        if (isEmptyRow(parsedRow)) {
            continue;
        }
        const row = {};
        const source = Object.create(null);
        for (const [header, value] of Object.entries(parsedRow)) {
            // non-string values are papaparse's __parsed_extra overflow from ragged rows
            if (typeof value !== 'string') {
                continue;
            }
            source[header] = value;
            // hasOwn: a prototype-named header must not match an inherited method on the mapping
            if (headerMapping && Object.hasOwn(headerMapping, header)) {
                if (!headerMapping[header]) {
                    continue;
                }
                row[headerMapping[header]] = (0, formula_1.stripFormulaGuard)(value);
            }
            else if (isSafeColumnName(header)) {
                row[header] = (0, formula_1.stripFormulaGuard)(value);
            }
        }
        if (!Object.keys(row).length) {
            continue;
        }
        rows.push({ data: row, source, line: index + 2 });
    }
    return { columns: parsed.meta.fields ?? [], rows };
}
