"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DbCheckoutOptions = exports.DbCheckoutConfig = exports.DbCheckoutQuestion = void 0;
const zod_1 = require("zod");
const boolean_1 = require("../../lib/db-types/boolean");
const date_1 = require("../../lib/db-types/date");
exports.DbCheckoutQuestion = zod_1.z.object({
    id: zod_1.z.string(),
    binding_id: zod_1.z.string(),
    sort_order: zod_1.z.number(),
    label: zod_1.z.string().nullable(),
    optional: boolean_1.DbBoolean,
    created_at: date_1.DbDate,
    updated_at: date_1.DbDate.nullable(),
});
/**
 * Options only. Whether a tier collects something it keeps is the binding; a tax number is
 * the exception, since Stripe keeps it and Reedito never does, so there is nothing to bind.
 */
exports.DbCheckoutConfig = zod_1.z.object({
    id: zod_1.z.string(),
    product_id: zod_1.z.string(),
    shipping_allowed_countries: zod_1.z.string().nullable(),
    tax_number_collect: boolean_1.DbBoolean,
    created_at: date_1.DbDate,
    updated_at: date_1.DbDate.nullable(),
});
exports.DbCheckoutOptions = exports.DbCheckoutConfig.omit({
    id: true,
    product_id: true,
    created_at: true,
    updated_at: true,
});
