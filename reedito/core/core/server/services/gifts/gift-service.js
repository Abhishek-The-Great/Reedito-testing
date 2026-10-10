"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GiftService = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const errors_1 = __importDefault(require("@tryghost/errors"));
const logging_1 = __importDefault(require("@tryghost/logging"));
const luxon_1 = require("luxon");
const zod_1 = require("zod");
const gift_1 = require("./gift");
const gift_schema_1 = require("./gift-schema");
const tpl_1 = __importDefault(require("@tryghost/tpl"));
const constants_1 = require("./constants");
const gift_checkout_offer_1 = require("./gift-checkout-offer");
const DEFAULT_TIMEZONE = 'Etc/UTC';
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const GIFT_REMINDER_LEAD_MS = constants_1.GIFT_REMINDER_LEAD_DAYS * MS_PER_DAY;
const GIFT_REMINDER_FLOOR_MS = constants_1.GIFT_REMINDER_FLOOR_DAYS * MS_PER_DAY;
const GIFT_NAME_MAX_LENGTH = 191;
const GIFT_EMAIL_MAX_LENGTH = 191;
const GIFT_CHECKOUT_MESSAGE_MAX_LENGTH = 250;
const GIFT_CHECKOUT_RETENTION_DAYS = 30;
const errorMessages = {
    giftNotFound: 'This gift does not exist.',
    giftAlreadyRedeemed: 'This gift has already been redeemed.',
    giftConsumed: 'This gift has already been consumed.',
    giftExpired: 'This gift has expired.',
    giftRefunded: 'This gift has been refunded.',
    paidMember: 'You already have an active subscription.',
    giftInvalidReassignStatus: 'This gift does not have a reassignable status.',
    giftInvalidReassignMember: 'Member already has an active subscription.',
    giftAlreadyAssigned: 'This gift is already assigned to another member.',
    giftMissingConsumesAt: 'This gift is missing a "consumes at" date.',
    giftMemberAlreadyHasGift: 'Member already has a different active gift attached.',
};
const GiftPurchaseDataSchema = zod_1.z.object({
    token: zod_1.z.string().min(1),
    buyerEmail: zod_1.z.string().min(1),
    stripeCustomerId: zod_1.z.string().min(1).nullable(),
    tierId: zod_1.z.string().min(1),
    cadence: gift_schema_1.GiftCadenceSchema,
    duration: zod_1.z.number().int().positive(),
    currency: zod_1.z.string().min(1),
    amount: zod_1.z.number().int().nonnegative(),
    stripeCheckoutSessionId: zod_1.z.string().min(1),
    stripePaymentIntentId: zod_1.z.string().min(1),
});
const StripeBuyerEmailSchema = zod_1.z.unknown().transform((value) => {
    if (typeof value !== 'string') {
        return null;
    }
    const email = value.trim();
    return email && email.length <= GIFT_EMAIL_MAX_LENGTH ? email : null;
});
const GiftPaymentCompletionSchema = zod_1.z.object({
    giftId: zod_1.z.string().min(1),
    buyerEmail: StripeBuyerEmailSchema,
    stripeCustomerId: zod_1.z.string().min(1).nullable(),
    stripeCheckoutSessionId: zod_1.z.string().min(1),
    stripePaymentIntentId: zod_1.z.string().min(1),
});
const NullableCheckoutStringSchema = (max) => zod_1.z.preprocess((value) => (typeof value === 'string' && value.trim() === '' ? null : value), zod_1.z.string().trim().max(max).nullable().optional().default(null));
const EmptyCheckoutStringSchema = zod_1.z.preprocess((value) => (typeof value === 'string' && value.trim() === '' ? null : value), zod_1.z.null().optional().default(null));
const RequiredCheckoutStringSchema = (max) => zod_1.z.string().trim().min(1).max(max);
const CheckoutBuyerEmailSchema = zod_1.z.string().trim().email().max(GIFT_EMAIL_MAX_LENGTH);
const GiftCheckoutDeliverySchema = zod_1.z.discriminatedUnion('deliveryMethod', [
    zod_1.z.object({
        deliveryMethod: zod_1.z.literal('link'),
        recipientEmail: EmptyCheckoutStringSchema,
        recipientName: EmptyCheckoutStringSchema,
        personalMessage: EmptyCheckoutStringSchema,
        deliveryDate: EmptyCheckoutStringSchema,
        buyerName: NullableCheckoutStringSchema(GIFT_NAME_MAX_LENGTH),
    }),
    zod_1.z.object({
        deliveryMethod: zod_1.z.literal('email'),
        recipientEmail: zod_1.z.string().trim().email().max(GIFT_EMAIL_MAX_LENGTH),
        recipientName: NullableCheckoutStringSchema(GIFT_NAME_MAX_LENGTH),
        personalMessage: NullableCheckoutStringSchema(GIFT_CHECKOUT_MESSAGE_MAX_LENGTH),
        deliveryDate: zod_1.z
            .string()
            .trim()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .nullable()
            .optional()
            .default(null),
        buyerName: RequiredCheckoutStringSchema(GIFT_NAME_MAX_LENGTH),
    }),
]);
class GiftService {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async startCheckout(input) {
        const parsedBuyerEmail = CheckoutBuyerEmailSchema.safeParse(input.buyer.email);
        if (!parsedBuyerEmail.success) {
            throw new errors_1.default.BadRequestError({
                message: 'Bad Request.',
                context: `Invalid gift buyer email: ${parsedBuyerEmail.error.issues[0].message}`,
            });
        }
        const buyerEmail = parsedBuyerEmail.success ? parsedBuyerEmail.data : input.buyer.email;
        const parsedDelivery = GiftCheckoutDeliverySchema.safeParse({
            deliveryMethod: input.deliveryMethod ?? 'link',
            recipientEmail: input.recipientEmail,
            recipientName: input.recipientName,
            buyerName: input.buyerName,
            personalMessage: input.personalMessage,
            deliveryDate: input.deliveryDate,
        });
        if (!parsedDelivery.success) {
            const issue = parsedDelivery.error.issues[0];
            throw new errors_1.default.BadRequestError({
                message: 'Bad Request.',
                context: `Invalid gift delivery data: ${issue.message}`,
            });
        }
        const delivery = parsedDelivery.data;
        const scheduledDelivery = this.resolveDeliveryDate(delivery.deliveryDate);
        if (input.offerId) {
            throw new errors_1.default.BadRequestError({
                message: 'Bad Request.',
                context: 'Offers cannot be applied to gift subscriptions',
            });
        }
        if (!input.tierId) {
            throw new errors_1.default.BadRequestError({
                message: 'Bad Request.',
                context: 'Expected offerId or tierId, received none',
            });
        }
        const resolvedDuration = (0, gift_checkout_offer_1.resolveGiftDuration)(input);
        let tier;
        try {
            tier = await this.deps.tiersService.api.read(input.tierId);
        }
        catch (err) {
            logging_1.default.error(err);
            tier = null;
        }
        if (!tier) {
            throw new errors_1.default.BadRequestError({
                message: 'This tier does not exist.',
                context: `Tier with id "${input.tierId}" not found`,
            });
        }
        if (tier.status === 'archived') {
            throw new errors_1.default.NoPermissionError({
                message: 'This tier is archived.',
            });
        }
        const plan = (0, gift_checkout_offer_1.validateGiftCheckoutOffer)({
            tier,
            portalPlans: this.deps.settingsCache.get('portal_plans'),
            offer: resolvedDuration,
        });
        const cadence = plan.cadence;
        const duration = plan.duration;
        const totalMonths = plan.totalMonths;
        const amount = plan.amount;
        const tierId = typeof tier.id === 'string' ? tier.id : tier.id.toHexString();
        const token = this.generateToken();
        const successUrl = new URL(input.successUrl);
        successUrl.searchParams.set('stripe', 'gift-purchase-success');
        successUrl.searchParams.set('gift_token', token);
        successUrl.searchParams.set('gift_tier', tierId);
        successUrl.searchParams.set('gift_cadence', cadence);
        successUrl.searchParams.set('gift_delivery', delivery.deliveryMethod);
        if (scheduledDelivery.date && scheduledDelivery.scheduledAt) {
            successUrl.searchParams.set('gift_delivery_date', scheduledDelivery.date);
            // The exact send instant, so the success page can tell "still
            // scheduled" from "already sent" without re-deriving the send
            // hour client-side.
            successUrl.searchParams.set('gift_scheduled_at', String(scheduledDelivery.scheduledAt.getTime()));
        }
        if (totalMonths !== undefined) {
            successUrl.searchParams.set('gift_duration', String(totalMonths));
        }
        const buyer = { ...input.buyer, email: buyerEmail };
        const customerId = buyer.isAuthenticated
            ? await this.deps.checkoutAdapter.getCustomerId(buyer)
            : null;
        const gift = gift_1.Gift.fromCheckout({
            token,
            buyerEmail,
            buyerMemberId: buyer.isAuthenticated ? buyer.memberId : null,
            buyerName: delivery.buyerName,
            recipientName: delivery.recipientName,
            personalMessage: delivery.personalMessage,
            expiryAnchor: scheduledDelivery.scheduledAt,
            expiryTimeZone: this.siteZone(),
            tierId,
            cadence,
            duration,
            currency: tier.currency.toLowerCase(),
            amount,
        });
        const giftId = await this.deps.giftRepository.transaction(async (transacting) => {
            const id = await this.deps.giftRepository.create(gift, { transacting });
            if (delivery.deliveryMethod === 'email') {
                await this.deps.giftDeliveryService.createForCheckout({
                    giftId: id,
                    recipientEmail: delivery.recipientEmail,
                    scheduledAt: scheduledDelivery.scheduledAt,
                }, { transacting });
            }
            return id;
        });
        let session;
        try {
            session = await this.deps.checkoutAdapter.createSession({
                amount,
                currency: tier.currency.toLowerCase(),
                tierName: tier.name,
                cadence,
                duration,
                metadata: { ghost_gift_id: giftId },
                successUrl: successUrl.toString(),
                cancelUrl: input.cancelUrl,
                customerId,
                customerEmail: customerId ? null : buyerEmail,
                idempotencyKey: giftId,
            });
        }
        catch (err) {
            try {
                await this.deps.giftRepository.deletePendingCheckout(giftId);
            }
            catch (cleanupError) {
                logging_1.default.error(cleanupError, `Failed to clean up gift checkout ${giftId} after Stripe session creation failed`);
            }
            throw err;
        }
        const bound = gift.bindCheckoutSession(session.id);
        if (!bound) {
            throw new errors_1.default.InternalServerError({
                message: `Failed to bind checkout session to gift: ${giftId}`,
            });
        }
        await this.deps.giftRepository.update(bound);
        return { url: session.url };
    }
    generateToken() {
        /**
         * Combinations: 62^12 ≈ 3.23 × 10^21 (~3.23 sextillion)
         * Entropy:      12 × log2(62) ≈ 71.45 bits
         */
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let token = '';
        for (let i = 0; i < 12; i++) {
            token += alphabet[node_crypto_1.default.randomInt(alphabet.length)];
        }
        return token;
    }
    async completePurchase(input) {
        if ('giftId' in input) {
            return this.completePendingPurchase(input);
        }
        return this.completeLegacyPurchase(input);
    }
    // The publication timezone setting, falling back to UTC when unset or
    // when the bundled tz data doesn't know the zone — an unknown name would
    // otherwise resolve to the host's zone and date gift lifecycle values
    // against the wrong calendar.
    siteZone() {
        const timezoneSetting = this.deps.settingsCache.get('timezone');
        const zone = typeof timezoneSetting === 'string' && timezoneSetting ? timezoneSetting : DEFAULT_TIMEZONE;
        if (zone !== DEFAULT_TIMEZONE && !luxon_1.DateTime.now().setZone(zone).isValid) {
            logging_1.default.warn(`Unknown publication timezone "${zone}", dating gift lifecycle values in ${DEFAULT_TIMEZONE}`);
            return DEFAULT_TIMEZONE;
        }
        return zone;
    }
    resolveDeliveryDate(deliveryDate) {
        if (!deliveryDate) {
            return { date: null, scheduledAt: null };
        }
        const zone = this.siteZone();
        const today = luxon_1.DateTime.now().setZone(zone).startOf('day');
        const selected = luxon_1.DateTime.fromFormat(deliveryDate, 'yyyy-MM-dd', { zone }).startOf('day');
        if (!selected.isValid ||
            selected.toMillis() < today.toMillis() ||
            selected.toMillis() > today.plus({ days: constants_1.GIFT_MAX_SCHEDULE_DAYS }).toMillis()) {
            throw new errors_1.default.BadRequestError({
                message: 'Bad Request.',
                context: `Gift delivery date must be today or within the next ${constants_1.GIFT_MAX_SCHEDULE_DAYS} days`,
            });
        }
        if (selected.hasSame(today, 'day')) {
            return { date: null, scheduledAt: null };
        }
        return {
            date: deliveryDate,
            scheduledAt: selected.set({ hour: constants_1.GIFT_SEND_HOUR }).toJSDate(),
        };
    }
    async completePendingPurchase(input) {
        const parsed = GiftPaymentCompletionSchema.safeParse(input);
        if (!parsed.success) {
            const issue = parsed.error.issues[0];
            throw new errors_1.default.ValidationError({
                message: 'Invalid gift purchase data.',
                property: issue.path.join('.'),
                context: issue.message,
            });
        }
        const data = parsed.data;
        const purchasedAt = new Date();
        const member = data.stripeCustomerId
            ? await this.deps.memberRepository.get({ customer_id: data.stripeCustomerId })
            : null;
        const completed = await this.deps.giftRepository.transaction(async (transacting) => {
            const gift = await this.deps.giftRepository.getById(data.giftId, {
                transacting,
                forUpdate: true,
            });
            if (!gift) {
                logging_1.default.error({
                    event: { name: 'gift_purchase.completion_gift_missing' },
                    giftId: data.giftId,
                    stripeCheckoutSessionId: data.stripeCheckoutSessionId,
                    stripePaymentIntentId: data.stripePaymentIntentId,
                }, 'Paid checkout completion has no matching gift');
                return null;
            }
            if (gift.status !== 'payment_pending') {
                return null;
            }
            if (gift.stripeCheckoutSessionId &&
                gift.stripeCheckoutSessionId !== data.stripeCheckoutSessionId) {
                throw new errors_1.default.ValidationError({ message: 'Checkout session does not match gift.' });
            }
            const buyerEmail = gift.buyerEmail ?? data.buyerEmail ?? member?.get('email') ?? null;
            if (!buyerEmail) {
                throw new errors_1.default.ValidationError({
                    message: 'Invalid gift purchase data.',
                    property: 'buyerEmail',
                    context: 'A purchased gift requires a buyer email',
                });
            }
            // The pre-created gift owns the checkout price. Stripe's total may
            // include automatic tax, so completion only adds settlement facts.
            const purchased = gift.completePurchase({
                buyerEmail,
                buyerMemberId: member?.id ?? gift.buyerMemberId,
                stripeCheckoutSessionId: data.stripeCheckoutSessionId,
                stripePaymentIntentId: data.stripePaymentIntentId,
                purchasedAt,
                expiryTimeZone: this.siteZone(),
            });
            if (!purchased) {
                return null;
            }
            await this.deps.giftRepository.update(purchased, { transacting });
            return purchased;
        });
        if (!completed) {
            return false;
        }
        let delivery = null;
        try {
            delivery = await this.deps.giftDeliveryService.dispatchForGift({ giftId: data.giftId });
        }
        catch (err) {
            logging_1.default.error({
                event: { name: 'gift_delivery.dispatch_failed' },
                err,
                giftId: data.giftId,
            }, 'Failed to dispatch purchased gift delivery');
        }
        await this.sendPurchaseNotifications(completed, member, delivery);
        return true;
    }
    async completeLegacyPurchase(input) {
        const parsed = GiftPurchaseDataSchema.safeParse(input);
        if (!parsed.success) {
            const issue = parsed.error.issues[0];
            throw new errors_1.default.ValidationError({
                message: 'Invalid gift purchase data.',
                property: issue.path.join('.'),
                context: issue.message,
            });
        }
        const data = parsed.data;
        const purchasedAt = new Date();
        if (await this.deps.giftRepository.existsByCheckoutSessionId(data.stripeCheckoutSessionId)) {
            return false;
        }
        const member = data.stripeCustomerId
            ? await this.deps.memberRepository.get({ customer_id: data.stripeCustomerId })
            : null;
        const gift = gift_1.Gift.fromPurchase({
            token: data.token,
            buyerEmail: data.buyerEmail,
            buyerMemberId: member?.id ?? null,
            tierId: data.tierId,
            cadence: data.cadence,
            duration: data.duration,
            currency: data.currency,
            amount: data.amount,
            stripeCheckoutSessionId: data.stripeCheckoutSessionId,
            stripePaymentIntentId: data.stripePaymentIntentId,
            purchasedAt,
            expiryTimeZone: this.siteZone(),
        });
        await this.deps.giftRepository.create(gift);
        await this.sendPurchaseNotifications(gift, member, null);
        return true;
    }
    async sendPurchaseNotifications(gift, member, delivery) {
        let tier;
        try {
            tier = await this.deps.tiersService.api.read(gift.tierId);
        }
        catch (err) {
            logging_1.default.error({
                event: { name: 'gift_purchase_notifications.tier_read_failed' },
                err,
                tierId: gift.tierId,
            }, 'Failed to read tier for gift purchase notifications');
            return;
        }
        if (!tier) {
            logging_1.default.error({
                event: { name: 'gift_purchase_notifications.tier_missing' },
                tierId: gift.tierId,
            }, 'Tier not found for gift purchase notifications');
            return;
        }
        const buyerEmail = gift.buyerEmail ?? member?.get('email') ?? null;
        if (!buyerEmail) {
            logging_1.default.warn('Skipping purchase notifications because the buyer email is unavailable');
            return;
        }
        try {
            await this.deps.staffServiceEmails.notifyGiftPurchased({
                name: member?.get('name') ?? null,
                email: member?.get('email') ?? buyerEmail,
                memberId: member?.id ?? null,
                amount: gift.amount,
                currency: gift.currency,
                tierName: tier.name,
                cadence: gift.cadence,
                duration: gift.duration,
            });
        }
        catch (err) {
            logging_1.default.error('Failed to notify staff of gift purchase', err);
        }
        try {
            await this.deps.giftEmailService.sendPurchaseConfirmation({
                buyerEmail,
                token: gift.token,
                tierName: tier.name,
                cadence: gift.cadence,
                duration: gift.duration,
                expiresAt: gift.expiresAt,
                scheduledAt: delivery?.scheduledAt ?? null,
                recipientEmail: delivery?.recipientEmail ?? null,
            });
        }
        catch (err) {
            logging_1.default.error('Failed to send gift purchase confirmation email', err);
        }
    }
    assertRedeemable(gift, memberStatus) {
        const redeemableCheck = gift.checkRedeemable(memberStatus);
        if (!redeemableCheck.redeemable) {
            switch (redeemableCheck.reason) {
                case 'payment-pending':
                    throw new errors_1.default.NotFoundError({
                        message: (0, tpl_1.default)(errorMessages.giftNotFound),
                        code: 'GIFT_NOT_FOUND',
                    });
                case 'redeemed':
                    throw new errors_1.default.BadRequestError({
                        message: (0, tpl_1.default)(errorMessages.giftAlreadyRedeemed),
                        code: 'GIFT_REDEEMED',
                    });
                case 'consumed':
                    throw new errors_1.default.BadRequestError({
                        message: (0, tpl_1.default)(errorMessages.giftConsumed),
                        code: 'GIFT_CONSUMED',
                    });
                case 'expired':
                    throw new errors_1.default.BadRequestError({
                        message: (0, tpl_1.default)(errorMessages.giftExpired),
                        code: 'GIFT_EXPIRED',
                    });
                case 'refunded':
                    throw new errors_1.default.BadRequestError({
                        message: (0, tpl_1.default)(errorMessages.giftRefunded),
                        code: 'GIFT_REFUNDED',
                    });
                case 'paid-member':
                    throw new errors_1.default.BadRequestError({
                        message: (0, tpl_1.default)(errorMessages.paidMember),
                        code: 'GIFT_PAID_MEMBER',
                    });
                default: {
                    const exhaustiveCheck = redeemableCheck.reason;
                    throw new errors_1.default.InternalServerError({
                        message: `Unhandled redeem failure reason: ${exhaustiveCheck}`,
                    });
                }
            }
        }
        return gift;
    }
    async getRedeemable(input) {
        const gift = await this.deps.giftRepository.getByToken(input.token);
        if (!gift) {
            throw new errors_1.default.NotFoundError({
                message: (0, tpl_1.default)(errorMessages.giftNotFound),
                code: 'GIFT_NOT_FOUND',
            });
        }
        this.assertRedeemable(gift, input.memberStatus);
        return this.serializeRedemption(gift);
    }
    async redeem(input) {
        const run = async (transacting) => {
            const { redeemed, member } = await this.redeemGift(input.token, input.memberId, {
                transacting,
                newMember: input.newMember,
            });
            const redemption = await this.serializeRedemption(redeemed, { transacting });
            return { redeemed, member, redemption };
        };
        const { redeemed, member, redemption } = input.transacting
            ? await run(input.transacting)
            : await this.deps.giftRepository.transaction(run);
        const notify = async () => {
            try {
                const tier = await this.deps.tiersService.api.read(redeemed.tierId);
                if (!tier) {
                    throw new errors_1.default.NotFoundError({ message: `Tier not found: ${redeemed.tierId}` });
                }
                await this.deps.staffServiceEmails.notifyGiftSubscriptionStarted({
                    memberId: member.id,
                    memberEmail: member.get('email'),
                    memberName: member.get('name'),
                    tierName: tier.name,
                    cadence: redeemed.cadence,
                    duration: redeemed.duration,
                    buyerEmail: redeemed.buyerEmail,
                });
            }
            catch (err) {
                logging_1.default.error('Failed to notify staff of gift redemption', err);
            }
            const reminderDueAt = redeemed.reminderDueAt();
            if (reminderDueAt) {
                await this.deps.giftReminderScheduler.scheduleAt(reminderDueAt.getTime(), {
                    giftToken: redeemed.token,
                });
            }
        };
        if (input.transacting) {
            // Only notify once the transaction has finished
            input.transacting.executionPromise.then(notify, () => { });
        }
        else {
            await notify();
        }
        return redemption;
    }
    async redeemGift(token, memberId, options) {
        const { transacting } = options;
        const member = await this.deps.memberRepository.get({ id: memberId }, { transacting, forUpdate: true });
        if (!member) {
            throw new errors_1.default.NotFoundError({ message: `Member not found: ${memberId}` });
        }
        const gift = await this.deps.giftRepository.getByToken(token, { transacting, forUpdate: true });
        if (!gift) {
            throw new errors_1.default.NotFoundError({
                message: (0, tpl_1.default)(errorMessages.giftNotFound),
                code: 'GIFT_NOT_FOUND',
            });
        }
        if (options.newMember) {
            this.assertRedeemable(gift, null);
        }
        else {
            this.assertRedeemable(gift, member.get('status'));
        }
        const redeemed = gift.redeem({ memberId });
        await this.deps.memberRepository.update({
            products: [
                {
                    id: redeemed.tierId,
                    expiry_at: redeemed.consumesAt,
                },
            ],
            status: 'gift',
        }, { id: memberId, transacting });
        await this.deps.giftRepository.update(redeemed, { transacting });
        await this.deps.giftDeliveryService.cancelPendingForGift(redeemed.token, { transacting });
        // Gift members receive the paid welcome email, as they receive access to paid content
        await this.deps.memberRepository.triggerMemberSignupAutomation(memberId, member.get('email'), 'paid', { transacting });
        return { redeemed, member };
    }
    async getActiveByMember(memberId, options = {}) {
        if (!memberId) {
            return null;
        }
        return this.deps.giftRepository.getActiveByMember(memberId, options);
    }
    async getActiveByMembers(memberIds, options = {}) {
        if (!memberIds || memberIds.length === 0) {
            return new Map();
        }
        return this.deps.giftRepository.getActiveByMembers(memberIds, options);
    }
    getRemainingActiveDays(gift, now = new Date()) {
        if (!gift.isRedeemed() || !gift.consumesAt || gift.isConsumed()) {
            return 0;
        }
        const diffDays = Math.ceil((gift.consumesAt.getTime() - now.getTime()) / MS_PER_DAY);
        return Math.max(0, diffDays);
    }
    async preparePaidContinuation({ memberId, memberStatus, }) {
        if (memberStatus !== 'gift') {
            throw new errors_1.default.BadRequestError({
                message: 'Bad Request.',
                context: 'Member does not have an active gift subscription',
            });
        }
        const gift = await this.getActiveByMember(memberId);
        if (!gift) {
            throw new errors_1.default.BadRequestError({
                message: 'Bad Request.',
                context: 'No active gift subscription found for member',
            });
        }
        const remainingDays = this.getRemainingActiveDays(gift);
        return {
            tierId: gift.tierId,
            cadence: gift.cadence,
            trialDays: remainingDays > 0 ? Math.min(remainingDays, 730) : null,
        };
    }
    async getMemberPresentations(memberIds) {
        const gifts = await this.getActiveByMembers(memberIds);
        const presentations = new Map();
        for (const [memberId, gift] of gifts) {
            presentations.set(memberId, {
                cadence: gift.cadence,
                currency: gift.currency,
                amount: gift.amount,
            });
        }
        return presentations;
    }
    async getPreview(token) {
        const gift = await this.deps.giftRepository.getByToken(token);
        if (!gift || gift.status === 'payment_pending') {
            return null;
        }
        const tier = await this.deps.tiersService.api.read(gift.tierId);
        if (!tier) {
            throw new errors_1.default.NotFoundError({ message: `Tier not found for gift: ${gift.token}` });
        }
        const tierJSON = tier.toJSON();
        return {
            cadence: gift.cadence,
            duration: gift.duration,
            tier: {
                id: tierJSON.id,
                name: tierJSON.name,
            },
        };
    }
    browsePurchaseEvents(options, filter) {
        return this.deps.giftRepository.browsePurchaseEvents(options, filter);
    }
    browseRedemptionEvents(options, filter) {
        return this.deps.giftRepository.browseRedemptionEvents(options, filter);
    }
    async reassignRedeemer(input) {
        const { giftId, memberId } = input;
        const run = async (transacting) => {
            const gift = await this.deps.giftRepository.getById(giftId, { transacting, forUpdate: true });
            if (!gift) {
                throw new errors_1.default.NotFoundError({ message: (0, tpl_1.default)(errorMessages.giftNotFound) });
            }
            if (gift.redeemerMemberId === memberId) {
                return gift;
            }
            const check = gift.checkReassignable();
            if (!check.reassignable) {
                switch (check.reason) {
                    case 'assigned':
                        throw new errors_1.default.BadRequestError({ message: (0, tpl_1.default)(errorMessages.giftAlreadyAssigned) });
                    case 'unredeemed':
                    case 'consumed':
                    case 'expired':
                    case 'refunded':
                        throw new errors_1.default.BadRequestError({
                            message: (0, tpl_1.default)(errorMessages.giftInvalidReassignStatus),
                        });
                    case 'missing-consumes-at':
                        throw new errors_1.default.BadRequestError({ message: (0, tpl_1.default)(errorMessages.giftMissingConsumesAt) });
                    default: {
                        const exhaustiveCheck = check.reason;
                        throw new errors_1.default.InternalServerError({
                            message: `Unhandled reassign failure reason: ${exhaustiveCheck}`,
                        });
                    }
                }
            }
            const member = await this.deps.memberRepository.get({ id: memberId }, { transacting, forUpdate: true });
            if (!member) {
                throw new errors_1.default.NotFoundError({ message: `Member not found: ${memberId}` });
            }
            const memberStatus = member.get('status');
            if (memberStatus !== 'free' && memberStatus !== 'gift') {
                throw new errors_1.default.BadRequestError({ message: (0, tpl_1.default)(errorMessages.giftInvalidReassignMember) });
            }
            const existingActiveGift = await this.deps.giftRepository.getActiveByMember(memberId, {
                transacting,
            });
            if (existingActiveGift && existingActiveGift.token !== gift.token) {
                throw new errors_1.default.BadRequestError({ message: (0, tpl_1.default)(errorMessages.giftMemberAlreadyHasGift) });
            }
            const reassignedGift = gift.reassignRedeemer(memberId);
            await this.deps.memberRepository.update({
                products: [
                    {
                        id: reassignedGift.tierId,
                        expiry_at: reassignedGift.consumesAt,
                    },
                ],
                status: 'gift',
            }, { id: memberId, transacting });
            await this.deps.giftRepository.update(reassignedGift, { transacting });
            return reassignedGift;
        };
        await (input.transacting ? run(input.transacting) : this.deps.giftRepository.transaction(run));
    }
    async handlePaymentRefund({ paymentIntentId }) {
        const gift = await this.deps.giftRepository.getByPaymentIntentId(paymentIntentId);
        if (!gift) {
            return false;
        }
        const refunded = gift.refund();
        if (!refunded) {
            return true;
        }
        await this.deps.giftRepository.transaction(async (transacting) => {
            await this.deps.giftRepository.update(refunded, { transacting });
            await this.deps.giftDeliveryService.cancelPendingForGift(refunded.token, { transacting });
            if (gift.redeemerMemberId) {
                const member = await this.deps.memberRepository.get({ id: gift.redeemerMemberId }, { transacting });
                if (member?.get('status') === 'gift') {
                    await this.deps.memberRepository.update({
                        products: [],
                        status: 'free',
                    }, { id: gift.redeemerMemberId, transacting });
                }
            }
        });
        return true;
    }
    async handlePaidSubscriptionActivation(memberId) {
        const gift = await this.getActiveByMember(memberId);
        if (!gift) {
            return false;
        }
        return Boolean(await this.consume(gift.token));
    }
    async consume(token, options = {}) {
        const run = async (transacting) => {
            // Fetch with a row lock to prevent race conditions under concurrency
            const gift = await this.deps.giftRepository.getByToken(token, {
                transacting,
                forUpdate: true,
            });
            if (!gift || gift.status !== 'redeemed') {
                return null;
            }
            const consumed = gift.consume();
            if (!consumed) {
                return null;
            }
            await this.deps.giftRepository.update(consumed, { transacting });
            return consumed;
        };
        return options.transacting
            ? await run(options.transacting)
            : await this.deps.giftRepository.transaction(run);
    }
    async processConsumed() {
        const toConsume = await this.deps.giftRepository.findPendingConsumption();
        if (toConsume.length === 0) {
            return { consumedCount: 0, updatedMemberCount: 0 };
        }
        let consumedCount = 0;
        let updatedMemberCount = 0;
        for (const gift of toConsume) {
            await this.deps.giftRepository.transaction(async (transacting) => {
                const consumed = await this.consume(gift.token, { transacting });
                if (!consumed) {
                    return;
                }
                const member = await this.deps.memberRepository.get({ id: consumed.redeemerMemberId }, { transacting, forUpdate: true });
                if (member && member.get('status') === 'gift') {
                    await this.deps.memberRepository.update({
                        products: [],
                        status: 'free',
                    }, { id: consumed.redeemerMemberId, transacting });
                    updatedMemberCount += 1;
                }
                consumedCount += 1;
            });
        }
        return { consumedCount, updatedMemberCount };
    }
    async processExpired() {
        const toExpire = await this.deps.giftRepository.findPendingExpiration();
        if (toExpire.length === 0) {
            return { expiredCount: 0 };
        }
        let expiredCount = 0;
        for (const gift of toExpire) {
            await this.deps.giftRepository.transaction(async (transacting) => {
                // Re-fetch with a row lock to prevent races with concurrent redeems / refunds
                const locked = await this.deps.giftRepository.getByToken(gift.token, {
                    transacting,
                    forUpdate: true,
                });
                if (locked?.status !== 'purchased') {
                    return;
                }
                const expired = locked.expire();
                if (!expired) {
                    return;
                }
                await this.deps.giftRepository.update(expired, { transacting });
                await this.deps.giftDeliveryService.cancelPendingForGift(expired.token, { transacting });
                expiredCount += 1;
            });
        }
        return { expiredCount };
    }
    async processAbandonedCheckouts() {
        const cutoff = new Date(Date.now() - GIFT_CHECKOUT_RETENTION_DAYS * MS_PER_DAY);
        const deletedCount = await this.deps.giftRepository.deleteAbandonedCheckouts(cutoff);
        return { deletedCount };
    }
    async cleanup() {
        const startedAt = Date.now();
        // null, not 0: a phase that throws is caught and skipped, and a zero count
        // would be indistinguishable from that phase having had nothing to do.
        let deletedCheckoutCount = null;
        let consumedGiftCount = null;
        let updatedMemberCount = null;
        let expiredGiftCount = null;
        let deliverySentCount = null;
        let deliverySkippedCount = null;
        let deliveryFailedCount = null;
        const checkoutStart = Date.now();
        try {
            const { deletedCount } = await this.processAbandonedCheckouts();
            deletedCheckoutCount = deletedCount;
            logging_1.default.info(`[Background Job] clean-gifts processed abandoned checkouts: deleted ${deletedCount} in ${Date.now() - checkoutStart}ms`);
        }
        catch (err) {
            logging_1.default.error(err, '[Background Job] clean-gifts error processing abandoned checkouts');
        }
        const consumedStart = Date.now();
        try {
            const { consumedCount, updatedMemberCount: memberCount } = await this.processConsumed();
            consumedGiftCount = consumedCount;
            updatedMemberCount = memberCount;
            logging_1.default.info(`[Background Job] clean-gifts processed consumed gifts: consumed ${consumedCount}, updated ${memberCount} members in ${Date.now() - consumedStart}ms`);
        }
        catch (err) {
            logging_1.default.error(err, '[Background Job] clean-gifts error processing consumed gifts');
        }
        const expiredStart = Date.now();
        try {
            const { expiredCount } = await this.processExpired();
            expiredGiftCount = expiredCount;
            logging_1.default.info(`[Background Job] clean-gifts processed expired gifts: expired ${expiredCount} in ${Date.now() - expiredStart}ms`);
        }
        catch (err) {
            logging_1.default.error(err, '[Background Job] clean-gifts error processing expired gifts');
        }
        try {
            const { sentCount, skippedCount, failedCount } = await this.deps.giftDeliveryService.recoverPending();
            deliverySentCount = sentCount;
            deliverySkippedCount = skippedCount;
            deliveryFailedCount = failedCount;
            if (sentCount + skippedCount + failedCount > 0) {
                logging_1.default.info(`[Background Job] clean-gifts processed pending gift deliveries: ${sentCount} sent, ${skippedCount} not due, ${failedCount} rejected`);
            }
        }
        catch (err) {
            logging_1.default.error(err, '[Background Job] clean-gifts error processing pending gift deliveries');
        }
        logging_1.default.info({
            system: {
                event: 'clean_gifts.completed',
                deleted_checkout_count: deletedCheckoutCount,
                consumed_count: consumedGiftCount,
                updated_member_count: updatedMemberCount,
                expired_count: expiredGiftCount,
                delivery_sent_count: deliverySentCount,
                delivery_skipped_count: deliverySkippedCount,
                delivery_failed_count: deliveryFailedCount,
                duration_ms: Date.now() - startedAt,
            },
        }, '[Background Job] clean-gifts finished its cleanup phases');
    }
    async processReminders() {
        const startedAt = Date.now();
        const now = new Date();
        const toRemind = await this.deps.giftRepository.findPendingReminder({
            now,
            reminderLeadMs: GIFT_REMINDER_LEAD_MS,
            reminderFloorMs: GIFT_REMINDER_FLOOR_MS,
        });
        let remindedCount = 0;
        let skippedCount = 0;
        let failedCount = 0;
        for (const gift of toRemind) {
            try {
                const sent = await this.sendReminderForGift(gift.token);
                if (sent) {
                    remindedCount += 1;
                }
                else {
                    skippedCount += 1;
                }
            }
            catch (err) {
                logging_1.default.error(err);
                failedCount += 1;
            }
        }
        // The jobs service's lifecycle log carries no counts, so the poll reports
        // its own summary here for the daily job and the exact scheduler alike.
        logging_1.default.info({
            system: {
                event: 'send_gift_reminders.completed',
                reminded_count: remindedCount,
                skipped_count: skippedCount,
                failed_count: failedCount,
                duration_ms: Date.now() - startedAt,
            },
        }, `[Background Job] send-gift-reminders processed reminders: ${remindedCount} sent, ${skippedCount} not due, ${failedCount} rejected`);
        return { remindedCount, skippedCount, failedCount };
    }
    async sendReminderForGift(token) {
        const gift = await this.deps.giftRepository.getByToken(token);
        if (!gift) {
            return false;
        }
        const tier = await this.deps.tiersService.api.read(gift.tierId);
        if (!tier) {
            throw new errors_1.default.NotFoundError({ message: `Tier not found for gift: ${gift.tierId}` });
        }
        const result = await this.deps.giftRepository.transaction(async (transacting) => {
            const locked = await this.deps.giftRepository.getByToken(token, {
                transacting,
                forUpdate: true,
            });
            if (!locked) {
                return null;
            }
            if (
            // Gift must still be active — a concurrent refund or early consume can happen
            // between `findPendingReminder` and this re-read.
            locked.status !== 'redeemed' ||
                // Idempotency guard: another path (rerun, scheduler) may already have sent.
                locked.consumesSoonReminderSentAt !== null ||
                // Narrows `redeemerMemberId` from `string | null` to `string` — always set for redeemed gifts.
                locked.redeemerMemberId === null ||
                // Narrows `consumesAt` from `Date | null` to `Date` — always set for redeemed gifts.
                locked.consumesAt === null) {
                return null;
            }
            const member = await this.deps.memberRepository.get({ id: locked.redeemerMemberId }, { transacting, forUpdate: true });
            // Record the reminder as sent before any skip or send below so we don't
            // re-try gifts with permanently unreachable redeemers on every poll.
            const reminded = locked.remind();
            if (!reminded) {
                return null;
            }
            await this.deps.giftRepository.update(reminded, { transacting });
            if (!member) {
                return null;
            }
            if (member.get('email_disabled')) {
                return null;
            }
            return {
                memberEmail: member.get('email'),
                memberName: member.get('name'),
                consumesAt: locked.consumesAt,
            };
        });
        if (!result) {
            return false;
        }
        await this.deps.giftEmailService.sendReminder({
            memberEmail: result.memberEmail,
            memberName: result.memberName,
            tierName: tier.name,
            consumesAt: result.consumesAt,
        });
        return true;
    }
    async serializeRedemption(gift, options = {}) {
        const recipientEmail = await this.deps.giftDeliveryService.getRecipientEmailForGift(gift.token, options);
        const tier = await this.deps.tiersService.api.read(gift.tierId);
        if (!tier) {
            throw new errors_1.default.InternalServerError({
                message: `Tier ${gift.tierId} not found for gift: ${gift.token}`,
            });
        }
        const tierJSON = tier.toJSON();
        return {
            token: gift.token,
            cadence: gift.cadence,
            duration: gift.duration,
            currency: gift.currency,
            amount: gift.amount,
            buyer_name: gift.buyerName,
            recipient_name: gift.recipientName,
            recipient_email: recipientEmail,
            message: gift.personalMessage,
            expires_at: gift.expiresAt,
            consumes_at: gift.consumesAt,
            tier: {
                id: tierJSON.id,
                name: tierJSON.name,
                description: tierJSON.description,
                benefits: tierJSON.benefits,
            },
        };
    }
}
exports.GiftService = GiftService;
