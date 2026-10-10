"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.METAFIELDS_RELATION = void 0;
exports.createMetafieldsFilterTransformer = createMetafieldsFilterTransformer;
// Translates the metafield clauses of a members filter into a query over the
// values table. A metafield is a publisher-defined field on a member; it is
// addressed as `namespace.key`, and a composite value such as an address names
// one of its parts by appending it: `namespace.key.part`.
//
//   (metafields.key:'custom.company'+metafields.value:'Reedito')
//   (metafields.key:'custom.shipping_address.country'+metafields.value:'GB')
//   metafields.key:'custom.company'                     // has a value
//   metafields.key:-'custom.shipping_address.country'   // that part is not set
//
// The values table holds one row per stored value: `metafield_key`, `path`
// (empty for a plain field, the part's name for one part of a composite) and
// `value_text`. A filter addresses those columns directly, so each one becomes a
// single $elemMatch over them — positive asserts a matching row exists, $not
// asserts none does — with no lookup against the field definitions.
const errors_1 = __importDefault(require("@tryghost/errors"));
const identity_1 = require("@reedito/metafield-types/identity");
const RELATION = 'metafields';
const PREFIX = `${RELATION}.`;
const KEY_ATTRIBUTE = `${PREFIX}key`;
const VALUE_ATTRIBUTE = `${PREFIX}value`;
const ROOT_PATH = '';
// Only recurse into plain objects/arrays; a RegExp, Date, etc. is a leaf value that
// must pass through by reference (recursing would strip a regex to `{}`).
function isPlainObject(value) {
    return (typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null));
}
function isMetafieldClause(node) {
    if (!isPlainObject(node)) {
        return false;
    }
    const keys = Object.keys(node);
    return keys.length === 1 && keys[0].startsWith(PREFIX);
}
// A grouped compound: an $and whose clauses all target the relation and name exactly one
// `key`. Its clauses describe one leaf row.
//
// Exactly one, not at least one: two whole-field filters ANDed together arrive as a flat
// `key:'a'+key:'b'`, since a bare key clause needs no group of its own. That is two
// filters — a member with a value for both — not one leaf that is somehow both fields, so
// it has to fall through and be transformed a clause at a time.
function isMetafieldCompound(clauses) {
    if (!Array.isArray(clauses) || clauses.length < 2 || !clauses.every(isMetafieldClause)) {
        return false;
    }
    return clauses.filter((clause) => Object.keys(clause)[0] === KEY_ATTRIBUTE).length === 1;
}
// NQL compiles every negation in this grammar to `{$ne: <string>}`, so a negated clause
// can arrive in no other shape.
function negatedString(value) {
    return isPlainObject(value) && typeof value.$ne === 'string' ? value.$ne : null;
}
const ANY_PATH = null;
// A stored key never contains a dot, so a full dotted identity is a key no stored
// row can equal.
function unmatchableLeaf(identity) {
    return { key: (0, identity_1.formatIdentity)(identity), path: identity.partPath };
}
function parseLeafAddress(raw) {
    const identity = typeof raw === 'string' ? (0, identity_1.parseIdentity)(raw) : null;
    if (!identity) {
        throw new errors_1.default.BadRequestError({
            message: `A metafield filter names a field as namespace.key, for example (${KEY_ATTRIBUTE}:'custom.company'+${VALUE_ATTRIBUTE}:'Reedito').`,
        });
    }
    if (identity.namespace !== identity_1.CUSTOM_NAMESPACE) {
        return unmatchableLeaf(identity);
    }
    return { key: identity.key, path: identity.partPath };
}
function createMetafieldsFilterTransformer() {
    // One (maybe-negated) $elemMatch over the leaf columns: positive is "a leaf pinned
    // by these matches", `$not` is "no leaf does".
    function buildElemMatch(target, value, negate) {
        const match = { metafield_key: target.key };
        if (value !== undefined) {
            match.path = target.path ?? ROOT_PATH;
            match.value_text = value;
        }
        else if (target.path !== ANY_PATH) {
            match.path = target.path;
        }
        if (negate) {
            return { [RELATION]: { $not: { $elemMatch: match } } };
        }
        return { [RELATION]: { $elemMatch: match } };
    }
    function toElemMatch(clauses) {
        let target;
        let value;
        let hasValue = false;
        for (const clause of clauses) {
            const [attribute, clauseValue] = Object.entries(clause)[0];
            if (attribute === KEY_ATTRIBUTE) {
                if (negatedString(clauseValue) !== null) {
                    throw new errors_1.default.BadRequestError({
                        message: `A negated "${KEY_ATTRIBUTE}" stands alone; it cannot be grouped with a value.`,
                    });
                }
                target = parseLeafAddress(clauseValue);
            }
            else if (attribute === VALUE_ATTRIBUTE) {
                if (hasValue) {
                    throw new errors_1.default.BadRequestError({
                        message: `A metafield filter takes one "${VALUE_ATTRIBUTE}" clause.`,
                    });
                }
                hasValue = true;
                value = clauseValue;
            }
            else {
                throw new errors_1.default.BadRequestError({
                    message: `Unsupported metafield filter clause "${attribute}".`,
                });
            }
        }
        if (!target) {
            throw new errors_1.default.BadRequestError({
                message: `A metafield filter needs a "${KEY_ATTRIBUTE}" clause.`,
            });
        }
        return buildElemMatch(target, hasValue ? value : undefined, false);
    }
    function fromKeyClause(value) {
        const negatedKey = negatedString(value);
        if (negatedKey !== null) {
            return buildElemMatch(parseLeafAddress(negatedKey), undefined, true);
        }
        return buildElemMatch(parseLeafAddress(value), undefined, false);
    }
    function transform(node) {
        if (Array.isArray(node)) {
            return node.map(transform);
        }
        if (!isPlainObject(node)) {
            return node;
        }
        if (isMetafieldCompound(node.$and)) {
            return toElemMatch(node.$and);
        }
        const out = {};
        for (const [key, value] of Object.entries(node)) {
            if (key === KEY_ATTRIBUTE) {
                Object.assign(out, fromKeyClause(value));
            }
            else if (key.startsWith(PREFIX)) {
                throw new errors_1.default.BadRequestError({
                    message: `A "${key}" filter must be grouped with its "${KEY_ATTRIBUTE}" clause, for example (${KEY_ATTRIBUTE}:'custom.a_field'+${VALUE_ATTRIBUTE}:'a value').`,
                });
            }
            else {
                out[key] = transform(value);
            }
        }
        return out;
    }
    return (query) => transform(query);
}
/**
 * The Member filter relation that exposes metafield values. A member has many leaf
 * rows (one per field, or per part of a composite field), and a predicate asks whether
 * one of them matches, so this joins the values table on member_id and mongo-knex emits
 * it as a correlated `members.id IN (…)` subquery — composing with every other member
 * filter.
 */
exports.METAFIELDS_RELATION = {
    tableName: 'members_metafield_values',
    tableNameAs: RELATION,
    type: 'oneToOne',
    joinFrom: 'member_id',
};
