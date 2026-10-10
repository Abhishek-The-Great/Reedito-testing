"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseQueryParameterPolicy = parseQueryParameterPolicy;
const zod_1 = require("zod");
const ALLOWED_NAME_CHARACTERS = /^[A-Za-z_-]+$/;
const QueryParameterPolicyEntrySchema = zod_1.z.object({
    name: zod_1.z
        .string()
        .min(1, { error: 'Parameter names must be nonempty.' })
        .regex(ALLOWED_NAME_CHARACTERS, {
        error: 'Parameter names must only contain letters, underscores, and hyphens.',
    }),
    reason: zod_1.z
        .string()
        .refine((reason) => reason.trim().length > 0, { error: 'Parameter reasons must be nonempty.' }),
});
const QueryParameterListSchema = zod_1.z
    .array(QueryParameterPolicyEntrySchema)
    .superRefine((entries, context) => {
    const names = new Set();
    for (const entry of entries) {
        if (names.has(entry.name)) {
            context.addIssue({
                code: 'custom',
                message: `Duplicate parameter name "${entry.name}".`,
            });
        }
        names.add(entry.name);
    }
});
const QueryParameterPolicySchema = zod_1.z.object({
    schemaVersion: zod_1.z.literal(1, { error: 'Unsupported schema version; expected 1.' }),
    public: QueryParameterListSchema,
    contentApi: QueryParameterListSchema,
});
function parseQueryParameterPolicy(value) {
    return QueryParameterPolicySchema.parse(value);
}
