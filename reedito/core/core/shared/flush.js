"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.flushLogsAndMetrics = flushLogsAndMetrics;
const promises_1 = require("node:timers/promises");
const logging_1 = __importDefault(require("@tryghost/logging"));
const metrics_1 = __importDefault(require("@tryghost/metrics"));
const DEFAULT_TIMEOUT_MS = 2000;
/**
 * Drain buffered log transports before the process exits, bounded so a stuck
 * transport can never block shutdown.
 */
async function flushLogsAndMetrics(timeoutMs = DEFAULT_TIMEOUT_MS) {
    // Unreffed so the loser of the race can't hold the event loop open
    await Promise.race([
        Promise.all([logging_1.default.flush(), metrics_1.default.flush()]),
        (0, promises_1.setTimeout)(timeoutMs, undefined, { ref: false }),
    ]);
}
