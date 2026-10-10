"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignedFlushScheduler = void 0;
const logging_1 = __importDefault(require("@tryghost/logging"));
const build_signed_job_1 = require("./build-signed-job");
// The default scheduling adapter can ping up to 50ms before the scheduled
// time, and the flush queries truncate "now" to whole seconds — an exactly
// on-time job could find nothing due and be consumed without sending
// anything. Arming each job just past its second avoids that.
const FLUSH_DELAY_MS = 1000;
function normalizeTime(time) {
    return Math.floor(time / 1000) * 1000;
}
/**
 * Arms one-shot Admin API flush callbacks through the scheduling adapter,
 * deduplicated by fire time.
 */
class SignedFlushScheduler {
    #apiUrl;
    #adapter;
    #internalKeys;
    #endpoint;
    #name;
    #findScheduledTimes;
    #legacyDelaysMs;
    #scheduledTimes = new Set();
    constructor({ apiUrl, adapter, internalKeys, endpoint, name, findScheduledTimes, legacyDelaysMs = [], }) {
        this.#apiUrl = apiUrl;
        this.#adapter = adapter;
        this.#internalKeys = internalKeys;
        this.#endpoint = endpoint;
        this.#name = name;
        this.#findScheduledTimes = findScheduledTimes;
        this.#legacyDelaysMs = legacyDelaysMs;
        this.#adapter.register(this);
    }
    /**
     * Arm a flush for the given fire time. Already-due work is left to the
     * caller's recovery pass.
     */
    async scheduleAt(time, logContext = {}) {
        time = normalizeTime(time);
        const now = Date.now();
        if (time <= now) {
            return;
        }
        // Prune elapsed one-shot times so the set can't grow for the process
        // lifetime.
        for (const armed of this.#scheduledTimes) {
            if (armed <= now) {
                this.#scheduledTimes.delete(armed);
            }
        }
        if (this.#scheduledTimes.has(time)) {
            return;
        }
        try {
            const key = await this.#internalKeys.get('reedito-scheduler');
            // A concurrent call may have armed this time during the key fetch.
            if (this.#scheduledTimes.has(time)) {
                return;
            }
            const job = this.#buildJob(time, key);
            this.#scheduledTimes.add(time);
            // schedule() captures asynchronous failures instead of throwing, so a
            // silent failure leaves the time marked armed; the daily recovery pass
            // sends the work at most a day late.
            this.#adapter.schedule(job);
        }
        catch (err) {
            // A synchronous key, job-construction, or adapter failure must not escape
            // into the caller. Remove any marker so a later call can retry; the
            // caller's recovery pass handles the work if it does not.
            this.#scheduledTimes.delete(time);
            logging_1.default.error({
                event: { name: `${this.#name}_scheduler.schedule.failed` },
                err,
                ...logContext,
            }, `Failed to schedule ${this.#name.replaceAll('_', ' ')}`);
        }
    }
    /**
     * Rebuilds pending flushes under the current key, unscheduling
     * previous-key jobs during rotation; recovery handles elapsed times.
     */
    async rescheduleAll({ previousKey } = {}) {
        const currentKey = await this.#internalKeys.get('reedito-scheduler');
        const pending = await this.#findScheduledTimes();
        // On boot, unscheduling an identical URL and time would tombstone the
        // rebuilt job; only key rotation has a distinct stale URL to
        // unschedule.
        const bootstrap = !previousKey;
        const scheduledTimes = new Set(pending.map(normalizeTime));
        this.#scheduledTimes.clear();
        for (const time of scheduledTimes) {
            if (time <= Date.now()) {
                continue;
            }
            const job = this.#buildJob(time, currentKey);
            // Reuse the boot job so correctness doesn't depend on token
            // signing being deterministic.
            const staleJob = previousKey ? this.#buildJob(time, previousKey) : job;
            this.#adapter.unschedule(staleJob, { bootstrap });
            if (previousKey) {
                for (const delayMs of this.#legacyDelaysMs) {
                    this.#adapter.unschedule(this.#buildJob(time, previousKey, delayMs), { bootstrap });
                }
            }
            this.#adapter.schedule(job);
            this.#scheduledTimes.add(time);
        }
    }
    #buildJob(time, key, delayMs = FLUSH_DELAY_MS) {
        return (0, build_signed_job_1.buildSignedJob)({
            apiUrl: this.#apiUrl,
            path: this.#endpoint,
            time: time + delayMs,
            key,
        });
    }
}
exports.SignedFlushScheduler = SignedFlushScheduler;
