"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobsService = void 0;
const errors_1 = __importDefault(require("@tryghost/errors"));
const cron_validate_1 = __importDefault(require("cron-validate"));
class JobsService {
    #backend;
    #logging;
    #sentry;
    #registry = new Map();
    #queueByType = new Map();
    #queues = new Map();
    constructor({ backend, logging, sentry }) {
        this.#backend = backend;
        this.#logging = logging;
        this.#sentry = sentry;
    }
    handle(JobClass, handler, options) {
        const type = JobClass.type;
        if (typeof type !== 'string' || type.length === 0) {
            throw new errors_1.default.IncorrectUsageError({
                message: `Cannot register a job handler: ${JobClass.name ?? 'job class'} is missing a static "type" string.`,
            });
        }
        if (this.#registry.has(type)) {
            throw new errors_1.default.IncorrectUsageError({
                message: `A handler for job type "${type}" is already registered.`,
            });
        }
        this.#declareQueue(type, options);
        this.#registry.set(type, (payload) => handler(new JobClass(JSON.parse(payload))));
    }
    #declareQueue(type, options) {
        if (!options) {
            return;
        }
        const { queue, concurrency } = options;
        if (typeof queue !== 'string' || queue.length === 0) {
            throw new errors_1.default.IncorrectUsageError({
                message: `Invalid queue for job type "${type}": ${JSON.stringify(queue)}. Expected a non-empty string.`,
            });
        }
        // "default" is the backend's shared lane for types that declare no queue;
        // declaring it would silently re-size that lane for every unrouted type.
        if (queue === 'default') {
            throw new errors_1.default.IncorrectUsageError({
                message: `Queue name "default" is reserved for the shared lane; job type "${type}" must omit options to use it.`,
            });
        }
        if (!Number.isInteger(concurrency) || concurrency < 1) {
            throw new errors_1.default.IncorrectUsageError({
                message: `Invalid concurrency for job type "${type}": ${JSON.stringify(concurrency)}. Expected a positive integer.`,
            });
        }
        const existing = this.#queues.get(queue);
        if (existing && existing.concurrency !== concurrency) {
            throw new errors_1.default.IncorrectUsageError({
                message: `Conflicting concurrency for queue "${queue}": ${existing.concurrency} is already declared, job type "${type}" declares ${concurrency}.`,
            });
        }
        this.#queues.set(queue, { concurrency });
        this.#queueByType.set(type, queue);
    }
    #routingFor(type) {
        const queue = this.#queueByType.get(type);
        return queue === undefined ? undefined : { queue };
    }
    /**
     * Resolves when the backend's enqueue call completes, without waiting for the
     * handler to run. Enqueue errors reject this promise. Resolution does not
     * guarantee execution: the backend controls what happens to work during shutdown.
     */
    async dispatch(job) {
        const envelope = this.#buildEnvelope(job);
        await this.#backend.enqueue(envelope, this.#routingFor(envelope.type));
    }
    async scheduleRecurring(job, schedule) {
        this.#assertValidCron(schedule.cron);
        const envelope = this.#buildEnvelope(job);
        await this.#backend.scheduleRecurring(envelope, schedule, this.#routingFor(envelope.type));
    }
    // later.parse.cron does not strictly validate: it silently coerces a
    // malformed expression into a bogus schedule (garbage -> every minute,
    // out-of-range -> clamped, an impossible date -> effectively never), so
    // validate up front and fail loudly instead.
    #assertValidCron(cron) {
        const result = (0, cron_validate_1.default)(cron, {
            preset: 'default', // the seconds field is not supported in the default preset
            override: { useSeconds: true },
        });
        if (!result.isValid()) {
            throw new errors_1.default.IncorrectUsageError({
                message: `Invalid cron expression: ${JSON.stringify(cron)}.`,
            });
        }
    }
    async start() {
        await this.#backend.start({
            processor: (envelope) => this.#process(envelope),
            queues: Object.fromEntries(this.#queues),
        });
    }
    async shutdown(options) {
        await this.#backend.shutdown(options);
    }
    // An in-process restart (test harness) re-runs handler registration on the
    // same instance, so all registration state resets - handlers and queue
    // declarations alike. The duplicate-type guard still holds within a boot.
    clearHandlers() {
        this.#registry.clear();
        this.#queueByType.clear();
        this.#queues.clear();
    }
    #buildEnvelope(job) {
        return { type: this.#typeOf(job), payload: JSON.stringify(job) };
    }
    #typeOf(job) {
        const ctor = job.constructor;
        const type = ctor.type;
        if (typeof type !== 'string' || type.length === 0) {
            throw new errors_1.default.IncorrectUsageError({
                message: `Cannot dispatch job: ${ctor.name ?? 'job'} is missing a static "type" string.`,
            });
        }
        return type;
    }
    async #process(envelope) {
        const deliver = this.#registry.get(envelope.type);
        if (!deliver) {
            this.#logging.error(`No handler registered for job type "${envelope.type}"; dropping delivery.`);
            return;
        }
        const startedAt = Date.now();
        this.#logging.info(`[Background Job] ${envelope.type} started`);
        try {
            await deliver(envelope.payload);
        }
        catch (err) {
            this.#logging.error(err, `[Background Job] ${envelope.type} failed after ${Date.now() - startedAt}ms`);
            this.#sentry?.captureException(err, { tags: { job_type: envelope.type } });
            throw err;
        }
        const durationMs = Date.now() - startedAt;
        this.#logging.info({
            system: {
                event: 'job.completed',
                job_type: envelope.type,
                duration_ms: durationMs,
            },
        }, `[Background Job] ${envelope.type} completed in ${durationMs}ms`);
    }
}
exports.JobsService = JobsService;
