"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FIELDS_TABLE = exports.BINDINGS_TABLE = exports.CONFIG_TABLE = exports.QUESTIONS_TABLE = void 0;
exports.collectionRowsForTier = collectionRowsForTier;
exports.configuredCollectionRows = configuredCollectionRows;
exports.questionRows = questionRows;
const schema_1 = require("../members-metafields/schema");
const checkout_1 = require("@reedito/checkout");
const schema_2 = require("./schema");
exports.QUESTIONS_TABLE = 'products_checkout_fields';
exports.CONFIG_TABLE = 'products_checkout_config';
exports.BINDINGS_TABLE = 'members_metafield_bindings';
exports.FIELDS_TABLE = 'members_metafields';
const ACTIVE = schema_1.FIELD_STATUS.active;
const optionColumns = Object.keys(schema_2.DbCheckoutOptions.shape).map((column) => `${exports.CONFIG_TABLE}.${column}`);
function collectionQuery(db) {
    const bindTo = (alias, port) => function () {
        this.on(`${alias}.product_id`, 'products.id').andOn(db.raw(`${alias}.port = ?`, [port]));
    };
    const landsIn = (alias, binding) => function () {
        this.on(`${alias}.key`, `${binding}.metafield_key`).andOn(db.raw(`${alias}.status = ?`, [ACTIVE]));
    };
    const query = db('products')
        .leftJoin(exports.CONFIG_TABLE, `${exports.CONFIG_TABLE}.product_id`, 'products.id')
        .leftJoin({ name_binding: exports.BINDINGS_TABLE }, bindTo('name_binding', checkout_1.STRIPE_PORT.shippingName))
        .leftJoin({ name_field: exports.FIELDS_TABLE }, landsIn('name_field', 'name_binding'))
        .leftJoin({ shipping_binding: exports.BINDINGS_TABLE }, bindTo('shipping_binding', checkout_1.STRIPE_PORT.shippingAddress))
        .leftJoin({ shipping_field: exports.FIELDS_TABLE }, landsIn('shipping_field', 'shipping_binding'))
        .leftJoin({ phone_binding: exports.BINDINGS_TABLE }, bindTo('phone_binding', checkout_1.STRIPE_PORT.phone))
        .leftJoin({ phone_field: exports.FIELDS_TABLE }, landsIn('phone_field', 'phone_binding'))
        .orderBy('products.id', 'asc')
        .select([
        'products.id as product_id',
        `${exports.CONFIG_TABLE}.id as config_id`,
        ...optionColumns,
        'name_binding.metafield_key as shipping_name_key',
        'name_field.key as shipping_name_collectable',
        'shipping_binding.metafield_key as shipping_address_key',
        'shipping_field.key as shipping_address_collectable',
        'phone_binding.metafield_key as phone_key',
        'phone_field.key as phone_collectable',
    ]);
    return query;
}
/** One row, whether or not that tier has ever been configured. */
function collectionRowsForTier(db, productId) {
    return collectionQuery(db).where('products.id', productId);
}
/**
 * This query starts from products, so without a filter it would return every tier on the
 * site, configured or not. A tier only gets a row in products_checkout_config when someone
 * saves checkout settings for it, so requiring that row narrows the list to the tiers
 * somebody has actually set up. A tier that was set up and then had everything switched off
 * keeps its row and stays in the list, reporting that it collects nothing.
 */
function configuredCollectionRows(db) {
    return collectionQuery(db).whereNotNull(`${exports.CONFIG_TABLE}.id`);
}
function questionRows(db, productId) {
    const query = db(exports.QUESTIONS_TABLE)
        .join(exports.BINDINGS_TABLE, `${exports.BINDINGS_TABLE}.id`, `${exports.QUESTIONS_TABLE}.binding_id`)
        .leftJoin({ question_field: exports.FIELDS_TABLE }, function () {
        this.on('question_field.key', `${exports.BINDINGS_TABLE}.metafield_key`).andOn(db.raw('question_field.status = ?', [ACTIVE]));
    })
        .orderBy(`${exports.BINDINGS_TABLE}.product_id`, 'asc')
        .orderBy(`${exports.QUESTIONS_TABLE}.sort_order`, 'asc')
        .orderBy(`${exports.QUESTIONS_TABLE}.id`, 'asc')
        .select([
        `${exports.BINDINGS_TABLE}.product_id`,
        `${exports.BINDINGS_TABLE}.port`,
        `${exports.QUESTIONS_TABLE}.label`,
        `${exports.QUESTIONS_TABLE}.optional`,
        'question_field.name as question_name',
        'question_field.type as question_type',
    ]);
    if (productId) {
        return query.where(`${exports.BINDINGS_TABLE}.product_id`, productId);
    }
    return query;
}
