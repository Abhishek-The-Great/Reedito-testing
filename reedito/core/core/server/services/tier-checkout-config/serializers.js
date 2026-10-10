"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toCheckoutConfigResponse = exports.CheckoutConfigInput = void 0;
exports.requirementsByTier = requirementsByTier;
const zod_1 = require("zod");
const checkout_1 = require("@reedito/checkout");
const models_1 = require("./models");
// Every country Stripe will take, sent at once, was measured as accepted — so the only
// ceiling is the list itself, and a request naming more than there are countries is naming
// something twice. A request that means all of them omits the list instead.
const MAX_ALLOWED_COUNTRIES = checkout_1.STRIPE_ALLOWED_COUNTRIES.length;
const QuestionInput = zod_1.z.object({
    key: zod_1.z.string().min(1, { error: 'Every checkout question needs a custom field key.' }),
    label: zod_1.z.string().trim().min(1).nullish(),
    optional: zod_1.z.boolean().optional(),
});
// Not checked against a list of countries: membership of that list is contested, and Reedito
// is not its arbiter.
const CountryCode = zod_1.z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/, { error: 'Enter a 2-letter country code, like US.' })
    .toUpperCase()
    .refine(checkout_1.isStripeAllowedCountry, {
    error: 'Stripe will not ship to that country, so a checkout cannot offer it.',
});
/**
 * Where a collected value lands is the request's to state. Reedito keeps no convention about
 * it, so a block that collects names its destination and one that does not carries nothing
 * to name.
 */
const DESTINATION_REQUIRED = 'Say which custom field this is collected into.';
const CustomFieldKey = zod_1.z
    .string({ error: DESTINATION_REQUIRED })
    .min(1, { error: DESTINATION_REQUIRED });
const Destination = zod_1.z.strictObject({ custom_field_key: CustomFieldKey }, { error: DESTINATION_REQUIRED });
exports.CheckoutConfigInput = zod_1.z.strictObject({
    custom_fields: zod_1.z
        .array(QuestionInput)
        .max(checkout_1.MAX_CHECKOUT_CUSTOM_FIELDS, {
        error: `A checkout can ask at most ${checkout_1.MAX_CHECKOUT_CUSTOM_FIELDS} questions.`,
    })
        .refine((questions) => new Set(questions.map((question) => question.key)).size === questions.length, { error: 'This checkout already asks for that field.' })
        .optional(),
    shipping: zod_1.z
        .discriminatedUnion('collect', [
        zod_1.z.strictObject({ collect: zod_1.z.literal(false) }),
        zod_1.z.strictObject({
            collect: zod_1.z.literal(true),
            // Absent means everywhere the processor ships. Empty is refused rather than
            // read as everywhere: a publisher who cleared the list said something, and it
            // was not "deliver worldwide".
            allowed_countries: zod_1.z
                .array(CountryCode, { error: 'Choose at least one country you deliver to.' })
                .min(1, { error: 'Choose at least one country you deliver to.' })
                .max(MAX_ALLOWED_COUNTRIES)
                .optional(),
            name: Destination,
            address: Destination,
        }),
    ])
        .optional(),
    tax_number: zod_1.z.strictObject({ collect: zod_1.z.boolean() }).optional(),
    phone: zod_1.z
        .discriminatedUnion('collect', [
        zod_1.z.strictObject({ collect: zod_1.z.literal(false) }),
        zod_1.z.strictObject({ collect: zod_1.z.literal(true), custom_field_key: CustomFieldKey }),
    ])
        .optional(),
});
const QuestionResource = zod_1.z.object({
    key: zod_1.z.string(),
    label: zod_1.z.string().nullable(),
    optional: zod_1.z.boolean(),
});
const CollectionResource = zod_1.z.object({
    collect: zod_1.z.literal(true),
    custom_field_key: zod_1.z.string(),
});
const ShippingResource = zod_1.z.object({
    collect: zod_1.z.literal(true),
    /** Absent means everywhere, the same way it does on the way in. */
    allowed_countries: zod_1.z.array(zod_1.z.string()).optional(),
    name: zod_1.z.object({ custom_field_key: zod_1.z.string() }),
    address: zod_1.z.object({ custom_field_key: zod_1.z.string() }),
});
const CheckoutConfigResource = zod_1.z.object({
    tier_id: zod_1.z.string(),
    custom_fields: zod_1.z.array(QuestionResource),
    shipping: ShippingResource.optional(),
    tax_number: zod_1.z.object({ collect: zod_1.z.literal(true) }).optional(),
    phone: CollectionResource.optional(),
});
const CheckoutConfigResponse = zod_1.z.object({
    tiers_checkout_config: zod_1.z.array(CheckoutConfigResource),
});
/** One resource per tier, so a browse and a read differ only in how many come back. */
exports.toCheckoutConfigResponse = zod_1.z
    .array(models_1.TierCheckoutConfig)
    .transform((configs) => ({
    tiers_checkout_config: configs.map((config) => ({
        tier_id: config.tierId,
        custom_fields: config.customFields,
        // A block appears only when the tier collects that thing, so a client reads
        // presence rather than a flag it would have to check.
        ...(config.shipping
            ? {
                shipping: {
                    collect: true,
                    ...(config.shipping.allowedCountries
                        ? { allowed_countries: config.shipping.allowedCountries }
                        : {}),
                    name: { custom_field_key: config.shipping.nameCustomFieldKey },
                    address: { custom_field_key: config.shipping.addressCustomFieldKey },
                },
            }
            : {}),
        ...(config.taxNumber ? { tax_number: { collect: true } } : {}),
        ...(config.phone
            ? {
                phone: {
                    collect: true,
                    custom_field_key: config.phone.customFieldKey,
                },
            }
            : {}),
    })),
}))
    .pipe(CheckoutConfigResponse);
/**
 * What a tier asks a member for, as the tier payload carries it.
 *
 * The same rows as the publisher's resource above, minus everything about where a value
 * lands. A member supplies a delivery address rather than a value for a named field, and
 * which field holds it is the publisher's business; naming it here would invite a client
 * to write there directly. The tax number goes too, because the processor keeps one
 * against the customer it invoices and Reedito never stores it. So do the checkout
 * questions, which a tier change does not draw.
 *
 * Not named for the collection, deliberately: a collection in this domain is a collected
 * thing together with the field it lands in, and that second half is exactly the part
 * this drops.
 */
const TierRequirements = zod_1.z.object({
    /**
     * A block appears only when the tier asks for that thing, and says so as well, the same
     * way the publisher's resource does. Presence and the flag agree, so a client may read
     * whichever it finds clearer.
     *
     * Neither says whether a thing may be skipped, because nothing here may be: everything
     * a tier requires is required. Collection a member could decline is the change that
     * would need a field of its own rather than a new reading of these two.
     */
    shipping: zod_1.z
        .object({
        collect: zod_1.z.literal(true),
        /** Absent means everywhere the processor ships, the same as for a publisher. */
        allowed_countries: zod_1.z.array(zod_1.z.string()).optional(),
    })
        .optional(),
    phone: zod_1.z.object({ collect: zod_1.z.literal(true) }).optional(),
});
/**
 * Keyed by tier, because the payload this joins onto is a list of tiers and a lookup is
 * the only thing it needs. Tiers a publisher has never set up are absent, and a tier that
 * collects only a tax number resolves to nothing asked.
 */
function requirementsByTier(configs) {
    return new Map(configs.map((config) => [
        config.tierId,
        TierRequirements.parse({
            ...(config.shipping
                ? {
                    shipping: {
                        collect: true,
                        ...(config.shipping.allowedCountries
                            ? { allowed_countries: config.shipping.allowedCountries }
                            : {}),
                    },
                }
                : {}),
            ...(config.phone ? { phone: { collect: true } } : {}),
        }),
    ]));
}
