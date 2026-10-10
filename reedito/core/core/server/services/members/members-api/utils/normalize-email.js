"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeEmail = normalizeEmail;
const { parseEmailAddress } = require('@reedito/parse-email-address');
/**
 * Normalizes email addresses by converting Unicode domains to ASCII (punycode)
 *
 * This prevents homograph attacks where Unicode characters are used to spoof domains.
 *
 * @returns The normalized email address, or null if the email can't be normalized
 */
function normalizeEmail(email) {
    const parsedEmail = parseEmailAddress(email);
    if (!parsedEmail) {
        return null;
    }
    const { local, domain } = parsedEmail;
    return `${local}@${domain}`;
}
