"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GIFT_DELIVERY_EMAIL_TAG = exports.GIFT_DELIVERY_STALE_AFTER_MS = exports.GIFT_REMINDER_FLOOR_DAYS = exports.GIFT_REMINDER_LEAD_DAYS = exports.GIFT_SEND_HOUR = exports.GIFT_MAX_SCHEDULE_DAYS = exports.GIFT_EXPIRY_DAYS = void 0;
exports.GIFT_EXPIRY_DAYS = 365;
// How far ahead a delivery may be scheduled. Portal's picker carries its own
// copy (GIFT_MAX_SCHEDULE_DAYS in gift-page.tsx) since Portal ships
// separately — change them together.
exports.GIFT_MAX_SCHEDULE_DAYS = 365;
// Site-local hour a scheduled delivery is sent at. Portal never derives
// this: the exact send instant travels in the success URL as
// gift_scheduled_at.
exports.GIFT_SEND_HOUR = 9;
exports.GIFT_REMINDER_LEAD_DAYS = 7;
exports.GIFT_REMINDER_FLOOR_DAYS = 3;
exports.GIFT_DELIVERY_STALE_AFTER_MS = 60 * 60 * 1000;
exports.GIFT_DELIVERY_EMAIL_TAG = 'gift-delivery';
