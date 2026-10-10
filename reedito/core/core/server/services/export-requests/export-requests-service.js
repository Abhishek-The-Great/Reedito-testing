"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportRequestsService = exports.ExportRequestsService = void 0;
const signed_webhook_1 = require("../../lib/signed-webhook");
const logging = require('@tryghost/logging');
const request = require('@tryghost/request');
const errors = require('@tryghost/errors');
const config = require('../../../shared/config');
class ExportRequestsService {
    #config;
    #logging;
    #request;
    constructor(dependencies = { config, logging, request }) {
        this.#config = dependencies.config;
        this.#logging = dependencies.logging;
        this.#request = dependencies.request;
    }
    #readExportRequestConfig() {
        return {
            webhookUrl: this.#config.get('hostSettings:export:webhookUrl'),
            webhookSecret: this.#config.get('hostSettings:export:webhookSecret'),
            siteId: this.#config.get('hostSettings:siteId'),
        };
    }
    /**
     * Requests an async export archive from the configured host service.
     * The host service generates the archive in the background and emails a
     * download link to the site owner.
     *
     * The webhook is a shared channel that dispatches on the `type` field of
     * the event envelope, and the receiver is fire-and-forget (it always
     * responds 200) — a 2xx means "delivered", not "validated".
     */
    async requestArchive({ components }) {
        const { webhookUrl, webhookSecret, siteId } = this.#readExportRequestConfig();
        if (typeof webhookUrl !== 'string' || webhookUrl.length === 0) {
            throw new errors.NotFoundError({
                message: 'Export archive generation is not enabled on this site',
            });
        }
        if (typeof webhookSecret !== 'string' || webhookSecret.length === 0) {
            this.#logging.error('Export archive request is misconfigured: hostSettings:export:webhookSecret is missing while hostSettings:export:webhookUrl is set.');
            throw new errors.IncorrectUsageError({
                message: 'Export requests are not configured correctly on this site',
            });
        }
        const normalizedSiteId = typeof siteId === 'string' ? siteId : typeof siteId === 'number' ? String(siteId) : '';
        if (normalizedSiteId.length === 0) {
            this.#logging.error('Export archive request is misconfigured: hostSettings:siteId is missing while hostSettings:export:webhookUrl is set.');
            throw new errors.IncorrectUsageError({
                message: 'Export requests are not configured correctly on this site',
            });
        }
        const payload = {
            type: 'export',
            siteId: normalizedSiteId,
            components,
        };
        const requestOptions = (0, signed_webhook_1.buildSignedWebhookRequest)({
            payload,
            secret: webhookSecret,
            // No retries: the request is not idempotent (each delivery can
            // schedule an archive)
            retryLimit: 0,
        });
        const sanitizedUrl = (0, signed_webhook_1.sanitizeWebhookUrl)(webhookUrl);
        this.#logging.info(`Requesting export archive generation from "${sanitizedUrl}"`);
        try {
            await this.#request(webhookUrl, requestOptions);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.#logging.error(`Failed to request export archive generation from "${sanitizedUrl}": ${message}`);
            throw new errors.InternalServerError({
                statusCode: 502,
                message: 'Failed to start the export. Please try again later.',
            });
        }
    }
}
exports.ExportRequestsService = ExportRequestsService;
exports.exportRequestsService = new ExportRequestsService();
