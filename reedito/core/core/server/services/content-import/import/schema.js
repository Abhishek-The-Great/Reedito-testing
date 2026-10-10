"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.importRequestSchema = exports.mappingSchema = void 0;
const zod_1 = require("zod");
const row_1 = require("./row");
const importableFields = new Set(row_1.EDITORIAL_POST_FIELDS);
exports.mappingSchema = zod_1.z.record(zod_1.z.string(), zod_1.z.string()).superRefine((mapping, ctx) => {
    const targets = new Set();
    for (const [header, target] of Object.entries(mapping)) {
        if (!header || header in Object.prototype) {
            ctx.addIssue({ code: 'custom', message: `Invalid CSV header mapping: "${header}"` });
        }
        if (target && !importableFields.has(target)) {
            ctx.addIssue({ code: 'custom', message: `Unknown post field mapping: "${target}"` });
        }
        if (target && targets.has(target)) {
            ctx.addIssue({ code: 'custom', message: `Post field is mapped more than once: "${target}"` });
        }
        targets.add(target);
    }
    if (!targets.has('title')) {
        ctx.addIssue({ code: 'custom', message: 'Post field mapping must include "title"' });
    }
});
exports.importRequestSchema = zod_1.z.object({
    filePath: zod_1.z.string().min(1),
    fileName: zod_1.z.string().min(1),
    mapping: exports.mappingSchema.optional(),
    requestUserEmail: zod_1.z.string().email().nullable().optional(),
});
