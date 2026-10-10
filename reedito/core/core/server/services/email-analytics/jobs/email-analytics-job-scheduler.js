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
exports.EmailAnalyticsJobScheduler = void 0;
const path = __importStar(require("node:path"));
const moment_1 = __importDefault(require("moment"));
const logging = require('@tryghost/logging');
function randomFiveMinuteCron() {
    // Use a random seconds value to avoid spikes to external APIs on the minute.
    const seconds = Math.floor(Math.random() * 60); // 0-59
    // Run every 5 minutes, on 1,6,11..., 2,7,12..., 3,8,13..., etc.
    const minutes = Math.floor(Math.random() * 5); // 0-4
    return `${seconds} ${minutes}/5 * * * *`;
}
function thirtyDaysAgo() {
    return moment_1.default.utc().subtract(30, 'days').toDate();
}
class EmailAnalyticsJobScheduler {
    #scheduledJobNames = new Set();
    #models;
    #config;
    #jobManager;
    constructor({ models, config, jobManager, }) {
        this.#models = models;
        this.#config = config;
        this.#jobManager = jobManager;
    }
    #isConfigured() {
        return Boolean(this.#config.get('emailAnalytics:enabled') &&
            this.#config.get('backgroundJobs:emailAnalytics'));
    }
    async scheduleRecurringNewslettersJob(skipNewsletterEmailCheck = false) {
        // Don't register email analytics job if we have no emails,
        // processor usage from many sites spinning up threads can be high.
        // Mega service will re-run this scheduling task when an email is sent
        await this.#scheduleOnce({
            name: 'email-analytics-fetch-latest',
            workerPath: path.resolve(__dirname, 'fetch-latest/index.js'),
        }, skipNewsletterEmailCheck, async () => Number(await this.#models.Email.where('created_at', '>', thirtyDaysAgo())
            .where('status', '<>', 'failed')
            .count()) > 0);
    }
    async scheduleRecurringAutomationsJob(skipAutomationEmailCheck = false) {
        await this.#scheduleOnce({
            name: 'email-analytics-automation-fetch-latest',
            workerPath: path.resolve(__dirname, 'automation-fetch-latest/index.js'),
        }, skipAutomationEmailCheck, async () => Boolean(await this.#models.AutomatedEmailRecipient.query()
            .where('created_at', '>', thirtyDaysAgo())
            .whereNotNull('mailgun_message_id')
            .first('id')));
    }
    async scheduleRecurringGiftDeliveriesJob(skipGiftDeliveryCheck = false) {
        await this.#scheduleOnce({
            name: 'email-analytics-gift-fetch-latest',
            workerPath: path.resolve(__dirname, 'gift-fetch-latest/index.js'),
        }, skipGiftDeliveryCheck, async () => Boolean(await this.#models.GiftDelivery.query()
            .where('email_sent_at', '>', thirtyDaysAgo())
            .whereNotNull('email_provider_message_id')
            .first('id')));
    }
    async #scheduleOnce(job, skipRecentSendsCheck, hasRecentSends) {
        if (this.#scheduledJobNames.has(job.name) || !this.#isConfigured()) {
            return;
        }
        const shouldSchedule = skipRecentSendsCheck || (await hasRecentSends());
        if (!shouldSchedule || this.#scheduledJobNames.has(job.name)) {
            return;
        }
        const at = randomFiveMinuteCron();
        logging.info(`[Background Job] ${job.name} scheduled at ${at}`);
        this.#jobManager.addJob({ at, job: job.workerPath, name: job.name });
        this.#scheduledJobNames.add(job.name);
    }
}
exports.EmailAnalyticsJobScheduler = EmailAnalyticsJobScheduler;
