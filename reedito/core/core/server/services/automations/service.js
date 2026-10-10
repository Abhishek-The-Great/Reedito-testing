"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutomationsService = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const one_at_a_time_1 = require("../../../shared/one-at-a-time");
const poll_1 = require("./poll");
const automationsApi = __importStar(require("./automations-api"));
const get_scheduler_idempotency_key_1 = require("../../adapters/scheduling/get-scheduler-idempotency-key");
const build_signed_job_1 = require("../../adapters/scheduling/build-signed-job");
const promises_1 = require("node:timers/promises");
const soonest_timer_1 = require("../../lib/soonest-timer");
const scheduler_poll_time_1 = require("./scheduler-poll-time");
// @ts-expect-error This module currently lacks type definitions.
const jobs_1 = __importDefault(require("../email-analytics/jobs"));
const start_automations_poll_event_1 = require("./events/start-automations-poll-event");
const logging = require('@tryghost/logging');
const { welcomeEmailAutomationPoll } = require('./welcome-email-automation-poll');
const memberWelcomeEmailService = require('../member-welcome-emails/service');
const scheduleAutomationEmailAnalyticsJob = () => jobs_1.default.scheduleRecurringAutomationsJob(true);
class AutomationsService {
    #enqueuePollAt;
    init({ domainEvents, apiUrl, schedulerAdapter, internalKeys, siteUuid, }) {
        const isInitialized = Boolean(this.#enqueuePollAt);
        if (isInitialized) {
            return;
        }
        // If we don't get a valid site UUID for some reason, compute jitter with the API URL.
        const siteIdentifier = typeof siteUuid === 'string' && siteUuid.length ? siteUuid : apiUrl;
        const enqueuePollNow = () => domainEvents.dispatch(start_automations_poll_event_1.StartAutomationsPollEvent.create());
        const soonestTimer = new soonest_timer_1.SoonestTimer(enqueuePollNow);
        /**
         * Enqueue an automations poll at a given time.
         *
         * If the poll is in the future, we schedule an in-memory timer *and*
         * tell the scheduler.
         *
         * The in-memory timer can be more precise than the scheduler, and
         * avoids reliance on an external service. The scheduler will wake up
         * the server if it's stopped.
         *
         * (In an upcoming change (NY-1396), we plan to make the scheduler less
         * precise to reduce load--that will make the in-memory timer more
         * useful, but it's still useful now.)
         */
        const enqueuePollAt = async (date) => {
            const isRequestedDateInTheFuture = new Date() < date;
            if (!isRequestedDateInTheFuture) {
                // If you're using synchronous SQLite, we want to finish unwinding the call stack
                // before dispatching another poll event.
                await (0, promises_1.setImmediate)();
                enqueuePollNow();
                return;
            }
            soonestTimer.scheduleAt(date);
            try {
                const schedulerPollTime = (0, scheduler_poll_time_1.getSchedulerPollTime)(date, siteIdentifier);
                const key = await internalKeys.get('reedito-scheduler');
                schedulerAdapter.schedule((0, build_signed_job_1.buildSignedJob)({
                    apiUrl,
                    path: ['automations', 'poll'],
                    time: schedulerPollTime.getTime(),
                    key,
                    getIdempotencyKey: (url) => (0, get_scheduler_idempotency_key_1.getSchedulerIdempotencyKey)({ namespace: 'automations', date, url }),
                }));
            }
            catch (err) {
                logging.error({ event: { name: 'automations.enqueue-poll.error' }, err, at: date.toISOString() }, 'Failed to enqueue automations poll');
            }
        };
        domainEvents.subscribe(start_automations_poll_event_1.StartAutomationsPollEvent, (0, one_at_a_time_1.oneAtATime)(() => (0, poll_1.poll)({
            automationsApi,
            memberWelcomeEmailService,
            scheduleAutomationEmailAnalyticsJob,
            enqueueAnotherPollAt: enqueuePollAt,
        })));
        domainEvents.subscribe(start_automations_poll_event_1.StartAutomationsPollEvent, (0, one_at_a_time_1.oneAtATime)(() => welcomeEmailAutomationPoll({
            memberWelcomeEmailService,
            enqueueAnotherPollAt: enqueuePollAt,
        })));
        schedulerAdapter.register(this);
        enqueuePollAt(new Date());
        this.#enqueuePollAt = enqueuePollAt;
    }
    /**
     * Re-arm the poll chain. A queued poll signed under the previous scheduler
     * key fails JWT verification when fired; this dispatches a fresh in-process
     * poll that re-schedules the next callback under the current key.
     */
    async rescheduleAll() {
        await this.#enqueuePollAt?.(new Date());
    }
    async __testOnlyEnqueuePollAt(date) {
        (0, strict_1.default)(this.#enqueuePollAt, 'Tests should not call this before initialization');
        return await this.#enqueuePollAt(date);
    }
}
exports.AutomationsService = AutomationsService;
