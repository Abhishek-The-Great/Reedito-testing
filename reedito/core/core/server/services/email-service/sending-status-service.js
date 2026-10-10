"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SendingStatusService = void 0;
const case_keys_1 = require("../../lib/case-keys");
const sending_status_schema_1 = require("./sending-status-schema");
const sending_status_1 = require("./sending-status");
class SendingStatusService {
    #knex;
    constructor({ knex }) {
        this.#knex = knex;
    }
    async statusFor(emailId) {
        const row = await this.#knex('emails')
            .select('id', 'status', 'email_count', 'updated_at')
            .where('id', emailId)
            .first();
        if (!row) {
            return null;
        }
        const email = sending_status_schema_1.DbEmailSendingRow.parse(row);
        // A submitted email answers from its own count, and batch creation reconciles email_count
        // to the recipient rows it built, so the batch query is skipped rather than run and ignored.
        const batches = email.status === 'submitted' ? [] : await this.#batchesFor(emailId);
        return {
            id: email.id,
            sending: (0, sending_status_1.buildSendingStatus)({
                status: email.status,
                recipientCount: email.email_count,
                // The sending job saves the email when it takes its status lock, so updated_at
                // stands in for the attempt start that Reedito does not record.
                attemptStartedAt: email.updated_at,
            }, batches),
        };
    }
    async #batchesFor(emailId) {
        // Correlated per-batch count stays on the batch_id index; grouping recipients by email_id scans every recipient row.
        const recipientCount = this.#knex('email_recipients as recipient')
            .count('*')
            .whereRaw('recipient.batch_id = batch.id');
        const rows = await this.#knex('email_batches as batch')
            .select('batch.status', 'batch.created_at', 'batch.updated_at')
            .select(recipientCount.as('recipient_count'))
            .where('batch.email_id', emailId);
        return rows.map((batchRow) => (0, case_keys_1.camelKeys)(sending_status_schema_1.DbBatchSendingRow.parse(batchRow)));
    }
}
exports.SendingStatusService = SendingStatusService;
