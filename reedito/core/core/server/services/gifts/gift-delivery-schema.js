"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DbGiftDelivery = exports.GiftDeliveryOutcomeSchema = exports.GiftDeliveryStatusSchema = void 0;
const zod_1 = require("zod");
const date_1 = require("../../lib/db-types/date");
exports.GiftDeliveryStatusSchema = zod_1.z.enum([
    'pending',
    'sending',
    'sent',
    'failed',
    'cancelled',
]);
exports.GiftDeliveryOutcomeSchema = zod_1.z.enum([
    'unknown',
    'delivered',
    'temporary_failed',
    'permanent_failed',
]);
exports.DbGiftDelivery = zod_1.z.object({
    id: zod_1.z.string(),
    gift_id: zod_1.z.string(),
    recipient_email: zod_1.z.string().email(),
    status: exports.GiftDeliveryStatusSchema.default('pending'),
    scheduled_at: date_1.DbDate.nullable().default(null),
    started_at: date_1.DbDate.nullable().default(null),
    email_sent_at: date_1.DbDate.nullable().default(null),
    email_provider_message_id: zod_1.z.string().nullable().default(null),
    outcome: exports.GiftDeliveryOutcomeSchema.default('unknown'),
    outcome_at: date_1.DbDate.nullable().default(null),
    outcome_error: zod_1.z.string().nullable().default(null),
});
