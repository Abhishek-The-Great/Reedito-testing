"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EMPTY_AUTOMATION_STATS = void 0;
exports.fetchAutomationStats = fetchAutomationStats;
const logging_1 = __importDefault(require("@tryghost/logging"));
const zod_1 = require("zod");
exports.EMPTY_AUTOMATION_STATS = {
    last_run_created_at: null,
    total_run_count: 0,
    in_progress_run_count: 0,
};
const runCountSchema = zod_1.z
    .union([zod_1.z.number(), zod_1.z.string().regex(/^\d+$/)])
    .pipe(zod_1.z.coerce.number().int().nonnegative());
const statsRowSchema = zod_1.z.object({
    automation_id: zod_1.z.string(),
    last_run_created_at: zod_1.z.iso
        .datetime()
        .transform((value) => new Date(value))
        .nullable(),
    total_run_count: runCountSchema,
    in_progress_run_count: runCountSchema,
});
async function fetchAutomationStats(client) {
    let rows;
    try {
        // Override the traffic analytics version: this pipe has no version suffix.
        rows = await client.fetch('api_automation_browse_stats', { version: '' });
    }
    catch (error) {
        logging_1.default.error('Error fetching Tinybird automation stats:', error);
        return null;
    }
    if (rows === null) {
        return null;
    }
    const parsed = zod_1.z.array(statsRowSchema).safeParse(rows);
    if (!parsed.success) {
        logging_1.default.error({
            system: { event: 'automations.stats.invalid_tinybird_response' },
            issues: parsed.error.issues,
        }, 'Unexpected response from the Tinybird automation stats pipe');
        return null;
    }
    return new Map(parsed.data.map((row) => [
        row.automation_id,
        {
            last_run_created_at: row.last_run_created_at,
            total_run_count: row.total_run_count,
            in_progress_run_count: row.in_progress_run_count,
        },
    ]));
}
