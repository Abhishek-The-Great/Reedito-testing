"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DbCount = void 0;
const zod_1 = require("zod");
const databaseCountInput = zod_1.z.union([zod_1.z.number(), zod_1.z.string().regex(/^\d+$/)]);
/**
 * A non-negative integer count, whichever database driver handed it back.
 *
 * Aggregate functions such as COUNT can return a decimal string from MySQL and
 * a number from SQLite. Every read normalises to a safe integer so callers do
 * not need to handle that driver difference themselves.
 */
exports.DbCount = zod_1.z.codec(databaseCountInput, zod_1.z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), {
    decode: (stored) => (typeof stored === 'string' ? Number(stored) : stored),
    encode: (value) => value,
});
