"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResolvedCheckout = exports.ResolvedQuestion = exports.CheckoutOptions = exports.emptyCheckoutConfig = exports.emptyCollection = exports.TierCheckoutConfig = exports.PhoneCollection = exports.ShippingCollection = exports.CheckoutQuestion = void 0;
const zod_1 = require("zod");
const metafield_types_1 = require("@reedito/metafield-types");
exports.CheckoutQuestion = zod_1.z.object({
    key: zod_1.z.string(),
    label: zod_1.z.string().nullable(),
    optional: zod_1.z.boolean(),
});
/**
 * One toggle and two destinations: a processor returns the recipient and the address
 * under one parameter, but a publisher keeps a name and an address in different fields.
 */
exports.ShippingCollection = zod_1.z.object({
    /**
     * ISO 3166-1 alpha-2, or null for everywhere the processor ships.
     *
     * Null rather than a stored enumeration of every country, because that list moves: the
     * day the processor adds one, a saved "everywhere" would silently be a restriction that
     * excludes it, and nothing would say so.
     */
    allowedCountries: zod_1.z.array(zod_1.z.string()).nullable(),
    nameCustomFieldKey: zod_1.z.string(),
    addressCustomFieldKey: zod_1.z.string(),
});
exports.PhoneCollection = zod_1.z.object({
    customFieldKey: zod_1.z.string(),
});
exports.TierCheckoutConfig = zod_1.z.object({
    tierId: zod_1.z.string(),
    customFields: zod_1.z.array(exports.CheckoutQuestion),
    shipping: exports.ShippingCollection.nullable(),
    /** Stripe keeps a tax number against the customer it invoices; Reedito never stores one. */
    taxNumber: zod_1.z.boolean(),
    phone: exports.PhoneCollection.nullable(),
});
const emptyCollection = () => ({
    shipping: null,
    taxNumber: false,
    phone: null,
});
exports.emptyCollection = emptyCollection;
const emptyCheckoutConfig = (tierId) => ({
    tierId,
    customFields: [],
    ...(0, exports.emptyCollection)(),
});
exports.emptyCheckoutConfig = emptyCheckoutConfig;
exports.CheckoutOptions = zod_1.z.object({
    shippingAllowedCountries: zod_1.z.array(zod_1.z.string()).nullable(),
    taxNumber: zod_1.z.boolean(),
});
exports.ResolvedQuestion = exports.CheckoutQuestion.extend({
    prompt: zod_1.z.string(),
    type: metafield_types_1.FieldTypeSchema,
});
exports.ResolvedCheckout = zod_1.z.object({
    customFields: zod_1.z.array(exports.ResolvedQuestion),
    shipping: exports.ShippingCollection.nullable(),
    taxNumber: zod_1.z.boolean(),
    phone: exports.PhoneCollection.nullable(),
});
