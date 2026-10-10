"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GiftDeliveryBookshelfRepository = void 0;
const errors_1 = __importDefault(require("@tryghost/errors"));
const date_1 = require("../../lib/db-types/date");
const gift_codec_1 = require("./gift-codec");
const gift_delivery_codec_1 = require("./gift-delivery-codec");
// A null scheduled_at means the delivery was due at purchase time, so it is
// always due. Kept sargable against the (status, scheduled_at) index.
function dueDeliveries(query, now) {
    query.andWhere((due) => {
        due
            .whereNull('gift_deliveries.scheduled_at')
            .orWhere('gift_deliveries.scheduled_at', '<=', (0, date_1.toDatabaseDate)(now));
    });
}
// Deliveries that still need a send attempt: never started, or claimed by a
// process that has since died and left the claim stale
function recoverableDeliveries(query, staleBefore) {
    query.andWhere((recoverable) => {
        recoverable.where('gift_deliveries.status', 'pending').orWhere((stale) => {
            stale
                .where('gift_deliveries.status', 'sending')
                .where('gift_deliveries.started_at', '<=', (0, date_1.toDatabaseDate)(staleBefore));
        });
    });
}
class GiftDeliveryBookshelfRepository {
    model;
    knex;
    constructor({ GiftDeliveryModel, knex, }) {
        this.model = GiftDeliveryModel;
        this.knex = knex;
    }
    async getById(id, options = {}) {
        const model = await this.model.findOne({ id }, { require: false, ...options });
        return model ? (0, gift_delivery_codec_1.decodeGiftDeliveryRow)(model.toJSON()) : null;
    }
    async getByGiftId(giftId, options = {}) {
        const model = await this.model.findOne({ gift_id: giftId }, { require: false, ...options });
        return model ? (0, gift_delivery_codec_1.decodeGiftDeliveryRow)(model.toJSON()) : null;
    }
    async getByGiftToken(giftToken, options = {}) {
        const db = options.transacting ?? this.knex;
        const row = await db('gift_deliveries')
            .select('gift_deliveries.*')
            .join('gifts', 'gifts.id', 'gift_deliveries.gift_id')
            .where('gifts.token', giftToken)
            .first();
        return row ? (0, gift_delivery_codec_1.decodeGiftDeliveryRow)(row) : null;
    }
    async getByProviderMessageId(providerMessageId) {
        const model = await this.model.findOne({ email_provider_message_id: providerMessageId }, { require: false });
        return model ? (0, gift_delivery_codec_1.decodeGiftDeliveryRow)(model.toJSON()) : null;
    }
    async findRecoverableForPurchasedGifts(now, staleBefore, limit) {
        const rows = await this.knex('gift_deliveries')
            .select('gift_deliveries.*')
            .join('gifts', 'gifts.id', 'gift_deliveries.gift_id')
            .where('gifts.status', 'purchased')
            .modify(dueDeliveries, now)
            .modify(recoverableDeliveries, staleBefore)
            .orderByRaw('COALESCE(gift_deliveries.scheduled_at, gifts.purchased_at) ASC')
            .limit(limit);
        const deliveries = rows.map((row) => (0, gift_delivery_codec_1.decodeGiftDeliveryRow)(row));
        if (deliveries.length === 0) {
            return [];
        }
        const giftRows = await this.knex('gifts')
            .select('*')
            .whereIn('id', deliveries.map((delivery) => delivery.giftId));
        const giftsById = new Map(giftRows.map((row) => [String(row.id), (0, gift_codec_1.decodeGiftRow)(row)]));
        return deliveries.map((delivery) => {
            const gift = giftsById.get(delivery.giftId);
            if (!gift) {
                throw new errors_1.default.InternalServerError({
                    message: `Gift not found for recoverable delivery ${delivery.id}`,
                });
            }
            return { delivery, gift };
        });
    }
    // Distinct times only: the scheduler arms one flush job per scheduled
    // time, so scheduled gifts clustering on a popular date collapse to a
    // single row instead of one per delivery.
    async findScheduledTimesForPurchasedGifts(now) {
        const rows = await this.knex('gift_deliveries')
            .distinct('gift_deliveries.scheduled_at')
            .join('gifts', 'gifts.id', 'gift_deliveries.gift_id')
            .where('gift_deliveries.status', 'pending')
            .where('gifts.status', 'purchased')
            .where('gift_deliveries.scheduled_at', '>', (0, date_1.toDatabaseDate)(now));
        return rows.map((row) => (0, date_1.fromDatabaseDate)(row.scheduled_at));
    }
    async tryStartDelivery(id, now, staleBefore) {
        const claimed = await this.knex('gift_deliveries')
            .where({ id })
            .modify(dueDeliveries, now)
            .whereExists((query) => {
            query
                .select('gifts.id')
                .from('gifts')
                .whereRaw('gifts.id = gift_deliveries.gift_id')
                .where('gifts.status', 'purchased');
        })
            .modify(recoverableDeliveries, staleBefore)
            .update({
            status: 'sending',
            started_at: (0, date_1.toDatabaseDate)(now),
        });
        if (claimed !== 1) {
            return null;
        }
        return this.getById(id);
    }
    async markSent(id, sentAt, providerMessageId) {
        return this.updateState(id, 'sending', {
            status: 'sent',
            email_sent_at: (0, date_1.toDatabaseDate)(sentAt),
            email_provider_message_id: providerMessageId,
            started_at: null,
        });
    }
    // A delivery cancelled while its email was in flight keeps the acceptance
    // details so the message can still be correlated with transport outcomes
    async recordCancelledAcceptance(id, sentAt, providerMessageId) {
        return this.updateState(id, 'cancelled', {
            email_sent_at: (0, date_1.toDatabaseDate)(sentAt),
            email_provider_message_id: providerMessageId,
        });
    }
    async markFailed(id) {
        return this.updateState(id, 'sending', {
            status: 'failed',
            started_at: null,
        });
    }
    async markCancelled(id) {
        return this.updateState(id, 'sending', {
            status: 'cancelled',
            started_at: null,
        });
    }
    async cancelPendingForGift(token, options = {}) {
        const db = options.transacting ?? this.knex;
        const gift = db('gifts').select('id').where({ token });
        const updated = await db('gift_deliveries')
            .whereIn('status', ['pending', 'sending'])
            .whereIn('gift_id', gift)
            .update({ status: 'cancelled', started_at: null });
        return updated === 1;
    }
    async recordOutcome({ providerMessageId, outcome, timestamp, error, }) {
        const outcomeAt = (0, date_1.toDatabaseDate)(timestamp);
        const lowerPriorityOutcomes = outcome === 'permanent_failed'
            ? ['temporary_failed', 'delivered']
            : outcome === 'delivered'
                ? ['temporary_failed']
                : [];
        const updated = await this.knex('gift_deliveries')
            .where({ email_provider_message_id: providerMessageId })
            .whereNot({ outcome: 'permanent_failed' })
            .where((builder) => {
            builder.whereNull('outcome_at').orWhere('outcome_at', '<', outcomeAt);
            // Database dates have second precision. Allow a same-second outcome
            // to advance, while preventing refetches from regressing or replaying it.
            if (lowerPriorityOutcomes.length > 0) {
                builder.orWhere((sameSecond) => {
                    sameSecond
                        .where('outcome_at', '=', outcomeAt)
                        .whereIn('outcome', lowerPriorityOutcomes);
                });
            }
        })
            .update({
            outcome,
            outcome_at: outcomeAt,
            outcome_error: error,
        });
        if (updated === 1) {
            return 'recorded';
        }
        const delivery = await this.knex('gift_deliveries')
            .select('id')
            .where({ email_provider_message_id: providerMessageId })
            .first();
        return delivery ? 'stale' : 'not_found';
    }
    async create(delivery, options = {}) {
        await this.model.add((0, gift_delivery_codec_1.encodeGiftDelivery)(delivery), options);
    }
    async updateState(id, from, data) {
        const updated = await this.knex('gift_deliveries').where({ id, status: from }).update(data);
        return updated === 1;
    }
}
exports.GiftDeliveryBookshelfRepository = GiftDeliveryBookshelfRepository;
