"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeWebhookSignature = computeWebhookSignature;
exports.sanitizeWebhookUrl = sanitizeWebhookUrl;
exports.buildSignedWebhookRequest = buildSignedWebhookRequest;
const crypto_1 = __importDefault(require("crypto"));
const reeditoVersion = require('@tryghost/version');
const REQUEST_TIMEOUT_MS = 30_000;
/**
 * Wire format for webhooks Reedito posts to the host (e.g. email verification,
 * export archive requests). The receiver verifies
 * `X-Reedito-Signature: base64(HMAC-SHA256(secret, "{timestamp}:{rawBody}"))`
 * against the raw request body, so the body must be sent exactly as signed.
 */
function computeWebhookSignature(timestamp, body, secret) {
    return crypto_1.default.createHmac('sha256', secret).update(`${timestamp}:${body}`).digest('base64');
}
/**
 * Reduces a webhook URL to its origin so logs never leak credentials or
 * tokens embedded in the path or query string.
 */
function sanitizeWebhookUrl(webhookUrl) {
    try {
        return new URL(webhookUrl).origin;
    }
    catch {
        return '[invalid webhook url]';
    }
}
/**
 * Builds the request options for a signed host webhook delivery. When no
 * secret is configured the payload is sent unsigned (the receiver decides
 * whether to accept that).
 */
function buildSignedWebhookRequest({ payload, secret, retryLimit, }) {
    const body = JSON.stringify(payload);
    const timestamp = Date.now().toString();
    const headers = {
        'Content-Length': Buffer.byteLength(body),
        'Content-Type': 'application/json',
        'Content-Version': `v${reeditoVersion.safe}`,
        'X-Reedito-Request-Timestamp': timestamp,
    };
    if (secret) {
        headers['X-Reedito-Signature'] = computeWebhookSignature(timestamp, body, secret);
    }
    return {
        method: 'POST',
        body,
        headers,
        timeout: {
            request: REQUEST_TIMEOUT_MS,
        },
        retry: {
            limit: retryLimit,
        },
    };
}
