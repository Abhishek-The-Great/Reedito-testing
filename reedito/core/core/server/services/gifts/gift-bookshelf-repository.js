"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GiftBookshelfRepository = void 0;
const errors_1 = __importDefault(require("@tryghost/errors"));
const mongo_utils_1 = require("@tryghost/mongo-utils");
const gift_codec_1 = require("./gift-codec");
const date_1 = require("../../lib/db-types/date");
class GiftBookshelfRepository {
    model;
    knex;
    constructor({ GiftModel, knex }) {
        this.model = GiftModel;
        this.knex = knex;
    }
    async existsByCheckoutSessionId(checkoutSessionId) {
        const existing = await this.model.findOne({
            stripe_checkout_session_id: checkoutSessionId,
        }, { require: false });
        return !!existing;
    }
    async getById(id, options = {}) {
        const model = await this.model.findOne({
            id,
        }, { require: false, ...options });
        return model ? this.toGift(model) : null;
    }
    async getByToken(token, options = {}) {
        const model = await this.model.findOne({
            token,
        }, { require: false, ...options });
        return model ? this.toGift(model) : null;
    }
    async getByPaymentIntentId(paymentIntentId) {
        const model = await this.model.findOne({
            stripe_payment_intent_id: paymentIntentId,
        }, { require: false });
        return model ? this.toGift(model) : null;
    }
    async getActiveByMember(memberId, options = {}) {
        const model = await this.model.findOne({
            redeemer_member_id: memberId,
            status: 'redeemed',
        }, { require: false, ...options });
        return model ? this.toGift(model) : null;
    }
    async getActiveByMembers(memberIds, options = {}) {
        const map = new Map();
        if (memberIds.length === 0) {
            return map;
        }
        const idList = memberIds.map((id) => `'${id}'`).join(',');
        const collection = await this.model.findAll({
            filter: `redeemer_member_id:[${idList}]+status:redeemed`,
            ...options,
        });
        for (const model of collection.models) {
            const gift = this.toGift(model);
            if (gift.redeemerMemberId) {
                map.set(gift.redeemerMemberId, gift);
            }
        }
        return map;
    }
    browsePurchaseEvents(options = {}, filter) {
        return this.browseEvents({
            options,
            filter,
            type: 'gift_purchase_event',
            relation: 'buyer',
            memberIdColumn: 'buyer_member_id',
            dateColumn: 'purchased_at',
        });
    }
    browseRedemptionEvents(options = {}, filter) {
        return this.browseEvents({
            options,
            filter,
            type: 'gift_redemption_event',
            relation: 'redeemer',
            memberIdColumn: 'redeemer_member_id',
            dateColumn: 'redeemed_at',
        });
    }
    async findPendingConsumption() {
        const now = new Date();
        const collection = await this.model.findAll({
            filter: `status:redeemed+consumes_at:<'${now.toISOString()}'`,
        });
        return collection.models.map((model) => this.toGift(model));
    }
    async findPendingExpiration() {
        const now = new Date();
        const collection = await this.model.findAll({
            filter: `status:purchased+expires_at:<'${now.toISOString()}'`,
        });
        return collection.models.map((model) => this.toGift(model));
    }
    async findPendingReminder({ now, reminderLeadMs, reminderFloorMs, transacting, }) {
        const upper = new Date(now.getTime() + reminderLeadMs).toISOString();
        const lower = new Date(now.getTime() + reminderFloorMs).toISOString();
        const collection = await this.model.findAll({
            filter: `status:redeemed+consumes_at:<='${upper}'+consumes_at:>'${lower}'+consumes_soon_reminder_sent_at:null`,
            transacting,
        });
        return collection.models.map((model) => this.toGift(model));
    }
    async findUnsentReminders() {
        const now = new Date().toISOString();
        const collection = await this.model.findAll({
            filter: `status:redeemed+consumes_at:>'${now}'+consumes_soon_reminder_sent_at:null`,
        });
        return collection.models.map((model) => this.toGift(model));
    }
    async deleteAbandonedCheckouts(cutoff) {
        return this.knex('gifts')
            .where({ status: 'payment_pending' })
            .where('checkout_started_at', '<=', (0, date_1.toDatabaseDate)(cutoff))
            .del();
    }
    async create(gift, options = {}) {
        const created = await this.model.add(this.toRow(gift), options);
        const id = created.toJSON().id;
        if (!id) {
            throw new errors_1.default.InternalServerError({ message: 'Created gift is missing an id' });
        }
        return id;
    }
    async update(gift, options = {}) {
        const existing = await this.model.findOne({
            token: gift.token,
        }, { require: false, ...options });
        if (!existing) {
            throw new errors_1.default.InternalServerError({ message: `Gift not found: ${gift.token}` });
        }
        await existing.save(this.toRow(gift), {
            autoRefresh: false,
            method: 'update',
            patch: true,
            ...options,
        });
    }
    async deletePendingCheckout(id) {
        const deleted = await this.knex('gifts').where({ id, status: 'payment_pending' }).del();
        return deleted === 1;
    }
    async transaction(callback) {
        return await this.model.transaction(callback);
    }
    toRow(gift) {
        return (0, gift_codec_1.encodeGift)(gift);
    }
    toGift(model) {
        return (0, gift_codec_1.decodeGiftRow)(model.toJSON());
    }
    async browseEvents({ options, filter, type, relation, memberIdColumn, dateColumn, }) {
        const replaceCustomFilter = (existingFilter) => (0, mongo_utils_1.replaceFilters)(existingFilter, {
            custom: filter,
        });
        const queryOptions = {
            ...options,
            withRelated: [relation, 'tier'],
            filter: `${memberIdColumn}:-null+${dateColumn}:-null+custom:true`,
            useBasicCount: true,
            mongoTransformer: (0, mongo_utils_1.chainTransformers)(replaceCustomFilter, ...(0, mongo_utils_1.mapKeys)({
                'data.created_at': dateColumn,
                'data.member_id': memberIdColumn,
            })),
        };
        if (typeof queryOptions.order === 'string') {
            queryOptions.order = queryOptions.order.replace(/created_at/g, dateColumn);
        }
        if (!this.model.findPage) {
            throw new errors_1.default.InternalServerError({
                message: 'Gift model does not support paginated event queries.',
            });
        }
        const { data: models, meta } = await this.model.findPage(queryOptions);
        return {
            data: models.map((model) => {
                const json = model.toJSON(queryOptions);
                return {
                    type,
                    data: {
                        id: json.id,
                        member: json[relation] || null,
                        member_id: json[memberIdColumn],
                        tier_name: json.tier?.name,
                        cadence: json.cadence,
                        duration: json.duration,
                        amount: json.amount,
                        currency: json.currency,
                        created_at: json[dateColumn],
                    },
                };
            }),
            meta,
        };
    }
}
exports.GiftBookshelfRepository = GiftBookshelfRepository;
