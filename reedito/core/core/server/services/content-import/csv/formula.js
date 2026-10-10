"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripFormulaGuard = stripFormulaGuard;
const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r'];
// Report files prefix formula-shaped cells with an apostrophe. Remove exactly
// that guard during re-import so repeated fixes do not change publisher data.
function stripFormulaGuard(cell) {
    if (cell.charAt(0) === "'" && FORMULA_TRIGGERS.includes(cell.charAt(1))) {
        return cell.slice(1);
    }
    return cell;
}
