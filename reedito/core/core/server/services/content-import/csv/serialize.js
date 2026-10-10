"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = serialize;
const papaparse_1 = __importDefault(require("papaparse"));
// Import reports are opened in spreadsheets, so formula-shaped cells must never
// be emitted verbatim. Papa Parse prefixes them with an apostrophe when this
// option is enabled.
function serialize(rows, { columns, header = true } = {}) {
    return papaparse_1.default.unparse(rows, { columns, header, escapeFormulae: true });
}
