"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DbBatchSendingRow = exports.DbEmailSendingRow = exports.StoredSendingStatus = void 0;
const zod_1 = require("zod");
const count_1 = require("../../lib/db-types/count");
const date_1 = require("../../lib/db-types/date");
exports.StoredSendingStatus = zod_1.z.enum(['pending', 'submitting', 'submitted', 'failed']);
// Projections of tables the Bookshelf models own, not full rows, so there is no knex table
// augmentation here: typing `emails` by these columns alone would mistype every other read.
exports.DbEmailSendingRow = zod_1.z.object({
    id: zod_1.z.string(),
    status: exports.StoredSendingStatus,
    email_count: count_1.DbCount,
    updated_at: date_1.DbDate.nullable(),
});
exports.DbBatchSendingRow = zod_1.z.object({
    status: exports.StoredSendingStatus,
    created_at: date_1.DbDate,
    updated_at: date_1.DbDate,
    recipient_count: count_1.DbCount,
});
