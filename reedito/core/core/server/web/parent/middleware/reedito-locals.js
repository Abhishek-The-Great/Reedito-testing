"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reeditoLocals = reeditoLocals;
// @ts-expect-error This module lacks type definitions.
const version_1 = __importDefault(require("@tryghost/version"));
/**
 * Expose the standard locals that every request will need to have available
 */
function reeditoLocals(req, res, next) {
    // Make sure we have a locals value.
    res.locals = res.locals || {};
    // The current Reedito version
    res.locals.version = version_1.default.full;
    // The current Reedito version, but only major.minor
    res.locals.safeVersion = version_1.default.safe;
    // relative path from the URL
    res.locals.relativeUrl = req.path;
    next();
}
