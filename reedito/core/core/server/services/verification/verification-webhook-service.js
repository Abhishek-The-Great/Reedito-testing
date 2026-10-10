"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verificationWebhookService = exports.VerificationWebhookService = void 0;
const signed_webhook_1 = require("../../lib/signed-webhook");
const logging = require('@tryghost/logging');
const request = require('@tryghost/request');
const config = require('../../../shared/config');
const MAX_RETRY_LIMIT = 5;
class VerificationWebhookService {
    #config;
    #logging;
    #request;
    constructor(dependencies = { config, logging, request }) {
        this.#config = dependencies.config;
        this.#logging = dependencies.logging;
        this.#request = dependencies.request;
    }
    #readWebhookConfig() {
        return {
            webhookType: this.#config.get('hostSettings:emailVerification:webhookType'),
            webhookUrl: this.#config.get('hostSettings:emailVerification:webhookUrl'),
            webhookSecret: this.#config.get('hostSettings:emailVerification:webhookSecret') || '',
            siteId: this.#config.get('hostSettings:siteId') || null,
        };
    }
    /**
     * Sends a verification webhook to the configured endpoint.
     */
    async sendVerificationWebhook({ amountTriggered, threshold, method, }) {
        const { webhookType, webhookUrl, webhookSecret, siteId } = this.#readWebhookConfig();
        if (typeof webhookUrl !== 'string' || webhookUrl.length === 0) {
            this.#logging.warn('Verification webhook is not configured because webhookUrl is missing.');
            return false;
        }
        if (typeof webhookType !== 'string' || webhookType.length === 0) {
            this.#logging.warn('Verification webhook is not configured because webhookType is missing.');
            return false;
        }
        const payload = {
            type: webhookType,
            siteId: typeof siteId === 'string' ? siteId : null,
            amountTriggered,
            threshold,
            method,
        };
        const requestOptions = (0, signed_webhook_1.buildSignedWebhookRequest)({
            payload,
            secret: typeof webhookSecret === 'string' && webhookSecret !== '' ? webhookSecret : undefined,
            retryLimit: process.env.NODE_ENV?.startsWith('test') ? 0 : MAX_RETRY_LIMIT,
        });
        const sanitizedWebhookUrl = (0, signed_webhook_1.sanitizeWebhookUrl)(webhookUrl);
        this.#logging.info(`Triggering verification webhook to "${sanitizedWebhookUrl}"`);
        try {
            await this.#request(webhookUrl, requestOptions);
            return true;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.#logging.error(`Failed to send verification webhook to "${sanitizedWebhookUrl}": ${message}`);
            throw error;
        }
    }
}
exports.VerificationWebhookService = VerificationWebhookService;
exports.verificationWebhookService = new VerificationWebhookService();
