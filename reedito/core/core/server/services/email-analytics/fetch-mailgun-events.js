"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchMailgunEvents = fetchMailgunEvents;
// @ts-expect-error This module lacks type definitions.
const mailgun_client_1 = __importDefault(require("../lib/mailgun-client"));
const DEFAULT_EVENT_FILTER = 'delivered OR opened OR failed OR unsubscribed OR complained';
const PAGE_LIMIT = 300;
/**
 * Fetch Mailgun email analytics events.
 */
async function fetchMailgunEvents({ config, settings, tags, batchHandler, maxEvents, begin, end, events, }) {
    const mailgunClient = new mailgun_client_1.default({ config, settings });
    const mailgunOptions = {
        limit: PAGE_LIMIT,
        event: events ? events.join(' OR ') : DEFAULT_EVENT_FILTER,
        tags: tags.join(' AND '),
        begin: begin ? begin.getTime() / 1000 : undefined,
        end: end ? end.getTime() / 1000 : undefined,
        ascending: 'yes',
    };
    return await mailgunClient.fetchEvents(mailgunOptions, batchHandler, { maxEvents });
}
