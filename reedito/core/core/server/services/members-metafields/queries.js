"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ANY_STATUS = exports.ACTIVE_ONLY = exports.knexify = exports.nql = void 0;
exports.readableBy = readableBy;
exports.definitions = definitions;
exports.inFieldOrder = inFieldOrder;
const access_1 = require("./access");
const schema_1 = require("./schema");
const FIELDS_TABLE = 'members_metafields';
// The same NQL -> knex bridge Bookshelf's filter plugin uses, applied directly to our
// raw-knex queries: nql parses a `filter` string to a Mongo query, mongo-knex turns that
// into parametrised WHERE clauses. Neither needs a Bookshelf model. Typed once here, since
// neither package ships types.
exports.nql = require('@tryghost/nql');
exports.knexify = require('@tryghost/mongo-knex');
// Nothing in the database keeps an archived or hidden field out of a read: no
// constraint stops a value row referencing one. Both filters are therefore applied in
// code, and a query that forgets either is a silent bug.
function readableBy(query, audience) {
    query.whereIn(`${FIELDS_TABLE}.member_access`, (0, access_1.readableLevels)(audience));
    return query;
}
/**
 * Whether a read includes definitions the publisher has archived.
 *
 * A member is never offered an archived field. Staff managing the list are always
 * shown one, since an archived field is still theirs to rename, restore or delete.
 */
exports.ACTIVE_ONLY = 'active-only';
exports.ANY_STATUS = 'any-status';
// Unannotated so the builder keeps the row type knex derives from the table
// registration; naming a type here would both lose that and make the alias below
// refer to itself.
function metafieldsTable(db) {
    return db(FIELDS_TABLE);
}
function definitions(db, scope) {
    let query = metafieldsTable(db);
    if (scope.filter) {
        query = scope.filter(query);
    }
    if (scope.key !== undefined) {
        query = query.where(`${FIELDS_TABLE}.key`, scope.key);
    }
    if (scope.status === exports.ACTIVE_ONLY) {
        query = query.where(`${FIELDS_TABLE}.status`, schema_1.FIELD_STATUS.active);
    }
    if (scope.limit !== undefined) {
        query = query.limit(scope.limit);
    }
    return readableBy(query, scope.audience);
}
/**
 * The publisher's order, applied to every read of the list. Here for the same reason the
 * status filter is: a read that forgets it comes back in whatever order the engine chose.
 *
 * `created_at` orders a site that has never reordered, where every row still holds the
 * default rank; `id` settles the rest so the order is total.
 */
function inFieldOrder(query) {
    query
        .orderBy(`${FIELDS_TABLE}.sort_order`, 'asc')
        .orderBy(`${FIELDS_TABLE}.created_at`, 'asc')
        .orderBy(`${FIELDS_TABLE}.id`, 'asc');
    return query;
}
