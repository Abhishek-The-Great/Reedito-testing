"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailSendingStatus = exports.SendingStatus = exports.SendingProgress = exports.SendingPhase = void 0;
exports.buildSendingStatus = buildSendingStatus;
const zod_1 = require("zod");
const ETA_WINDOW_MS = 60_000;
const ETA_MIN_INTERVALS = 2;
exports.SendingPhase = zod_1.z.enum(['preparing', 'submitting']);
exports.SendingProgress = zod_1.z.object({
    completed: zod_1.z.number().int().nonnegative(),
    total: zod_1.z.number().int().nonnegative(),
    estimatedSecondsRemaining: zod_1.z.number().int().nonnegative().nullable(),
});
exports.SendingStatus = zod_1.z.discriminatedUnion('status', [
    zod_1.z.object({ status: exports.SendingPhase, progress: exports.SendingProgress }),
    zod_1.z.object({ status: zod_1.z.literal('submitted'), progress: exports.SendingProgress }),
    zod_1.z.object({ status: zod_1.z.literal('failed'), progress: exports.SendingProgress, failedDuring: exports.SendingPhase }),
]);
exports.EmailSendingStatus = zod_1.z.object({
    id: zod_1.z.string(),
    sending: exports.SendingStatus,
});
function buildSendingStatus(email, batches) {
    // Submitted is terminal: every batch was accepted, so the email's own recipient count is the
    // answer and the batch aggregation below, which describes a send still in progress, does not apply.
    if (email.status === 'submitted') {
        return {
            status: 'submitted',
            progress: {
                completed: email.recipientCount,
                total: email.recipientCount,
                estimatedSecondsRemaining: 0,
            },
        };
    }
    const phase = batches.some((batch) => batch.status !== 'pending')
        ? 'submitting'
        : 'preparing';
    const attemptStartedAt = email.attemptStartedAt?.getTime() ?? null;
    const preparedCount = sumRecipients(batches);
    const completedBatches = phase === 'preparing' ? batches : batches.filter((batch) => batch.status === 'submitted');
    const completed = sumRecipients(completedBatches);
    const total = phase === 'preparing' ? Math.max(email.recipientCount, preparedCount) : preparedCount;
    if (email.status === 'failed') {
        return {
            status: 'failed',
            progress: { completed, total, estimatedSecondsRemaining: null },
            failedDuring: phase,
        };
    }
    const failedThisAttempt = batches.filter((batch) => failedDuringAttempt(batch, attemptStartedAt));
    const remaining = total - completed - sumRecipients(failedThisAttempt);
    const samples = completedBatches.map((batch) => ({
        recipientCount: batch.recipientCount,
        timestamp: (phase === 'preparing' ? batch.createdAt : batch.updatedAt).getTime(),
    }));
    return {
        status: phase,
        progress: {
            completed,
            total,
            estimatedSecondsRemaining: estimateSecondsRemaining({
                remaining,
                samples,
                attemptStartedAt,
            }),
        },
    };
}
function sumRecipients(batches) {
    return batches.reduce((sum, batch) => sum + batch.recipientCount, 0);
}
// A batch that fails is only retried together with its email, so within an attempt it is finished work.
function failedDuringAttempt(batch, attemptStartedAt) {
    return (batch.status === 'failed' &&
        attemptStartedAt !== null &&
        batch.updatedAt.getTime() >= attemptStartedAt);
}
function estimateSecondsRemaining({ remaining, samples, attemptStartedAt, }) {
    if (remaining <= 0) {
        return 0;
    }
    const sorted = samples
        .filter((sample) => sample.recipientCount > 0 &&
        (attemptStartedAt === null || sample.timestamp >= attemptStartedAt))
        .sort((a, b) => a.timestamp - b.timestamp);
    // Coalesce completions sharing a timestamp so database timestamp precision does
    // not turn their recipients into zero-duration samples or make row order matter.
    const completions = [];
    for (const sample of sorted) {
        const previous = completions.at(-1);
        if (previous?.timestamp === sample.timestamp) {
            previous.recipientCount += sample.recipientCount;
        }
        else {
            completions.push({ ...sample });
        }
    }
    // Three distinct timestamps provide two measured intervals for an initial rate.
    if (completions.length < ETA_MIN_INTERVALS + 1) {
        return null;
    }
    // Include the baseline at or before the last minute so the first interval's
    // recipients have their full elapsed time. Sparse sends still need two intervals.
    const cutoff = completions[completions.length - 1].timestamp - ETA_WINDOW_MS;
    let baseline = completions.length - 1;
    while (baseline > 0 && completions[baseline].timestamp > cutoff) {
        baseline -= 1;
    }
    const window = completions.slice(Math.max(0, Math.min(baseline, completions.length - ETA_MIN_INTERVALS - 1)));
    // Measure combined throughput across the window, including overlapping workers.
    // The first completion is only the baseline: its recipients were processed
    // before the measured time span.
    const seconds = (window[window.length - 1].timestamp - window[0].timestamp) / 1000;
    const recipients = window.slice(1).reduce((sum, sample) => sum + sample.recipientCount, 0);
    return Math.ceil((remaining * seconds) / recipients);
}
