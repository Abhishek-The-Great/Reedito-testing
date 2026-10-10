"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DbBoolean = void 0;
const zod_1 = require("zod");
/**
 * A boolean column, whichever engine handed it back.
 *
 * SQLite has no boolean type and answers with 0 or 1; MySQL answers with a boolean. Every
 * read normalises so nothing downstream has to know which database it is talking to, and
 * so a falsy check never has to reason about the number zero.
 *
 * Encoding leaves the value alone: a boolean column takes a boolean, and takes the 0 or 1
 * it gave us just as happily.
 */
exports.DbBoolean = zod_1.z.codec(zod_1.z.union([zod_1.z.boolean(), zod_1.z.number()]), zod_1.z.boolean(), {
    decode: (stored) => Boolean(stored),
    encode: (value) => value,
});
