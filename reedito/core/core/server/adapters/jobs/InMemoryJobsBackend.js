"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const errors_1 = __importDefault(require("@tryghost/errors"));
const fastq_1 = __importDefault(require("fastq"));
const adapter_base_jobs_1 = require("@reedito/adapter-base-jobs");
const later = require('@breejs/later');
const logging = require('@tryghost/logging');
const DEFAULT_SHUTDOWN_TIMEOUT_MS = 10000;
const DEFAULT_CONCURRENCY = 3;
// Envelopes with no routing share this lane; routing to "default" by name is
// the same lane, not a collision.
const DEFAULT_QUEUE = 'default';
function hasSeconds(cron) {
    return cron.trim().split(/\s+/).length >= 6;
}
function resolveConcurrency(value) {
    if (value === undefined || value === null) {
        return DEFAULT_CONCURRENCY;
    }
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
        throw new errors_1.default.IncorrectUsageError({
            message: `Invalid jobs backend concurrency: ${JSON.stringify(value)}. Expected a positive integer.`,
        });
    }
    return value;
}
function delay(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
// Work only flows between start() and shutdown(): boot starts the service
// before the web app is mounted or any recurring job is scheduled, so an
// enqueue or recurring registration before start() is a boot-ordering bug and
// throws, while an enqueue after shutdown() is a benign shutdown race and is
// dropped.
class InMemoryJobsBackend extends adapter_base_jobs_1.JobsBackendBase {
    _processor;
    _stopped;
    _defaultConcurrency;
    _queues;
    _recurring;
    constructor(config = {}) {
        super();
        this._processor = null;
        this._stopped = false;
        this._defaultConcurrency = resolveConcurrency(config.concurrency);
        this._queues = new Map();
        this._recurring = new Map();
    }
    _makeQueue(concurrency) {
        return fastq_1.default.promise((envelope) => this._deliver(envelope), concurrency);
    }
    start({ processor, queues }) {
        const declared = new Map();
        for (const [name, { concurrency }] of Object.entries(queues ?? {})) {
            // A declaration the backend cannot satisfy must fail loudly here, never
            // silently fall back (see the jobs-base README).
            if (concurrency !== undefined && (!Number.isInteger(concurrency) || concurrency < 1)) {
                throw new errors_1.default.IncorrectUsageError({
                    message: `Invalid concurrency for declared queue "${name}": ${JSON.stringify(concurrency)}. Expected a positive integer.`,
                });
            }
            declared.set(name, concurrency ?? this._defaultConcurrency);
        }
        // State only changes once every declaration is valid, so a rejected
        // start() never leaves a partially started backend that accepts work.
        this._processor = processor;
        this._stopped = false;
        for (const [name, concurrency] of declared) {
            this._queues.set(name, this._makeQueue(concurrency));
        }
    }
    enqueue(envelope, routing) {
        if (this._stopped) {
            return;
        }
        if (!this._processor) {
            throw new errors_1.default.IncorrectUsageError({
                message: `Cannot enqueue job "${envelope.type}" before the jobs backend is started.`,
            });
        }
        const name = routing?.queue ?? DEFAULT_QUEUE;
        let queue = this._queues.get(name);
        if (!queue) {
            // Lanes are created lazily: the default lane, and any queue name no
            // handler declared, each get their own lane at the default concurrency.
            queue = this._makeQueue(this._defaultConcurrency);
            this._queues.set(name, queue);
        }
        queue.push(envelope);
    }
    async _deliver(envelope) {
        try {
            await this._processor(envelope);
        }
        catch (err) {
            logging.error(`Job "${envelope.type}" delivery failed`, err);
        }
    }
    scheduleRecurring(envelope, { cron }, routing) {
        if (this._stopped) {
            return;
        }
        if (!this._processor) {
            throw new errors_1.default.IncorrectUsageError({
                message: `Cannot schedule recurring job "${envelope.type}" before the jobs backend is started.`,
            });
        }
        // First schedule per type wins; a re-registration must not disturb a
        // schedule that is already running (parity with a durable backend).
        if (this._recurring.has(envelope.type)) {
            return;
        }
        const parsed = later.parse.cron(cron, hasSeconds(cron));
        const timer = later.setInterval(() => {
            // A throw inside a later timer callback would be an uncaughtException;
            // a recurring tick must never take the process down.
            try {
                this.enqueue(envelope, routing);
            }
            catch (err) {
                logging.error(`Recurring job "${envelope.type}" tick failed to enqueue`, err);
            }
        }, parsed);
        this._recurring.set(envelope.type, timer);
    }
    _clearRecurring(type) {
        const timer = this._recurring.get(type);
        if (timer) {
            timer.clear();
            this._recurring.delete(type);
        }
    }
    async shutdown(options = {}) {
        const timeoutMs = options.timeoutMs ?? DEFAULT_SHUTDOWN_TIMEOUT_MS;
        this._stopped = true;
        for (const type of [...this._recurring.keys()]) {
            this._clearRecurring(type);
        }
        const queues = [...this._queues.values()];
        for (const queue of queues) {
            queue.kill();
        }
        const draining = queues.filter((queue) => !queue.idle());
        if (draining.length > 0) {
            await Promise.race([Promise.all(draining.map((queue) => queue.drained())), delay(timeoutMs)]);
        }
        // Discard the queues so a re-boot never inherits this lifecycle's
        // abandoned in-flight deliveries against its concurrency limits.
        this._queues = new Map();
        this._processor = null;
    }
}
exports.default = InMemoryJobsBackend;
