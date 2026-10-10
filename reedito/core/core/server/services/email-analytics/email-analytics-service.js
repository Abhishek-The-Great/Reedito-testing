"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailAnalyticsService = void 0;
const event_processing_result_1 = require("./event-processing-result");
const logging_1 = __importDefault(require("@tryghost/logging"));
const errors_1 = __importDefault(require("@tryghost/errors"));
const TRUST_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
const FETCH_LATEST_END_MARGIN_MS = 1 * 60 * 1000; // Do not fetch events newer than 1 minute (yet). Reduces the chance of having missed events in fetchLatest.
/**
 * Helper function to create an empty fetch result
 * @returns {EmailAnalyticsFetchResult}
 */
function createEmptyResult() {
    return {
        eventCount: 0,
        apiPollingTimeMs: 0,
        processingTimeMs: 0,
        aggregationTimeMs: 0,
        emailAggregationTimeMs: 0,
        memberAggregationTimeMs: 0,
        result: new event_processing_result_1.EventProcessingResult(),
    };
}
class EmailAnalyticsService {
    queries;
    #fetchEvents;
    #createEventProcessor;
    #jobNames;
    #cursorSeed;
    #fetchLatestNonOpenedData;
    #fetchMissingData;
    #fetchLatestOpenedData;
    #fetchScheduledData;
    constructor({ queries, fetchEvents, createEventProcessor, jobNames, cursorSeed, }) {
        this.queries = queries;
        this.#fetchEvents = fetchEvents;
        this.#createEventProcessor = createEventProcessor;
        this.#jobNames = jobNames;
        this.#cursorSeed = cursorSeed;
        this.#fetchLatestNonOpenedData = {
            running: false,
            jobName: jobNames.latestNonOpened,
        };
        this.#fetchMissingData = {
            running: false,
            jobName: jobNames.missing,
        };
        this.#fetchLatestOpenedData = {
            running: false,
            jobName: jobNames.latestOpened,
        };
        this.#fetchScheduledData = {
            running: false,
            jobName: jobNames.scheduled,
        };
    }
    #clearScheduledData() {
        this.#fetchScheduledData = {
            running: false,
            jobName: this.#jobNames.scheduled,
        };
        this.queries.setJobMetadata(this.#jobNames.scheduled, null);
    }
    getStatus() {
        const now = Date.now();
        const withLag = (data) => Object.assign(data, {
            fetchedThrough: data.fetchedThrough ?? null,
            lagSeconds: data.fetchedThrough
                ? Math.max(0, Math.floor((now - data.fetchedThrough.getTime()) / 1000))
                : null,
        });
        return {
            latest: withLag(this.#fetchLatestNonOpenedData),
            missing: withLag(this.#fetchMissingData),
            scheduled: this.#fetchScheduledData,
            latestOpened: withLag(this.#fetchLatestOpenedData),
        };
    }
    /**
     * Returns the timestamp of the last non-opened event we processed. Defaults to now minus 30 minutes if we have no data yet.
     */
    async getLastNonOpenedEventTimestamp() {
        return (this.#fetchLatestNonOpenedData?.lastEventTimestamp ??
            (await this.queries.getLastEventTimestamp(this.#fetchLatestNonOpenedData.jobName, ['delivered', 'failed'], this.#cursorSeed)) ??
            new Date(Date.now() - TRUST_THRESHOLD_MS));
    }
    /**
     * Returns the timestamp of the last opened event we processed. Defaults to now minus 30 minutes if we have no data yet.
     */
    async getLastOpenedEventTimestamp() {
        return (this.#fetchLatestOpenedData?.lastEventTimestamp ??
            (await this.queries.getLastEventTimestamp(this.#fetchLatestOpenedData.jobName, ['opened'], this.#cursorSeed)) ??
            new Date(Date.now() - TRUST_THRESHOLD_MS));
    }
    /**
     * Returns the timestamp of the last missing event we processed. Defaults to now minus 2h if we have no data yet.
     */
    async getLastMissingEventTimestamp() {
        return (this.#fetchMissingData?.lastEventTimestamp ??
            (await this.queries.getLastJobRunTimestamp(this.#fetchMissingData.jobName)) ??
            new Date(Date.now() - TRUST_THRESHOLD_MS * 4));
    }
    /**
     * Fetches the latest opened events.
     */
    async fetchLatestOpenedEvents({ maxEvents = Infinity, } = {}) {
        const begin = await this.getLastOpenedEventTimestamp();
        const end = new Date(Date.now() - FETCH_LATEST_END_MARGIN_MS); // Always stop at x minutes ago to give Mailgun a bit more time to stabilize storage
        if (end <= begin) {
            // Skip for now
            logging_1.default.info('[EmailAnalytics] Skipping fetchLatestOpenedEvents because end (' +
                end +
                ') is before begin (' +
                begin +
                ')');
            return createEmptyResult();
        }
        return await this.#fetchEventsForJob(this.#fetchLatestOpenedData, {
            begin,
            end,
            maxEvents,
            eventTypes: ['opened'],
        });
    }
    /**
     * Fetches the latest non-opened events.
     */
    async fetchLatestNonOpenedEvents({ maxEvents = Infinity, } = {}) {
        const begin = await this.getLastNonOpenedEventTimestamp();
        const end = new Date(Date.now() - FETCH_LATEST_END_MARGIN_MS); // Always stop at x minutes ago to give Mailgun a bit more time to stabilize storage
        if (end <= begin) {
            // Skip for now
            logging_1.default.info('[EmailAnalytics] Skipping fetchLatestNonOpenedEvents because end (' +
                end +
                ') is before begin (' +
                begin +
                ')');
            return createEmptyResult();
        }
        return await this.#fetchEventsForJob(this.#fetchLatestNonOpenedData, {
            begin,
            end,
            maxEvents,
            eventTypes: ['delivered', 'failed', 'unsubscribed', 'complained'],
        });
    }
    /**
     * Fetches events that are older than 30 minutes, because then the 'storage' of the Mailgun API is stable. And we are sure we don't miss any events.
     * @param [options.maxEvents] Not a strict maximum. We stop fetching after we reached the maximum AND received at least one event after begin (not equal) to prevent deadlocks.
     */
    async fetchMissing({ maxEvents = Infinity, } = {}) {
        const begin = await this.getLastMissingEventTimestamp();
        // Always stop at the earlier of the time the fetchLatest started fetching on or 30 minutes ago
        const end = new Date(Math.min(Date.now() - TRUST_THRESHOLD_MS, this.#fetchLatestNonOpenedData?.lastBegin?.getTime() || Date.now()));
        if (end <= begin) {
            // Skip for now
            logging_1.default.info('[EmailAnalytics] Skipping fetchMissing because end (' +
                end +
                ') is before begin (' +
                begin +
                ')');
            return createEmptyResult();
        }
        return await this.#fetchEventsForJob(this.#fetchMissingData, { begin, end, maxEvents });
    }
    /**
     * Schedule a new fetch for email analytics events.
     * @throws {errors.ValidationError} Throws an error if a fetch is already in progress.
     */
    async schedule({ begin, end }) {
        if (this.#fetchScheduledData && this.#fetchScheduledData.running) {
            throw new errors_1.default.ValidationError({
                message: 'Already fetching scheduled events. Wait for it to finish before scheduling a new one.',
            });
        }
        logging_1.default.info('[EmailAnalytics] Scheduling fetch from ' +
            begin.toISOString() +
            ' until ' +
            end.toISOString());
        this.#fetchScheduledData = {
            running: false,
            jobName: this.#jobNames.scheduled,
            schedule: {
                begin,
                end,
            },
        };
        await this.queries.setJobMetadata(this.#jobNames.scheduled, {
            begin: begin.toISOString(),
            end: end.toISOString(),
        });
    }
    /**
     * Cancels the scheduled fetch of email analytics events.
     * If a fetch is currently running, it marks it for cancellation.
     * If no fetch is running, it clears the scheduled fetch data.
     */
    cancelScheduled() {
        if (this.#fetchScheduledData) {
            if (this.#fetchScheduledData.running) {
                this.#fetchScheduledData.canceled = true;
                // Clear metadata eagerly; fetchScheduled() will clear in-memory state next cycle
                this.queries.setJobMetadata(this.#jobNames.scheduled, null);
            }
            else {
                this.#clearScheduledData();
            }
        }
    }
    /**
     * Restores a previously persisted scheduled fetch from the database.
     * Must only be called once on startup (caller guards against repeated calls).
     */
    async restoreScheduled() {
        try {
            const jobData = await this.queries.getJobData(this.#jobNames.scheduled);
            if (!jobData) {
                return;
            }
            const { metadata } = jobData;
            if (metadata.begin && metadata.end) {
                const begin = new Date(metadata.begin);
                const end = new Date(metadata.end);
                this.#fetchScheduledData = {
                    running: false,
                    jobName: this.#jobNames.scheduled,
                    schedule: { begin, end },
                };
                // Use finished_at as the resume cursor if available
                if (jobData.finished_at) {
                    this.#fetchScheduledData.lastEventTimestamp = new Date(jobData.finished_at);
                }
                logging_1.default.info('[EmailAnalytics] Restored scheduled fetch: ' +
                    begin.toISOString() +
                    ' to ' +
                    end.toISOString());
            }
        }
        catch (e) {
            logging_1.default.error('[EmailAnalytics] Failed to restore scheduled fetch', e);
        }
    }
    /**
     * Continues fetching the scheduled events (does not start one). Resets the scheduled event when received 0 events.
     */
    async fetchScheduled({ maxEvents = Infinity, } = {}) {
        if (!this.#fetchScheduledData || !this.#fetchScheduledData.schedule) {
            // Nothing scheduled
            return createEmptyResult();
        }
        if (this.#fetchScheduledData.canceled) {
            this.#clearScheduledData();
            return createEmptyResult();
        }
        let begin = this.#fetchScheduledData.schedule.begin;
        const end = this.#fetchScheduledData.schedule.end;
        if (this.#fetchScheduledData.lastEventTimestamp &&
            this.#fetchScheduledData.lastEventTimestamp > begin) {
            // Continue where we left of
            begin = this.#fetchScheduledData.lastEventTimestamp;
        }
        if (end <= begin) {
            logging_1.default.info('[EmailAnalytics] Ending fetchScheduled because end is before begin');
            this.#clearScheduledData();
            return createEmptyResult();
        }
        const fetchResult = await this.#fetchEventsForJob(this.#fetchScheduledData, {
            begin,
            end,
            maxEvents,
        });
        if (fetchResult.eventCount === 0 || this.#fetchScheduledData.canceled) {
            this.#clearScheduledData();
        }
        this.queries.setJobTimestamp(this.#fetchScheduledData.jobName, 'finished', this.#fetchScheduledData.lastEventTimestamp);
        return fetchResult;
    }
    /**
     * Start fetching analytics and store the data of the progress inside fetchData
     * @param [options.maxEvents=Infinity] - Maximum number of events to fetch. Not a strict maximum. We stop fetching after we reached the maximum AND received at least one event after begin (not equal) to prevent deadlocks.
     * @param [options.eventTypes] - Array of event types to fetch. If not provided, Mailgun will return all event types.
     */
    async #fetchEventsForJob(fetchData, { begin, end, maxEvents = Infinity, eventTypes, }) {
        // Start where we left of, or the last stored event in the database, or start 30 minutes ago if we have nothing available
        // Store that we started fetching
        fetchData.running = true;
        fetchData.lastStarted = new Date();
        fetchData.lastBegin = begin;
        await this.queries.setJobTimestamp(fetchData.jobName, 'started', begin);
        // Timing metrics
        const fetchStartMs = Date.now();
        let processingTimeMs = 0;
        let aggregationTimeMs = 0;
        let emailAggregationTimeMs = 0;
        let memberAggregationTimeMs = 0;
        let eventCount = 0;
        const includeOpenedEvents = eventTypes?.includes('opened') ?? false;
        const eventProcessor = this.#createEventProcessor();
        // We keep the processing result here, so we also have a result in case of failures
        const processingResult = new event_processing_result_1.EventProcessingResult();
        // Track cumulative event counts separately since processingResult gets reset during intermediate aggregations
        const cumulativeResult = new event_processing_result_1.EventProcessingResult();
        let error = null;
        const aggregate = async (isFinal) => {
            if (!eventProcessor.aggregate) {
                return;
            }
            const start = Date.now();
            const timings = await eventProcessor.aggregate({
                includeOpenedEvents,
                processingResult,
                isFinal,
            });
            if (!timings) {
                return;
            }
            aggregationTimeMs += Date.now() - start;
            emailAggregationTimeMs += timings.emailAggregationTimeMs;
            memberAggregationTimeMs += timings.memberAggregationTimeMs;
        };
        const processBatch = async (events) => {
            // Even if the fetching is interrupted because of an error, we still store the last event timestamp
            const processingStart = Date.now();
            // Capture the state before processing to calculate delta
            const beforeCounts = {
                opened: processingResult.opened,
                delivered: processingResult.delivered,
                temporaryFailed: processingResult.temporaryFailed,
                permanentFailed: processingResult.permanentFailed,
                unsubscribed: processingResult.unsubscribed,
                complained: processingResult.complained,
                unhandled: processingResult.unhandled,
                unprocessable: processingResult.unprocessable,
            };
            const beforeEmailIds = new Set(processingResult.emailIds);
            const beforeMemberIds = new Set(processingResult.memberIds);
            await eventProcessor.processBatch(events, processingResult, fetchData);
            processingTimeMs += Date.now() - processingStart;
            eventCount += events.length;
            // Calculate delta (only new counts from this batch) and accumulate for final reporting
            const batchDelta = new event_processing_result_1.EventProcessingResult({
                opened: processingResult.opened - beforeCounts.opened,
                delivered: processingResult.delivered - beforeCounts.delivered,
                temporaryFailed: processingResult.temporaryFailed - beforeCounts.temporaryFailed,
                permanentFailed: processingResult.permanentFailed - beforeCounts.permanentFailed,
                unsubscribed: processingResult.unsubscribed - beforeCounts.unsubscribed,
                complained: processingResult.complained - beforeCounts.complained,
                unhandled: processingResult.unhandled - beforeCounts.unhandled,
                unprocessable: processingResult.unprocessable - beforeCounts.unprocessable,
                emailIds: processingResult.emailIds.filter((id) => !beforeEmailIds.has(id)),
                memberIds: processingResult.memberIds.filter((id) => !beforeMemberIds.has(id)),
            });
            cumulativeResult.merge(batchDelta);
            // Offer the event processor a chance to aggregate mid-fetch.
            try {
                if (eventCount) {
                    await aggregate(false);
                }
            }
            catch (err) {
                logging_1.default.error('[EmailAnalytics] Error while aggregating stats');
                logging_1.default.error(err);
            }
            if (fetchData.canceled) {
                throw new errors_1.default.InternalServerError({
                    message: 'Fetching canceled',
                });
            }
        };
        let fetchedThrough;
        try {
            const fetchResult = await this.#fetchEvents({
                batchHandler: processBatch,
                begin,
                end,
                maxEvents,
                events: eventTypes,
            });
            // A void result means fetching was skipped (for example, Mailgun is not configured).
            // Empty successful windows still establish progress through their requested end.
            if (fetchResult) {
                fetchedThrough = fetchResult.safeCursor ?? end;
            }
            if (fetchResult?.safeCursor &&
                (!fetchData.lastEventTimestamp || fetchResult.safeCursor < fetchData.lastEventTimestamp)) {
                fetchData.lastEventTimestamp = fetchResult.safeCursor;
            }
        }
        catch (err) {
            // A fetch can process events from one domain before another domain fails. Keep the
            // in-memory cursor at the start of this run so the next attempt retries every domain.
            fetchData.lastEventTimestamp = begin;
            if (!(err instanceof Error) || err.message !== 'Fetching canceled') {
                logging_1.default.error('[EmailAnalytics] Error while fetching');
                logging_1.default.error(err);
                error = err;
            }
            else {
                logging_1.default.error('[EmailAnalytics] Canceled fetching');
            }
        }
        // Final aggregation.
        try {
            await aggregate(true);
        }
        catch (err) {
            logging_1.default.error('[EmailAnalytics] Error while aggregating stats');
            logging_1.default.error(err);
            if (!error) {
                error = err;
            }
        }
        // When we've consumed all available events (eventCount < maxEvents), advance the cursor by 1 second
        // to avoid re-fetching the same batch on the next cycle. When we hit the maxEvents budget mid-second,
        // do NOT advance — the next pass needs to re-cover that second to pick up any remaining events.
        if (!error &&
            eventCount > 0 &&
            fetchData.lastEventTimestamp &&
            fetchData.lastEventTimestamp.getTime() < Date.now() - 2000) {
            // Persist cursor to DB so we can resume after reboot
            await this.queries.setJobTimestamp(fetchData.jobName, 'finished', new Date(fetchData.lastEventTimestamp.getTime()));
            if (eventCount < maxEvents) {
                // Consumed everything in the window — advance to avoid re-fetching same batch
                fetchData.lastEventTimestamp = new Date(fetchData.lastEventTimestamp.getTime() + 1000);
            }
        }
        else {
            await this.queries.setJobStatus(fetchData.jobName, 'finished');
        }
        fetchData.running = false;
        const totalTimeMs = Date.now() - fetchStartMs;
        // Derived by subtraction because fetchLatest() invokes processBatch internally,
        // so directly timing fetchLatest() would double-count processing and aggregation time.
        const apiPollingTimeMs = totalTimeMs - processingTimeMs - aggregationTimeMs;
        if (error) {
            throw error;
        }
        if (fetchedThrough) {
            fetchData.fetchedThrough = fetchedThrough;
        }
        return {
            eventCount,
            apiPollingTimeMs,
            processingTimeMs,
            aggregationTimeMs,
            emailAggregationTimeMs,
            memberAggregationTimeMs,
            result: cumulativeResult,
        };
    }
}
exports.EmailAnalyticsService = EmailAnalyticsService;
