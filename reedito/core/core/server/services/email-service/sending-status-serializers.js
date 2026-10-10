"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toEmailStatusesResponse = void 0;
const zod_1 = require("zod");
const case_keys_1 = require("../../lib/case-keys");
const sending_status_1 = require("./sending-status");
const SendingPhaseResource = zod_1.z.enum(['preparing', 'submitting']);
const SendingResource = zod_1.z.object({
    status: zod_1.z.enum(['preparing', 'submitting', 'submitted', 'failed']),
    progress: zod_1.z.object({
        completed: zod_1.z.number(),
        total: zod_1.z.number(),
        estimated_seconds_remaining: zod_1.z.number().nullable(),
    }),
    failed_during: SendingPhaseResource.optional(),
});
const EmailStatusResource = zod_1.z.object({
    id: zod_1.z.string(),
    sending: SendingResource,
});
const EmailStatusesResponse = zod_1.z.object({ email_statuses: zod_1.z.array(EmailStatusResource) });
exports.toEmailStatusesResponse = sending_status_1.EmailSendingStatus.transform(({ id, sending }) => ({
    email_statuses: [
        {
            id,
            sending: {
                status: sending.status,
                progress: (0, case_keys_1.snakeKeys)(sending.progress),
                ...(sending.status === 'failed' ? { failed_during: sending.failedDuring } : {}),
            },
        },
    ],
})).pipe(EmailStatusesResponse);
