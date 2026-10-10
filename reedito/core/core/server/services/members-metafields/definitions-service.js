"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetafieldDefinitionsService = void 0;
const bson_objectid_1 = __importDefault(require("bson-objectid"));
const errors_1 = __importDefault(require("@tryghost/errors"));
const zod_1 = require("zod");
const metafield_types_1 = require("@reedito/metafield-types");
const identity_1 = require("@reedito/metafield-types/identity");
const codec_1 = require("./codec");
const namespaces_1 = require("./namespaces");
const schema_1 = require("./schema");
const access_1 = require("./access");
const queries_1 = require("./queries");
const key_1 = require("./key");
const TABLE = 'members_metafields';
// Column limits come from the canonical schema — the same source the migration and
// Bookshelf models read — so the service can never drift from the database. The
// name cap turns an over-long input into a clean 422 (not a DB error), and the key
// base is capped so even the longest collision suffix stays within the column.
const columns = require('../../data/schema').tables[TABLE];
const MAX_NAME_LENGTH = columns.name.maxlength;
const MAX_KEY_LENGTH = columns.key.maxlength;
const MAX_KEY_ITERATIONS = 1000;
// Reserve room for a `_<n>` suffix (n up to MAX_KEY_ITERATIONS).
const MAX_KEY_BASE_LENGTH = MAX_KEY_LENGTH - (String(MAX_KEY_ITERATIONS).length + 1);
// A key becomes a property name on the plain objects that carry a member's values —
// on both sides of the wire, since `custom_fields` is JSON and a client gets a plain
// object from JSON.parse. A key naming a member of Object.prototype reads back as
// inherited rather than absent wherever one of those objects is indexed.
//
// Derived rather than listed, from the format a key may take rather than from how one
// is minted: a caller can state a key instead of deriving it from a name, so what has
// to be reserved is every prototype name a well-formed key could spell. The ones that
// carry a capital cannot be spelled at all and need no reserving; `constructor` and
// `__proto__` can.
const RESERVED_KEYS = Object.getOwnPropertyNames(Object.prototype).filter((name) => key_1.KEY_CHARACTERS.test(name));
const FieldName = zod_1.z
    .string()
    .trim()
    .min(1, { message: 'Custom field name is required.' })
    .max(MAX_NAME_LENGTH, { message: 'Custom field name is too long.' });
const FieldAccess = zod_1.z.object({ member: access_1.MemberAccessSchema });
// No key: the backend mints it from the name.
const AddFieldInput = zod_1.z.object({
    name: FieldName,
    type: metafield_types_1.FieldTypeSchema,
    access: FieldAccess.optional(),
});
// A bound on the work one request can ask for, separate from how many definitions
// a site may hold in total. Every definition in a batch costs several queries
// inside one open write transaction, so an operator raising the site ceiling must
// not also mean a single request can ask for an unbounded amount of that work.
const MAX_FIELDS_PER_REQUEST = 100;
// Create accepts a batch. The framework guarantees a non-empty array by the time a
// query runs, but the service validates the whole payload up front so a bad item
// anywhere fails the request before anything is written.
const AddFieldsInput = zod_1.z
    .array(AddFieldInput)
    .min(1)
    .max(MAX_FIELDS_PER_REQUEST, {
    message: `Custom fields can only be created ${MAX_FIELDS_PER_REQUEST} at a time.`,
});
// Only the key is read; the client sends whole field objects because that is the shape
// the API speaks in.
const ReorderInput = zod_1.z
    .array(zod_1.z.object({
    key: zod_1.z.string().min(1, { message: 'Every custom field in the order needs a key.' }),
}))
    .min(1, { message: 'The order must name every custom field.' });
// Name, status and access are mutable. `key` and `type` are accepted so the
// immutability rules can reject a change loudly; they are never persisted.
const EditFieldInput = zod_1.z.object({
    name: FieldName.optional(),
    status: schema_1.FieldStatusSchema.optional(),
    access: FieldAccess.optional(),
    key: zod_1.z.string().optional(),
    type: metafield_types_1.FieldTypeSchema.optional(),
});
class MetafieldDefinitionsService {
    knex;
    recordAction;
    getMaxDefinitions;
    constructor({ knex, recordAction, getMaxDefinitions, }) {
        this.knex = knex;
        this.recordAction = recordAction;
        // A getter, not a value: the ceiling can be raised or lowered at any time,
        // and a Reedito container holds no state across requests, so the limit that
        // applies is whatever it resolves to when the request lands. Asking on
        // every create means a change takes effect on the next one, with no
        // restart. Where the number comes from is the caller's business.
        this.getMaxDefinitions = getMaxDefinitions;
    }
    async hasAnyReadable(audience) {
        const [field] = await this.list((0, queries_1.definitions)(this.knex, { audience, status: queries_1.ACTIVE_ONLY, limit: 1 }));
        return Boolean(field);
    }
    /**
     * The fields table has no namespace column: every row in it belongs to the publisher's
     * `custom` namespace, so no other namespace can have a stored field.
     */
    isStored(namespace) {
        return namespace === identity_1.CUSTOM_NAMESPACE;
    }
    async browse(options, audience) {
        if (options.namespace !== undefined && !this.isStored(options.namespace)) {
            return [];
        }
        // Whichever set comes back, it comes back in the publisher's order: filtering
        // narrows the list, it never reorders it.
        const { filter } = options;
        if (filter) {
            // A filter naming `status` decides the statuses itself, which is how Settings
            // pulls active and archived together in one request
            // (`filter=status:[active,archived]`). One that does not gets the same active-only
            // scope as an unfiltered read.
            const parsed = parseFilter(filter);
            return this.list((0, queries_1.definitions)(this.knex, {
                audience,
                status: filterReferencesStatus(parsed) ? queries_1.ANY_STATUS : queries_1.ACTIVE_ONLY,
                filter: (query) => (0, queries_1.knexify)(query, parsed, { tableName: TABLE }),
            }));
        }
        return this.list((0, queries_1.definitions)(this.knex, { audience, status: queries_1.ACTIVE_ONLY }));
    }
    async list(query) {
        const rows = await (0, queries_1.inFieldOrder)(query).select('*');
        return rows.map((row) => zod_1.z.decode(codec_1.metafieldCodec, row));
    }
    async read(namespace, key, audience) {
        const [field] = this.isStored(namespace)
            ? await this.list((0, queries_1.definitions)(this.knex, { audience, status: queries_1.ANY_STATUS, key }))
            : [];
        if (!field) {
            throw new errors_1.default.NotFoundError({ message: 'Custom field not found.' });
        }
        return field;
    }
    /**
     * Create one or more field definitions. All-or-nothing: the batch runs in a
     * single transaction, so a name clash or the operational cap on the third item
     * leaves the first two unwritten rather than half-applying the request.
     *
     * Running inside the transaction also makes a batch self-consistent for free —
     * `assertNameAvailable` and `mintKey` see the rows inserted earlier in the same
     * batch, so two items sharing a name are caught and two items deriving the same
     * key get distinct ones, exactly as if they had arrived as separate requests.
     */
    async add(context, namespace, input) {
        (0, namespaces_1.assertDefinable)(namespace);
        const requestedCount = Array.isArray(input) ? input.length : 0;
        const parsed = AddFieldsInput.safeParse(input);
        if (!parsed.success) {
            const issue = parsed.error.issues[0];
            throw new errors_1.default.ValidationError({
                message: issue.message,
                property: propertyOf(issue.path),
                context: batchContext(issue.path[0], requestedCount),
            });
        }
        const fields = parsed.data;
        // Mint before opening the transaction: it needs no database access, and
        // an unusable name is a payload problem worth reporting on its own terms.
        const bases = fields.map((field, index) => {
            const base = (0, key_1.mintableKey)(field.name);
            if (!base) {
                throw new errors_1.default.ValidationError({
                    message: 'Custom field name must contain at least one usable character.',
                    property: 'name',
                    context: batchContext(index, requestedCount),
                });
            }
            return base;
        });
        let created;
        try {
            created = await this.knex.transaction(async (trx) => {
                await this.assertWithinLimit(trx, fields.length);
                // Read once, before the loop: a batch appends as consecutive ranks, so
                // the five fields of one request land in the order the request gave
                // them rather than all sharing the end of the list.
                const firstSortOrder = await this.nextSortOrder(trx);
                const keys = [];
                for (const [index, field] of fields.entries()) {
                    await this.assertNameAvailable(trx, field.name);
                    const key = await this.mintKey(trx, bases[index]);
                    await this.insertField(trx, {
                        key,
                        name: field.name,
                        type: field.type,
                        memberAccess: field.access?.member ?? access_1.MEMBER_ACCESS.none,
                        sortOrder: firstSortOrder + index,
                    });
                    keys.push(key);
                }
                return this.readMany(trx, keys);
            });
        }
        catch (err) {
            // mintKey already picked a free key, so a unique violation here only
            // means a concurrent create claimed the same key in between. The index
            // is the final arbiter; surface a retryable conflict rather than a 500.
            if (isUniqueConstraintViolation(err)) {
                throw new errors_1.default.ConflictError({
                    message: 'Could not create the custom field, please try again.',
                });
            }
            throw err;
        }
        // Logged after the commit: the action log is a separate Bookshelf write
        // outside this transaction, so recording inside it would leave orphaned
        // "added" entries for fields a rollback never created.
        await this.recordCreated(context, created);
        return created;
    }
    /**
     * Given an executor it joins that transaction; given none it opens its own. Unlike
     * `add`, the key is stated rather than minted from the name, and nothing about it is
     * worked around: a caller states a key because something else already names that key,
     * so a variant of it would be a field nothing points at.
     *
     * The field is returned rather than logged: the history writes on its own connection,
     * which a single-connection pool would deadlock against an open transaction.
     */
    async addOne(wanted, { executor = this.knex } = {}) {
        // Before any database access, the way `add` mints before opening its transaction:
        // an unusable key is a payload problem worth reporting on its own terms.
        assertKeyUsable(wanted.key);
        const write = async (db) => {
            await this.assertWithinLimit(db, 1);
            await this.assertKeyAvailable(db, wanted.key);
            await this.assertNameAvailable(db, wanted.name);
            await this.insertField(db, {
                key: wanted.key,
                name: wanted.name,
                type: wanted.type,
                memberAccess: wanted.access.member,
                sortOrder: await this.nextSortOrder(db),
            });
            const [created] = await this.readMany(db, [wanted.key]);
            return created;
        };
        // knex's marker for a transactor: join it rather than nesting a savepoint under it.
        return executor.isTransaction ? write(executor) : executor.transaction(write);
    }
    /**
     * Only for a stated key. Minting picks a free one instead, so this reads as a clean 422
     * where the unique index would read as a 500.
     */
    async assertKeyAvailable(db, key) {
        const taken = await db(TABLE).where('key', key).first();
        if (taken) {
            throw new errors_1.default.ValidationError({
                message: 'A custom field with this key already exists.',
                property: 'key',
            });
        }
    }
    async insertField(db, field) {
        await db(TABLE).insert({
            id: new bson_objectid_1.default().toHexString(),
            key: field.key,
            name: field.name,
            type: field.type,
            member_access: field.memberAccess,
            sort_order: field.sortOrder,
            created_at: new Date(),
        });
    }
    /** `read` for a caller that is deciding rather than serving: absent is an answer. */
    async findByKey(key, { executor = this.knex } = {}) {
        const row = await executor(TABLE).where('key', key).first();
        return row ? zod_1.z.decode(codec_1.metafieldCodec, row) : null;
    }
    /** The same entry `add` writes. Only the caller knows its transaction committed. */
    async recordCreated(context, fields) {
        for (const field of fields) {
            await this.recordAction({
                context,
                verb: 'create',
                subject: field.id,
                details: { primary_name: field.name, key: field.key },
            });
        }
    }
    /**
     * The operational ceiling on how many definitions a site can hold. This is a
     * safeguard against the database load unbounded definitions would create, not
     * a pricing or packaging limit, so it applies wherever the feature is available
     * and is deliberately not routed through the entitlement-driven limit service.
     *
     * Both active and archived definitions count: an archived field still occupies
     * a row and still carries its members' values, so archiving alone frees no
     * space. Deleting an archived field is what releases a slot.
     *
     * The count is a consistent read, not a locking one, so two creates landing at
     * the same instant can both pass and take a site one over. That is deliberate:
     * this is a ceiling on database load, and holding a table lock across every
     * create to make it exact would cost more than the overshoot it prevents.
     *
     */
    async assertWithinLimit(db, addedCount) {
        const max = this.getMaxDefinitions();
        const row = await db(TABLE).count({ count: '*' }).first();
        const total = Number(row?.count ?? 0);
        if (total + addedCount <= max) {
            return;
        }
        // Two different situations reach here and they need different advice. At or
        // over the ceiling there is nothing to do but free a slot. With slots still
        // free the request was simply too big, and telling that operator to delete
        // something is wrong: they have room, just not this much.
        const remaining = max - total;
        const advice = remaining > 0
            ? `You can add ${remaining} more.`
            : 'Delete a field you no longer need to make room.';
        throw new errors_1.default.HostLimitError({
            message: `Custom fields are limited to ${max} per site. ${advice}`,
            code: 'CUSTOM_FIELDS_LIMIT_REACHED',
            // `requested` is carried alongside the limit-service shape so a batch
            // rejection is self-describing: without it a client sees free slots and
            // a refusal, and has to re-derive its own payload size to explain why.
            errorDetails: { limit: max, total, requested: addedCount },
        });
    }
    /**
     * Set the order of the whole list, stated rather than adjusted: every row gets a
     * fresh rank, so a move is well-defined even where every rank is still the default.
     * Returns every definition, archived included, matching what the request named.
     */
    async reorder(context, namespace, input) {
        (0, namespaces_1.assertDefinable)(namespace);
        const parsed = ReorderInput.safeParse(input);
        if (!parsed.success) {
            const issue = parsed.error.issues[0];
            throw new errors_1.default.ValidationError({
                message: issue.message,
                property: propertyOf(issue.path),
            });
        }
        const keys = parsed.data.map((item) => item.key);
        const ordered = await this.knex.transaction(async (trx) => {
            await this.assertNamesEveryField(trx, keys);
            // Ranks come from the request's order; the statements go out in key order, so
            // two concurrent reorders take their row locks in the same sequence and
            // cannot deadlock. `updated_at` is left alone — the definitions did not
            // change, the list around them did.
            const ranks = new Map(keys.map((key, rank) => [key, rank]));
            for (const key of [...keys].sort()) {
                await trx(TABLE)
                    .where('key', key)
                    .update({ sort_order: ranks.get(key) });
            }
            // An order covers the whole list, archived definitions included.
            return this.list((0, queries_1.definitions)(trx, { audience: access_1.ADMIN, status: queries_1.ANY_STATUS }));
        });
        await this.recordAction({
            context,
            verb: 'reorder',
            subject: null,
            details: { action_name: 'reordered', count: ordered.length },
        });
        return ordered;
    }
    /**
     * A partial order is ambiguous, so a reorder that does not name every field exactly
     * once is refused rather than half-applied. A client that loaded before a colleague
     * added a field cannot name it, and is told to reload.
     */
    async assertNamesEveryField(db, keys) {
        const named = new Set(keys);
        const existing = new Set(await db(TABLE).pluck('key'));
        const matches = named.size === keys.length &&
            named.size === existing.size &&
            keys.every((key) => existing.has(key));
        if (!matches) {
            throw new errors_1.default.ValidationError({
                message: 'The order must name every custom field exactly once. Reload and try again.',
                property: 'key',
            });
        }
    }
    /** A new field is appended. Archived fields hold ranks too, so it lands past them. */
    async nextSortOrder(db) {
        const row = await db(TABLE).max({ highest: 'sort_order' }).first();
        const highest = row?.highest;
        // No fields yet, so this one starts the order.
        if (highest === null || highest === undefined) {
            return 0;
        }
        return Number(highest) + 1;
    }
    /** Read back a batch in the order its keys were created, not the table's order. */
    async readMany(db, keys) {
        const rows = await db(TABLE).whereIn('key', keys).select('*');
        const byKey = new Map(rows.map((row) => [row.key, row]));
        return keys.map((key) => zod_1.z.decode(codec_1.metafieldCodec, byKey.get(key)));
    }
    /**
     * Pick a free key from the name's base: `base`, then `base_2`, `base_3`, ...
     * Reads the keys already taken by that base — including archived fields, so a
     * key is never reused once minted.
     */
    async mintKey(db, base) {
        // Trimmed again after cutting, because the cut can land mid-separator and
        // a key that ends in one is not a shape minting is allowed to produce. The
        // base starts with an alphanumeric, so something always survives.
        const safeBase = base.slice(0, MAX_KEY_BASE_LENGTH).replace(/_+$/, '');
        const taken = new Set([
            ...RESERVED_KEYS,
            ...(await db(TABLE).where('key', 'like', `${safeBase}%`).pluck('key')),
        ]);
        if (!taken.has(safeBase)) {
            return safeBase;
        }
        for (let suffix = 2; suffix <= MAX_KEY_ITERATIONS; suffix += 1) {
            const candidate = `${safeBase}_${suffix}`;
            if (!taken.has(candidate)) {
                return candidate;
            }
        }
        throw new errors_1.default.ValidationError({
            message: 'Could not mint a unique key for this custom field.',
            property: 'name',
        });
    }
    /**
     * Names are globally unique (across active and archived) so the label is
     * never ambiguous — a unique index on `name` enforces it. This read gives a
     * clean `property: name` 422 for the common case (the raw index violation
     * can't be told apart from a key clash); the index is the race backstop.
     *
     * The LOWER() normalises case in application code because the engines
     * disagree: MySQL's default collation is case-insensitive, SQLite's is not,
     * so relying on the index alone would reject "Company"/"company" in prod but
     * allow it in the SQLite test/dev suites. `exceptKey` lets a field keep its
     * own name on an unrelated edit.
     */
    async assertNameAvailable(db, name, exceptKey) {
        const query = db(TABLE).whereRaw('LOWER(name) = ?', [name.toLowerCase()]);
        if (exceptKey) {
            query.whereNot('key', exceptKey);
        }
        const clash = await query.first();
        if (clash) {
            throw new errors_1.default.ValidationError({
                message: 'A custom field with this name already exists.',
                property: 'name',
            });
        }
    }
    async edit(context, namespace, key, input) {
        if (!this.isStored(namespace)) {
            throw new errors_1.default.NotFoundError({ message: 'Custom field not found.' });
        }
        const parsed = EditFieldInput.safeParse(input);
        if (!parsed.success) {
            throw new errors_1.default.ValidationError({
                message: parsed.error.issues[0].message,
                property: parsed.error.issues[0].path[0]?.toString(),
            });
        }
        const patch = parsed.data;
        const existing = await this.read(identity_1.CUSTOM_NAMESPACE, key, access_1.ADMIN);
        // Key and type are immutable after creation: values are addressed by key
        // and interpreted by type, so changing either would silently orphan or
        // corrupt stored values. Reject a differing value rather than ignore it.
        if (patch.key !== undefined && patch.key !== existing.key) {
            throw new errors_1.default.ValidationError({
                message: 'Custom field keys cannot be changed once created.',
                property: 'key',
            });
        }
        if (patch.type !== undefined && patch.type !== existing.type) {
            throw new errors_1.default.ValidationError({
                message: 'Custom field types cannot be changed once created.',
                property: 'type',
            });
        }
        // Only write (and log a rename) when the name actually changes, so
        // re-saving an unchanged field is a no-op rather than a spurious edit.
        if (patch.name !== undefined && patch.name !== existing.name) {
            await this.assertNameAvailable(this.knex, patch.name, key);
            try {
                await this.knex(TABLE)
                    .where('key', key)
                    .update({ name: patch.name, updated_at: new Date() });
            }
            catch (err) {
                if (isUniqueConstraintViolation(err)) {
                    throw new errors_1.default.ConflictError({
                        message: 'Could not rename the custom field, please try again.',
                    });
                }
                throw err;
            }
            await this.recordAction({
                context,
                verb: 'rename',
                subject: existing.id,
                details: { primary_name: patch.name, key, previous_name: existing.name },
            });
        }
        if (patch.access !== undefined && patch.access.member !== existing.access.member) {
            await this.knex(TABLE)
                .where('key', key)
                .update({ member_access: patch.access.member, updated_at: new Date() });
            await this.recordAction({
                context,
                verb: 'changeAccess',
                subject: existing.id,
                details: {
                    primary_name: patch.name ?? existing.name,
                    key,
                    member_access: patch.access.member,
                    previous_member_access: existing.access.member,
                },
            });
        }
        // A status change is the archive/restore transition. Only write (and log)
        // when it actually flips, so re-sending the current status is a no-op.
        if (patch.status !== undefined && patch.status !== existing.status) {
            await this.knex(TABLE)
                .where('key', key)
                .update({ status: patch.status, updated_at: new Date() });
            const verb = patch.status === schema_1.FIELD_STATUS.archived ? 'archive' : 'restore';
            await this.recordAction({
                context,
                verb,
                subject: existing.id,
                details: { primary_name: patch.name ?? existing.name, key },
            });
        }
        return this.read(identity_1.CUSTOM_NAMESPACE, key, access_1.ADMIN);
    }
    /**
     * Permanently delete a field and every member value attached to it (the FK
     * cascades the values). Destructive and irreversible, so it's gated on the
     * field already being archived: a publisher must archive first, then delete,
     * which makes accidental data loss a deliberate two-step. Archiving is the
     * reversible soft state (see `edit` with a status change).
     */
    async destroy(context, namespace, key) {
        if (!this.isStored(namespace)) {
            throw new errors_1.default.NotFoundError({ message: 'Custom field not found.' });
        }
        const field = await this.knex(TABLE).where('key', key).first();
        if (!field) {
            throw new errors_1.default.NotFoundError({ message: 'Custom field not found.' });
        }
        if (field.status !== schema_1.FIELD_STATUS.archived) {
            throw new errors_1.default.ValidationError({
                message: 'Only archived custom fields can be deleted. Archive the field first.',
            });
        }
        await this.knex(TABLE).where('key', key).del();
        await this.recordAction({
            context,
            verb: 'delete',
            subject: field.id,
            details: { primary_name: field.name, key },
        });
    }
}
exports.MetafieldDefinitionsService = MetafieldDefinitionsService;
/**
 * The shape a stated key has to have. Minting derives one that is usable by
 * construction, so this is the check that path never needed: a caller stating its own
 * key has said nothing about the format, and guarding here covers every route in
 * rather than whichever one arrived first.
 *
 * The length bound is the column's own, not `mintKey`'s: that one holds back room for a
 * `_<n>` collision suffix, and a stated key is written exactly as given and never
 * suffixed, so the whole column is available to it.
 */
function assertKeyUsable(key) {
    if (!key_1.KEY_CHARACTERS.test(key)) {
        throw new errors_1.default.ValidationError({
            message: 'A custom field key can only contain lowercase letters, numbers and underscores.',
            property: 'key',
        });
    }
    if (key.length > MAX_KEY_LENGTH) {
        throw new errors_1.default.ValidationError({
            message: `A custom field key can be at most ${MAX_KEY_LENGTH} characters.`,
            property: 'key',
        });
    }
    if (RESERVED_KEYS.includes(key)) {
        throw new errors_1.default.ValidationError({
            message: `${key} cannot be used as a custom field key.`,
            property: 'key',
        });
    }
}
// The field a zod issue points at. Create validates an array, so an issue's path
// is prefixed with the item's index (`[0, 'name']`); `property` names the field
// that is wrong, so the numeric prefix is dropped. Which item it was is reported
// separately by batchContext, keeping `property` the bare field name a client can
// map straight onto its form input.
function propertyOf(path) {
    return path.find((segment) => typeof segment === 'string');
}
// Which definition of a batch an error belongs to. Only set when the request
// carried more than one: a lone definition needs no pointer, and every client
// today sends exactly one, so this stays absent on the common path.
function batchContext(index, requestedCount) {
    if (requestedCount <= 1 || typeof index !== 'number') {
        return undefined;
    }
    return `Custom field ${index + 1} of ${requestedCount}.`;
}
function isUniqueConstraintViolation(error) {
    const code = error?.code;
    return code === 'ER_DUP_ENTRY' || code === 'SQLITE_CONSTRAINT';
}
// Parse a caller-supplied NQL filter, without applying it. A malformed filter is a
// client error (400), not a 500. Whether the result widens the statuses is decided by
// the caller, which reads it with `filterReferencesStatus` and says so when building
// the query; nothing here narrows anything.
function parseFilter(filter) {
    let mongoQuery;
    try {
        mongoQuery = (0, queries_1.nql)(filter).toJSON();
    }
    catch (err) {
        throw new errors_1.default.BadRequestError({
            message: 'Could not parse the filter parameter.',
            property: 'filter',
            err: err,
        });
    }
    // The table has no `namespace` column, so mongo-knex would compile this into SQL against a
    // column that does not exist. Refuse it at the edge, naming the URL as the way to pick a
    // namespace, rather than surface a database error.
    if (filterReferencesAttribute(mongoQuery, 'namespace')) {
        throw new errors_1.default.BadRequestError({
            message: 'Filtering on namespace is not supported. Scope by the namespace route instead.',
            property: 'filter',
        });
    }
    return mongoQuery;
}
// Whether an NQL-parsed filter constrains `status` anywhere, including inside the
// $and/$or/$nor combinators — so a status filter at any nesting counts as the
// caller opting in to (or out of) archived fields.
function filterReferencesStatus(query) {
    return filterReferencesAttribute(query, 'status');
}
function filterReferencesAttribute(query, attribute) {
    return Object.entries(query).some(([key, value]) => {
        if (key === attribute) {
            return true;
        }
        if ((key === '$and' || key === '$or' || key === '$nor') && Array.isArray(value)) {
            return value.some((sub) => filterReferencesAttribute(sub, attribute));
        }
        return false;
    });
}
