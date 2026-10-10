"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectedByPort = exports.CompletedSession = void 0;
const zod_1 = require("zod");
const checkout_1 = require("@reedito/checkout");
/**
 * What Reedito reads off a completed session.
 *
 * `shipping` is where the address lives at Reedito's pinned Stripe API version; later
 * versions moved it to `collected_information.shipping_details`. An Event is an immutable
 * snapshot rendered at the account's version, so nothing in a payload would warn us if
 * that pin ever changed.
 *
 * A tax number is deliberately not read: Stripe keeps it against the customer it invoices
 * and Reedito never stores one.
 */
const Collected = zod_1.z
    .string()
    .nullish()
    .transform((given) => (given && given.trim() !== '' ? given : undefined));
exports.CompletedSession = zod_1.z
    .object({
    custom_fields: zod_1.z
        .array(zod_1.z
        .object({
        key: zod_1.z.string().nullish(),
        text: zod_1.z.object({ value: Collected }).nullish(),
    })
        .nullable())
        .nullish(),
    shipping: zod_1.z
        .object({
        name: Collected,
        address: zod_1.z.record(zod_1.z.string(), Collected).nullish(),
    })
        .nullish(),
    customer_details: zod_1.z.object({ phone: Collected }).nullish(),
})
    .loose();
/** Our address type needs at least one part; an empty value would erase what is there. */
function addressValue(address) {
    const value = Object.fromEntries(Object.entries(address ?? {}).filter((entry) => entry[1] !== undefined));
    return Object.keys(value).length > 0 ? value : undefined;
}
const PORT_VALUES = {
    // Stripe returns the recipient's name alongside the address rather than as part of it,
    // while Reedito keeps a name and an address in two separate custom fields. So the name is
    // carried back separately here, under its own name, to be routed to its own field.
    shipping_name: (session) => session.shipping?.name,
    shipping_address: (session) => addressValue(session.shipping?.address),
    phone: (session) => session.customer_details?.phone,
};
/**
 * Everything a completed checkout gives back, as a list of pairs: the name Stripe used for
 * a value, and the value itself. Answers to questions and values Stripe collected on its
 * own both come back this way, because both are saved by the same route afterwards.
 *
 * Order matters. The values Stripe collected come last, so that if a question's answer and
 * a collected value are both saved into the same custom field, the collected value is the
 * one the field ends up holding.
 */
exports.collectedByPort = exports.CompletedSession.transform((session) => {
    const answers = (session.custom_fields ?? [])
        .filter((field) => Boolean(field?.key && field.text?.value))
        .map((field) => ({ port: field.key, value: field.text.value }));
    const ports = checkout_1.STRIPE_PORTS.map((port) => ({ port, value: PORT_VALUES[port](session) })).filter((entry) => entry.value !== undefined);
    return [...answers, ...ports];
});
