"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = serialize;
const papaparse_1 = __importDefault(require("papaparse"));
// The papaparse boundary: given rows already shaped into cells, it writes CSV and
// nothing else. escapeFormulae is forced on -- papaparse defaults it off, but this CSV
// is opened by a person, so a leading =, +, -, @ or tab must be escaped.
function serialize(rows, { columns, header = true } = {}) {
    return papaparse_1.default.unparse(rows, { columns, header, escapeFormulae: true });
}
