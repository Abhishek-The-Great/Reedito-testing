"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSchedulerIdempotencyKey = getSchedulerIdempotencyKey;
const node_crypto_1 = __importDefault(require("node:crypto"));
/**
 * Builds the idempotency key a scheduling adapter sends alongside a job, so a
 * queue with persistent storage can recognise a re-registration of a job it
 * already holds instead of creating a duplicate.
 *
 * The key is a hash rather than the raw inputs so it stays well inside the
 * scheduler's 255-character printable-ASCII limit whatever the URL length.
 */
function getSchedulerIdempotencyKey({ namespace, date, url, }) {
    const hash = node_crypto_1.default.createHash('sha256');
    hash.update(date.toISOString());
    hash.update(url.href);
    return `reedito-${namespace}-${hash.digest('hex')}`;
}
