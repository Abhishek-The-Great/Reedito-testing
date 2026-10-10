"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Gift = void 0;
const luxon_1 = require("luxon");
const constants_1 = require("./constants");
const MS_PER_DAY = 24 * 60 * 60 * 1000;
function calculateGiftExpiration(anchor, timeZone) {
    return luxon_1.DateTime.fromJSDate(anchor, { zone: timeZone })
        .plus({ days: constants_1.GIFT_EXPIRY_DAYS })
        .endOf('day')
        .toJSDate();
}
class Gift {
    token;
    buyerEmail;
    buyerMemberId;
    buyerName;
    recipientName;
    personalMessage;
    redeemerMemberId;
    tierId;
    cadence;
    duration;
    currency;
    amount;
    stripeCheckoutSessionId;
    stripePaymentIntentId;
    checkoutStartedAt;
    consumesAt;
    expiresAt;
    status;
    purchasedAt;
    redeemedAt;
    consumedAt;
    expiredAt;
    refundedAt;
    consumesSoonReminderSentAt;
    constructor(data) {
        this.token = data.token;
        this.buyerEmail = data.buyerEmail;
        this.buyerMemberId = data.buyerMemberId;
        this.buyerName = data.buyerName ?? null;
        this.recipientName = data.recipientName ?? null;
        this.personalMessage = data.personalMessage ?? null;
        this.redeemerMemberId = data.redeemerMemberId;
        this.tierId = data.tierId;
        this.cadence = data.cadence;
        this.duration = data.duration;
        this.currency = data.currency;
        this.amount = data.amount;
        this.stripeCheckoutSessionId = data.stripeCheckoutSessionId;
        this.stripePaymentIntentId = data.stripePaymentIntentId;
        this.checkoutStartedAt = data.checkoutStartedAt ?? null;
        this.consumesAt = data.consumesAt;
        this.purchasedAt = data.purchasedAt;
        this.expiresAt = data.expiresAt;
        this.status = data.status;
        this.redeemedAt = data.redeemedAt;
        this.consumedAt = data.consumedAt;
        this.expiredAt = data.expiredAt;
        this.refundedAt = data.refundedAt;
        this.consumesSoonReminderSentAt = data.consumesSoonReminderSentAt ?? null;
    }
    static fromPurchase(data) {
        const { expiryTimeZone, ...giftData } = data;
        return new Gift({
            ...giftData,
            redeemerMemberId: null,
            consumesAt: null,
            checkoutStartedAt: data.purchasedAt,
            expiresAt: calculateGiftExpiration(data.purchasedAt, expiryTimeZone),
            status: 'purchased',
            purchasedAt: data.purchasedAt,
            redeemedAt: null,
            consumedAt: null,
            expiredAt: null,
            refundedAt: null,
            consumesSoonReminderSentAt: null,
        });
    }
    static fromCheckout(data) {
        const { expiryAnchor, expiryTimeZone, ...giftData } = data;
        return new Gift({
            ...giftData,
            redeemerMemberId: null,
            stripeCheckoutSessionId: null,
            stripePaymentIntentId: null,
            checkoutStartedAt: new Date(),
            consumesAt: null,
            expiresAt: expiryAnchor ? calculateGiftExpiration(expiryAnchor, expiryTimeZone) : null,
            status: 'payment_pending',
            purchasedAt: null,
            redeemedAt: null,
            consumedAt: null,
            expiredAt: null,
            refundedAt: null,
            consumesSoonReminderSentAt: null,
        });
    }
    completePurchase(data) {
        if (this.status !== 'payment_pending') {
            return null;
        }
        const { expiryTimeZone, ...purchaseData } = data;
        return new Gift({
            ...this,
            ...purchaseData,
            expiresAt: this.expiresAt ?? calculateGiftExpiration(data.purchasedAt, expiryTimeZone),
            status: 'purchased',
        });
    }
    bindCheckoutSession(checkoutSessionId) {
        if (this.status !== 'payment_pending' || this.stripeCheckoutSessionId !== null) {
            return null;
        }
        return new Gift({
            ...this,
            stripeCheckoutSessionId: checkoutSessionId,
        });
    }
    isRedeemed() {
        return this.redeemedAt !== null;
    }
    isExpired() {
        return this.expiredAt !== null;
    }
    isRefunded() {
        return this.refundedAt !== null;
    }
    isConsumed() {
        return this.consumedAt !== null;
    }
    // Gifts are only marked expired when the cleanup job next runs, so callers
    // that must not act on a lapsed gift compare against the deadline itself.
    // Matches the job's own `expires_at:<now` boundary.
    isPastClaimDeadline(now = new Date()) {
        return this.expiresAt !== null && now > this.expiresAt;
    }
    checkRedeemable(memberStatus, now = new Date()) {
        if (this.status === 'payment_pending') {
            return { redeemable: false, reason: 'payment-pending' };
        }
        if (this.isRedeemed()) {
            return { redeemable: false, reason: 'redeemed' };
        }
        if (this.isConsumed()) {
            return { redeemable: false, reason: 'consumed' };
        }
        if (this.isRefunded()) {
            return { redeemable: false, reason: 'refunded' };
        }
        if (this.isExpired() || this.isPastClaimDeadline(now)) {
            return { redeemable: false, reason: 'expired' };
        }
        if (memberStatus && memberStatus !== 'free') {
            return { redeemable: false, reason: 'paid-member' };
        }
        return { redeemable: true };
    }
    redeem({ memberId, redeemedAt = new Date() }) {
        const consumesAt = new Date(redeemedAt);
        if (this.cadence === 'year') {
            consumesAt.setFullYear(consumesAt.getFullYear() + this.duration);
        }
        else {
            consumesAt.setMonth(consumesAt.getMonth() + this.duration);
        }
        return new Gift({
            ...this,
            redeemerMemberId: memberId,
            redeemedAt,
            consumesAt,
            status: 'redeemed',
        });
    }
    checkReassignable() {
        if (this.isRefunded()) {
            return { reassignable: false, reason: 'refunded' };
        }
        if (this.isConsumed()) {
            return { reassignable: false, reason: 'consumed' };
        }
        if (this.isExpired()) {
            return { reassignable: false, reason: 'expired' };
        }
        if (this.status !== 'redeemed' || this.redeemedAt === null) {
            return { reassignable: false, reason: 'unredeemed' };
        }
        if (this.consumesAt === null) {
            return { reassignable: false, reason: 'missing-consumes-at' };
        }
        if (this.redeemerMemberId !== null) {
            return { reassignable: false, reason: 'assigned' };
        }
        return { reassignable: true };
    }
    reassignRedeemer(newMemberId) {
        return new Gift({
            ...this,
            redeemerMemberId: newMemberId,
        });
    }
    refund() {
        if (this.isRefunded()) {
            return null;
        }
        return new Gift({
            ...this,
            status: 'refunded',
            refundedAt: new Date(),
        });
    }
    consume() {
        if (this.isConsumed()) {
            return null;
        }
        return new Gift({
            ...this,
            status: 'consumed',
            consumedAt: new Date(),
        });
    }
    expire() {
        if (this.isExpired()) {
            return null;
        }
        return new Gift({
            ...this,
            status: 'expired',
            expiredAt: new Date(),
        });
    }
    /** Returns the reminder time, or null when the gift has no consumption date. */
    reminderDueAt() {
        if (!this.consumesAt) {
            return null;
        }
        return new Date(this.consumesAt.getTime() - constants_1.GIFT_REMINDER_LEAD_DAYS * MS_PER_DAY);
    }
    remind() {
        if (this.consumesSoonReminderSentAt !== null) {
            return null;
        }
        return new Gift({
            ...this,
            consumesSoonReminderSentAt: new Date(),
        });
    }
}
exports.Gift = Gift;
