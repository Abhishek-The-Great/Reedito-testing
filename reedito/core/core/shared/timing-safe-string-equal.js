"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.timingSafeStringEqual = timingSafeStringEqual;
const crypto_1 = __importDefault(require("crypto"));
/**
 * Compares a value Reedito computed (an HMAC digest, say) with one taken from a
 * request, without the response time revealing how much of it matched.
 * Anything that is not a string never matches: a query param repeated in the
 * URL arrives as an array, and that is as wrong as a bad key.
 */
function timingSafeStringEqual(expected, provided) {
    if (typeof provided !== 'string') {
        return false;
    }
    const expectedBuffer = Buffer.from(expected, 'utf16le');
    const providedBuffer = Buffer.from(provided, 'utf16le');
    // crypto.timingSafeEqual throws when the lengths differ. The digests compared
    // here have a fixed, public length, so returning early gives nothing away.
    if (expectedBuffer.length !== providedBuffer.length) {
        return false;
    }
    return crypto_1.default.timingSafeEqual(expectedBuffer, providedBuffer);
}
