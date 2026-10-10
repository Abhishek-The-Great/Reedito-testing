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
exports.welcomeEmailAutomationPoll = welcomeEmailAutomationPoll;
const logging_1 = __importDefault(require("@tryghost/logging"));
const db = __importStar(require("../../data/db"));
const constants_1 = require("../member-welcome-emails/constants");
// @ts-expect-error Models currently lack type definitions.
const models_1 = require("../../models");
const LOG_KEY = '[AUTOMATIONS]';
const MAX_RUNS_PER_BATCH = 100;
const MAX_ATTEMPTS = 10;
const RETRY_DELAY_MS = 10 * 60 * 1000;
const LOCK_TIMEOUT = 30 * 60 * 1000;
const isMemberStatus = (value) => Object.hasOwn(constants_1.MEMBER_WELCOME_EMAIL_SLUGS, value);
const slugToMemberStatus = new Map();
for (const [status, slug] of Object.entries(constants_1.MEMBER_WELCOME_EMAIL_SLUGS)) {
    // This should always be true, but TypeScript doesn't know that.
    if (isMemberStatus(status)) {
        slugToMemberStatus.set(slug, status);
    }
}
const getMemberStatus = (slug) => typeof slug === 'string' ? slugToMemberStatus.get(slug) : undefined;
async function fetchAndLockRuns() {
    const now = new Date();
    const lockCutoff = new Date(now.getTime() - LOCK_TIMEOUT);
    return await db.knex.transaction(async (trx) => {
        const runs = await trx('welcome_email_automation_runs as r')
            .join('automations as a', 'r.welcome_email_automation_id', 'a.id')
            .join('welcome_email_automated_emails as e', 'r.next_welcome_email_automated_email_id', 'e.id')
            .whereNotNull('r.next_welcome_email_automated_email_id')
            .where('r.ready_at', '<=', now)
            .where((builder) => {
            builder.whereNull('r.step_started_at').orWhere('r.step_started_at', '<', lockCutoff);
        })
            .select('r.id', 'r.member_id', 'r.step_attempts', 'r.next_welcome_email_automated_email_id', 'a.slug as automation_slug', 'a.status as automation_status', 'e.id as automated_email_id')
            .limit(MAX_RUNS_PER_BATCH);
        if (runs.length === 0) {
            const result = await trx('welcome_email_automation_runs')
                .whereNotNull('next_welcome_email_automated_email_id')
                .where('ready_at', '>', now)
                .select(db.knex.raw('MIN(ready_at) as next_ready_at'))
                .first();
            const nextFutureReadyAt = result?.next_ready_at ? new Date(result.next_ready_at) : null;
            return { runs, nextFutureReadyAt };
        }
        const ids = [];
        for (const run of runs) {
            ids.push(run.id);
            run.step_attempts += 1;
        }
        await trx('welcome_email_automation_runs')
            .whereIn('id', ids)
            .update({
            step_started_at: now,
            step_attempts: db.knex.raw('step_attempts + 1'),
            updated_at: now,
        });
        return { runs, nextFutureReadyAt: null };
    });
}
async function updateRun(runId, attrs, transacting) {
    await models_1.WelcomeEmailAutomationRun.edit(attrs, { id: runId, transacting });
}
async function markExited(runId, exitReason, transacting) {
    await updateRun(runId, {
        next_welcome_email_automated_email_id: null,
        ready_at: null,
        step_started_at: null,
        step_attempts: 0,
        exit_reason: exitReason,
        updated_at: new Date(),
    }, transacting);
}
async function markMaxAttemptsExceeded(runId) {
    await markExited(runId, 'email send failed');
    logging_1.default.warn({
        system: {
            event: 'welcome_email_automations.max_attempts',
            run_id: runId,
        },
    }, `${LOG_KEY} Run ${runId} exceeded max attempts`);
}
async function markRetry(runId, retryAt) {
    await updateRun(runId, {
        step_started_at: null,
        ready_at: retryAt,
        updated_at: new Date(),
    });
}
async function processRun({ run, memberWelcomeEmailService, enqueueAnotherPollAt, }) {
    if (run.step_attempts > MAX_ATTEMPTS) {
        await markMaxAttemptsExceeded(run.id);
        return;
    }
    if (run.automation_status !== 'active') {
        await markExited(run.id, 'automation disabled');
        return;
    }
    const memberStatus = getMemberStatus(run.automation_slug);
    if (!memberStatus) {
        await markExited(run.id, 'email send failed');
        logging_1.default.error({
            system: {
                event: 'welcome_email_automations.unknown_slug',
                slug: run.automation_slug,
            },
        }, `${LOG_KEY} Unknown automation slug: ${run.automation_slug}`);
        return;
    }
    try {
        const member = await models_1.Member.findOne({ id: run.member_id }, { withRelated: ['newsletters'] });
        // When a member is deleted, the run is cascade-deleted. In this edge
        // case, when a member is deleted after the run is loaded but before
        // it's processed, bail. (There's no run to update any longer.)
        if (!member) {
            logging_1.default.warn({
                system: {
                    event: 'welcome_email_automations.member_not_found',
                    run_id: run.id,
                },
            }, `${LOG_KEY} Member not found for run ${run.id}`);
            return;
        }
        const eligibleStatuses = constants_1.MEMBER_WELCOME_EMAIL_ELIGIBLE_STATUSES[memberStatus];
        if (!eligibleStatuses.includes(member.get('status'))) {
            await markExited(run.id, 'member changed status');
            return;
        }
        await memberWelcomeEmailService.api.send({
            member: {
                name: member.get('name'),
                email: member.get('email'),
                uuid: member.get('uuid'),
            },
            memberStatus,
        });
        await db.knex.transaction(async (transacting) => {
            await models_1.AutomatedEmailRecipient.add({
                member_id: run.member_id,
                automated_email_id: run.automated_email_id,
                member_uuid: member.get('uuid'),
                member_email: member.get('email'),
                member_name: member.get('name'),
                track_opens: false,
                track_clicks: false,
            }, { transacting });
            await markExited(run.id, 'finished', transacting);
        });
    }
    catch (err) {
        logging_1.default.error({
            system: {
                event: 'welcome_email_automations.send_failed',
                run_id: run.id,
            },
            err,
        }, `${LOG_KEY} Failed to send welcome email for run ${run.id}`);
        if (run.step_attempts < MAX_ATTEMPTS) {
            const retryAt = new Date(Date.now() + RETRY_DELAY_MS);
            await markRetry(run.id, retryAt);
            enqueueAnotherPollAt(retryAt);
        }
        else {
            await markMaxAttemptsExceeded(run.id);
        }
    }
}
/**
 * Run automations that need it.
 *
 * Runs up to 100 in a batch. If that's met or exceeded, a request to poll
 * again is dispatched.
 */
async function welcomeEmailAutomationPoll(options) {
    const { memberWelcomeEmailService, enqueueAnotherPollAt } = options;
    const { runs, nextFutureReadyAt } = await fetchAndLockRuns();
    if (runs.length === 0) {
        if (nextFutureReadyAt) {
            enqueueAnotherPollAt(nextFutureReadyAt);
        }
        return;
    }
    memberWelcomeEmailService.init();
    await memberWelcomeEmailService.api.loadMemberWelcomeEmails();
    await Promise.allSettled(runs.map((run) => processRun({ run, ...options })));
    // If the batch is full, we might have another batch to execute. (There's
    // no way to know without trying.)
    if (runs.length >= MAX_RUNS_PER_BATCH) {
        enqueueAnotherPollAt(new Date());
    }
}
