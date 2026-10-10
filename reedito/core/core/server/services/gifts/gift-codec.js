"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.giftCodec = void 0;
exports.decodeGiftRow = decodeGiftRow;
exports.encodeGift = encodeGift;
const zod_1 = require("zod");
const gift_1 = require("./gift");
const gift_schema_1 = require("./gift-schema");
exports.giftCodec = zod_1.z.codec(gift_schema_1.DbGift, zod_1.z.instanceof(gift_1.Gift), {
    decode: (row) => new gift_1.Gift({
        token: row.token,
        buyerEmail: row.buyer_email,
        buyerMemberId: row.buyer_member_id,
        buyerName: row.buyer_name,
        recipientName: row.recipient_name,
        personalMessage: row.personal_message,
        redeemerMemberId: row.redeemer_member_id,
        tierId: row.tier_id,
        cadence: row.cadence,
        duration: row.duration,
        currency: row.currency,
        amount: row.amount,
        stripeCheckoutSessionId: row.stripe_checkout_session_id,
        stripePaymentIntentId: row.stripe_payment_intent_id,
        checkoutStartedAt: row.checkout_started_at,
        consumesAt: row.consumes_at,
        expiresAt: row.expires_at,
        status: row.status,
        purchasedAt: row.purchased_at,
        redeemedAt: row.redeemed_at,
        consumedAt: row.consumed_at,
        expiredAt: row.expired_at,
        refundedAt: row.refunded_at,
        consumesSoonReminderSentAt: row.consumes_soon_reminder_sent_at,
    }),
    encode: (gift) => ({
        token: gift.token,
        buyer_email: gift.buyerEmail,
        buyer_member_id: gift.buyerMemberId,
        buyer_name: gift.buyerName,
        recipient_name: gift.recipientName,
        personal_message: gift.personalMessage,
        redeemer_member_id: gift.redeemerMemberId,
        tier_id: gift.tierId,
        cadence: gift.cadence,
        duration: gift.duration,
        currency: gift.currency,
        amount: gift.amount,
        stripe_checkout_session_id: gift.stripeCheckoutSessionId,
        stripe_payment_intent_id: gift.stripePaymentIntentId,
        checkout_started_at: gift.checkoutStartedAt,
        consumes_at: gift.consumesAt,
        expires_at: gift.expiresAt,
        status: gift.status,
        purchased_at: gift.purchasedAt,
        redeemed_at: gift.redeemedAt,
        consumed_at: gift.consumedAt,
        expired_at: gift.expiredAt,
        refunded_at: gift.refundedAt,
        consumes_soon_reminder_sent_at: gift.consumesSoonReminderSentAt,
    }),
});
function decodeGiftRow(input) {
    return exports.giftCodec.parse(input);
}
function encodeGift(gift) {
    const row = zod_1.z.encode(exports.giftCodec, gift);
    // DbDate encodes to Date at runtime, but z.encode types the row as DbGift input,
    // whose date fields also accept strings and numbers. Parse to narrow it to GiftRow.
    return gift_schema_1.DbGift.parse(row);
}
