"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GiftEmailAnalyticsBatchProcessor = void 0;
const mailgun_message_id_1 = require("../lib/mailgun-message-id");
const event_processing_result_1 = require("./event-processing-result");
class GiftEmailAnalyticsBatchProcessor {
    #giftDeliveryService;
    constructor({ giftDeliveryService }) {
        this.#giftDeliveryService = giftDeliveryService;
    }
    async processBatch(events, result, fetchData) {
        for (const event of events) {
            if (!fetchData.lastEventTimestamp || event.timestamp > fetchData.lastEventTimestamp) {
                fetchData.lastEventTimestamp = event.timestamp;
            }
            let outcome = null;
            if (event.type === 'delivered') {
                outcome = 'delivered';
            }
            else if (event.type === 'failed') {
                outcome = event.severity === 'permanent' ? 'permanent_failed' : 'temporary_failed';
            }
            if (!outcome) {
                result.merge(new event_processing_result_1.EventProcessingResult({ unhandled: 1 }));
                continue;
            }
            const recordResult = await this.#giftDeliveryService.recordOutcome({
                providerMessageId: (0, mailgun_message_id_1.normalizeMailgunMessageId)(event.providerId),
                outcome,
                timestamp: event.timestamp,
                error: outcome !== 'delivered' && event.error ? JSON.stringify(event.error) : null,
            });
            if (recordResult === 'not_found') {
                result.merge(new event_processing_result_1.EventProcessingResult({ unprocessable: 1 }));
            }
            else if (outcome === 'delivered') {
                result.merge(new event_processing_result_1.EventProcessingResult({ delivered: 1 }));
            }
            else if (outcome === 'temporary_failed') {
                result.merge(new event_processing_result_1.EventProcessingResult({ temporaryFailed: 1 }));
            }
            else {
                result.merge(new event_processing_result_1.EventProcessingResult({ permanentFailed: 1 }));
            }
        }
    }
}
exports.GiftEmailAnalyticsBatchProcessor = GiftEmailAnalyticsBatchProcessor;
