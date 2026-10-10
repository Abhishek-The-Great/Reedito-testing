"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DbMetafieldChangeEventWithMember = exports.DbChangeEventMember = exports.DbMetafieldChangeEvent = exports.StoredFieldList = exports.MetafieldChangeEventFields = exports.DbBoundField = exports.DbMetafieldBinding = exports.DbMetafieldLeaf = exports.DbMetafieldValue = exports.WrittenBy = exports.DbMetafield = exports.FieldStatusSchema = exports.FIELD_STATUS = void 0;
const zod_1 = require("zod");
const metafield_types_1 = require("@reedito/metafield-types");
const date_1 = require("../../lib/db-types/date");
const access_1 = require("./access");
// `archived` is soft: the field drops out of the values path but stays in the definition
// list so it can be renamed, restored or deleted. Mirrors schema.js's `isIn` on the
// column, which is static config and cannot import this.
exports.FIELD_STATUS = { active: 'active', archived: 'archived' };
exports.FieldStatusSchema = zod_1.z.enum([exports.FIELD_STATUS.active, exports.FIELD_STATUS.archived]);
// The single source for the read projection and the knex table type below. `type` parses
// as the field-type enum, so the row carries the narrow type and no codec needs a cast.
exports.DbMetafield = zod_1.z.object({
    id: zod_1.z.string(),
    key: zod_1.z.string(),
    name: zod_1.z.string(),
    type: metafield_types_1.FieldTypeSchema,
    status: exports.FieldStatusSchema,
    member_access: access_1.MemberAccessSchema,
    created_at: date_1.DbDate,
    updated_at: date_1.DbDate.nullable(),
});
/**
 * How a value arrived, not who caused it: who edited a member's fields is already an
 * action, and Stripe is not a person. `type` is the namespace that makes `id` resolvable —
 * `users`, `integrations`, `members_metafield_bindings` — so the one writer that
 * resolves in no table is the one with no id to give.
 */
exports.WrittenBy = zod_1.z.discriminatedUnion('type', [
    zod_1.z.object({ type: zod_1.z.literal('user'), id: zod_1.z.string() }),
    zod_1.z.object({ type: zod_1.z.literal('integration'), id: zod_1.z.string() }),
    zod_1.z.object({ type: zod_1.z.literal('binding'), id: zod_1.z.string() }),
    zod_1.z.object({ type: zod_1.z.literal('import'), id: zod_1.z.null() }),
    // A member writing their own answers. Resolvable in `members`, like the others,
    // and the only writer whose changes leave nothing in the staff action log: that
    // log records what staff did.
    zod_1.z.object({ type: zod_1.z.literal('member'), id: zod_1.z.string() }),
]);
// One part of a member's value. What a `path` means is storage.ts's business, so the row
// carries it as a plain string.
exports.DbMetafieldValue = zod_1.z.object({
    id: zod_1.z.string(),
    metafield_key: zod_1.z.string(),
    member_id: zod_1.z.string(),
    path: zod_1.z.string(),
    // Nullable like the column, though nothing here writes a null: a part with no value
    // has no row.
    value_text: zod_1.z.string().nullable(),
    // Plain columns rather than the `WrittenBy` union: the rule holds at the write
    // boundary, so one malformed row cannot throw away a member's whole profile on read.
    written_by_type: zod_1.z.string(),
    // Null for the one writer that resolves nowhere: an import, until runs are tracked.
    written_by_id: zod_1.z.string().nullable(),
    created_at: date_1.DbDate,
    updated_at: date_1.DbDate.nullable(),
});
// The field's key travels with the row so a value assembles without a second lookup.
//
// `type` takes no part in the assembly and is here as a gate: a value whose type has left
// the catalog is one the definitions list no longer returns either, so failing to parse
// is what drops it.
exports.DbMetafieldLeaf = zod_1.z.object({
    member_id: zod_1.z.string(),
    key: zod_1.z.string(),
    type: metafield_types_1.FieldTypeSchema,
    path: zod_1.z.string(),
    value_text: zod_1.z.string(),
});
exports.DbMetafieldBinding = zod_1.z.object({
    id: zod_1.z.string(),
    product_id: zod_1.z.string(),
    port: zod_1.z.string(),
    metafield_key: zod_1.z.string(),
    created_at: date_1.DbDate,
    updated_at: date_1.DbDate.nullable(),
});
/** A binding joined to the field it points at, which is how a collected value is routed. */
exports.DbBoundField = zod_1.z.object({
    binding_id: zod_1.z.string(),
    key: zod_1.z.string(),
    type: metafield_types_1.FieldTypeSchema,
});
/** The fields an entry names. */
exports.MetafieldChangeEventFields = zod_1.z.array(metafield_types_1.MetafieldChangeEventFieldSchema);
/**
 * The field list as the table holds it, JSON text, against the list itself. A codec rather
 * than a parse on the way out, so the write stores what the read accepts. Zod validates
 * JSON-compatible values (`z.json()`) but has no built-in for parsing JSON text, so decoding
 * the text is this codec's job.
 */
exports.StoredFieldList = zod_1.z.codec(zod_1.z.string(), exports.MetafieldChangeEventFields, {
    decode: (text, ctx) => {
        try {
            return JSON.parse(text);
        }
        catch {
            ctx.issues.push({
                code: 'custom',
                message: 'The stored field list is not JSON.',
                input: text,
            });
            return zod_1.z.NEVER;
        }
    },
    encode: (fields) => JSON.stringify(fields),
});
/** An entry as the table holds it. Writer and source are plain strings, as on the values table. */
exports.DbMetafieldChangeEvent = zod_1.z.object({
    id: zod_1.z.string(),
    member_id: zod_1.z.string(),
    written_by_type: zod_1.z.string(),
    written_by_id: zod_1.z.string().nullable(),
    source: zod_1.z.string(),
    metafields: exports.StoredFieldList,
    created_at: date_1.DbDate,
});
/** The member columns an entry is shown with: only what a feed row needs. */
exports.DbChangeEventMember = zod_1.z.object({
    id: zod_1.z.string(),
    uuid: zod_1.z.string(),
    name: zod_1.z.string().nullable(),
    email: zod_1.z.string(),
});
/**
 * An entry and its member read back together. Parses and nothing else: what to do with an
 * entry that doesn't parse is the reading service's decision.
 */
exports.DbMetafieldChangeEventWithMember = zod_1.z
    .object({ event: exports.DbMetafieldChangeEvent, member: exports.DbChangeEventMember })
    .transform(({ event, member }) => ({ ...event, member }));
