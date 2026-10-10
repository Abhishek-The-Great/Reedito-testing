"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DbGift = exports.GiftStatusSchema = exports.GiftCadenceSchema = void 0;
const zod_1 = require("zod");
const date_1 = require("../../lib/db-types/date");
exports.GiftCadenceSchema = zod_1.z.enum(['month', 'year']);
exports.GiftStatusSchema = zod_1.z.enum([
    'payment_pending',
    'purchased',
    'redeemed',
    'consumed',
    'expired',
    'refunded',
]);
/**
 * The persisted gift row. Bookshelf remains the persistence implementation, but
 * values read through it are still runtime data and are validated before they
 * become trusted gift-domain values.
 */
exports.DbGift = zod_1.z.object({
    token: zod_1.z.string(),
    buyer_email: zod_1.z.string().nullable(),
    buyer_member_id: zod_1.z.string().nullable(),
    buyer_name: zod_1.z.string().nullable().default(null),
    recipient_name: zod_1.z.string().nullable().default(null),
    personal_message: zod_1.z.string().nullable().default(null),
    redeemer_member_id: zod_1.z.string().nullable(),
    tier_id: zod_1.z.string(),
    cadence: exports.GiftCadenceSchema,
    duration: zod_1.z.number().int().nonnegative(),
    currency: zod_1.z.string(),
    amount: zod_1.z.number().int().nonnegative(),
    stripe_checkout_session_id: zod_1.z.string().nullable(),
    stripe_payment_intent_id: zod_1.z.string().nullable(),
    checkout_started_at: date_1.DbDate.nullable().default(null),
    consumes_at: date_1.DbDate.nullable(),
    expires_at: date_1.DbDate.nullable(),
    status: exports.GiftStatusSchema,
    purchased_at: date_1.DbDate.nullable(),
    redeemed_at: date_1.DbDate.nullable(),
    consumed_at: date_1.DbDate.nullable(),
    expired_at: date_1.DbDate.nullable(),
    refunded_at: date_1.DbDate.nullable(),
    consumes_soon_reminder_sent_at: date_1.DbDate.nullable().default(null),
});
