"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.questionRowCodec = exports.QuestionRow = exports.collectionRowCodec = exports.CollectionRow = exports.optionsCodec = void 0;
const zod_1 = require("zod");
const metafield_types_1 = require("@reedito/metafield-types");
const boolean_1 = require("../../lib/db-types/boolean");
const schema_1 = require("./schema");
const models_1 = require("./models");
const SEPARATOR = ',';
exports.optionsCodec = zod_1.z.codec(schema_1.DbCheckoutOptions, models_1.CheckoutOptions, {
    // An absent list is everywhere, so the column is null rather than a copy of every
    // country. An empty list is neither, and stays representable on purpose: nothing writes
    // one, and the session builder refuses to collect against it rather than asking the
    // processor for an address form it would never render.
    decode: (columns) => ({
        shippingAllowedCountries: columns.shipping_allowed_countries === null
            ? null
            : splitList(columns.shipping_allowed_countries),
        taxNumber: columns.tax_number_collect,
    }),
    encode: (options) => ({
        shipping_allowed_countries: options.shippingAllowedCountries === null ? null : joinList(options.shippingAllowedCountries),
        tax_number_collect: options.taxNumber,
    }),
});
function splitList(stored) {
    return stored.split(SEPARATOR).filter(Boolean);
}
function joinList(values) {
    return [...new Set(values)].join(SEPARATOR);
}
exports.CollectionRow = zod_1.z.object({
    product_id: zod_1.z.string(),
    config_id: zod_1.z.string().nullable(),
    shipping_allowed_countries: zod_1.z.string().nullable(),
    tax_number_collect: boolean_1.DbBoolean.nullable(),
    shipping_name_key: zod_1.z.string().nullable(),
    shipping_name_collectable: zod_1.z.string().nullable(),
    shipping_address_key: zod_1.z.string().nullable(),
    shipping_address_collectable: zod_1.z.string().nullable(),
    phone_key: zod_1.z.string().nullable(),
    phone_collectable: zod_1.z.string().nullable(),
});
exports.collectionRowCodec = exports.CollectionRow.transform((row) => {
    const collection = collectedInto(row);
    return {
        tierId: row.product_id,
        configured: row.config_id !== null,
        collection,
        collecting: {
            // Stripe collects the recipient's name and their address under one parameter, so it
            // asks for both or neither. Archiving one of the two destinations is the publisher
            // saying they no longer want that half: the step is still worth asking for while the
            // other half can land, and whatever arrives for the archived one is dropped. Only
            // archiving both leaves nothing worth asking for.
            shipping: row.shipping_name_collectable === null && row.shipping_address_collectable === null
                ? null
                : collection.shipping,
            taxNumber: collection.taxNumber,
            phone: row.phone_collectable === null ? null : collection.phone,
        },
    };
});
exports.QuestionRow = zod_1.z.object({
    product_id: zod_1.z.string(),
    port: zod_1.z.string(),
    label: schema_1.DbCheckoutQuestion.shape.label,
    optional: schema_1.DbCheckoutQuestion.shape.optional,
    question_name: zod_1.z.string().nullable(),
    question_type: metafield_types_1.FieldTypeSchema.nullable(),
});
exports.questionRowCodec = exports.QuestionRow.transform((row) => ({
    tierId: row.product_id,
    question: {
        key: row.port,
        label: row.label,
        optional: row.optional,
    },
    askable: row.question_type === null
        ? null
        : { prompt: row.label ?? row.question_name ?? row.port, type: row.question_type },
}));
function collectedInto(row) {
    const { shippingAllowedCountries, taxNumber } = zod_1.z.decode(exports.optionsCodec, {
        shipping_allowed_countries: row.shipping_allowed_countries,
        tax_number_collect: row.tax_number_collect ?? false,
    });
    return {
        shipping: row.shipping_name_key !== null && row.shipping_address_key !== null
            ? {
                allowedCountries: shippingAllowedCountries,
                nameCustomFieldKey: row.shipping_name_key,
                addressCustomFieldKey: row.shipping_address_key,
            }
            : null,
        taxNumber,
        phone: row.phone_key === null ? null : { customFieldKey: row.phone_key },
    };
}
