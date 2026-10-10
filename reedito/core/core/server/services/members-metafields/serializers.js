"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toMetafieldsResponse = void 0;
const zod_1 = require("zod");
const case_keys_1 = require("../../lib/case-keys");
const models_1 = require("./models");
const MetafieldResource = zod_1.z.object({
    namespace: zod_1.z.string(),
    key: zod_1.z.string(),
    name: zod_1.z.string(),
    type: zod_1.z.string(),
    status: zod_1.z.string(),
    access: zod_1.z.object({ member: zod_1.z.string() }),
    created_at: zod_1.z.date(),
    updated_at: zod_1.z.date().nullable(),
});
const MetafieldsResponse = zod_1.z.object({ members_metafields: zod_1.z.array(MetafieldResource) });
exports.toMetafieldsResponse = zod_1.z
    .array(models_1.Metafield)
    .transform((fields) => ({
    members_metafields: fields.map((field) => (0, case_keys_1.snakeKeys)(field)),
}))
    .pipe(MetafieldsResponse);
