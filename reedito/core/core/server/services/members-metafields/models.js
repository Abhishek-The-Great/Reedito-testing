"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Metafield = void 0;
const zod_1 = require("zod");
const metafield_types_1 = require("@reedito/metafield-types");
const access_1 = require("./access");
const schema_1 = require("./schema");
exports.Metafield = zod_1.z.object({
    id: zod_1.z.string(),
    namespace: zod_1.z.string(),
    key: zod_1.z.string(),
    name: zod_1.z.string(),
    type: metafield_types_1.FieldTypeSchema,
    status: schema_1.FieldStatusSchema,
    access: zod_1.z.object({ member: access_1.MemberAccessSchema }),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date().nullable(),
});
