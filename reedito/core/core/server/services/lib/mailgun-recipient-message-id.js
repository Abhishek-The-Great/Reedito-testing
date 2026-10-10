"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RECIPIENT_MESSAGE_ID_VARIABLE = void 0;
exports.buildRecipientMessageId = buildRecipientMessageId;
exports.isTemplatedRecipientMessageId = isTemplatedRecipientMessageId;
exports.addRecipientMessageIds = addRecipientMessageIds;
/**
 * Per-recipient Message-Id values for Mailgun batch sends. Mailgun mints one Message-Id per
 * API call, so without these every recipient shares it and readers' replies thread together.
 * Not to be confused with `./mailgun-message-id`, which normalizes the id Mailgun returns.
 */
const node_crypto_1 = __importDefault(require("node:crypto"));
exports.RECIPIENT_MESSAGE_ID_VARIABLE = 'message_id';
/**
 * Deterministic per (email, recipient) so a resubmitted batch reuses the same ids; the address
 * is hashed rather than exposed. Test emails have no email id and get a random prefix instead.
 * No angle brackets: the header template adds them.
 */
function buildRecipientMessageId({ emailId, recipientEmail, domain, }) {
    const prefix = emailId || node_crypto_1.default.randomUUID();
    const digest = node_crypto_1.default
        .createHash('sha256')
        .update(`${prefix}:${recipientEmail}`)
        .digest('hex')
        .slice(0, 32);
    return `${prefix}.${digest}@${domain}`;
}
/**
 * Mailgun returns the Message-Id it was given, so when the header is a per-recipient template it
 * comes back unsubstituted and identifies nothing.
 */
function isTemplatedRecipientMessageId(messageId) {
    return (typeof messageId === 'string' &&
        messageId.includes(`%recipient.${exports.RECIPIENT_MESSAGE_ID_VARIABLE}%`));
}
/** Returns a new recipient-variables map with a `message_id` per recipient; the input is not mutated */
function addRecipientMessageIds(recipientData, { emailId, domain }) {
    const result = {};
    for (const [recipientEmail, variables] of Object.entries(recipientData)) {
        result[recipientEmail] = {
            ...variables,
            [exports.RECIPIENT_MESSAGE_ID_VARIABLE]: buildRecipientMessageId({ emailId, recipientEmail, domain }),
        };
    }
    return result;
}
