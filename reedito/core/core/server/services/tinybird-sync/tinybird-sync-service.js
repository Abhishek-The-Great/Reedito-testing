"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTinybirdSyncService = createTinybirdSyncService;
const get_ingest_config_1 = require("./get-ingest-config");
const sync_table_to_tinybird_1 = require("./sync-table-to-tinybird");
const INTERVAL_MS = 5 * 60 * 1000;
const BATCH_SIZE = 5000;
// This should be a little less than the maximum, because rows are chunked by
// JSON line, not bytes strictly.
const MAX_PAYLOAD_BYTES = 9 * 1024 * 1024;
const MAX_PAYLOAD_MESSAGES = 1000;
const REQUEST_TIMEOUT_MS = 5 * 60 * 1000;
function createTinybirdSyncService({ config, settingsCache, labs, knex, logging, sleep, random, now, fetch, createId, }) {
    let started = false;
    const syncAll = async (ingest) => {
        const results = await Promise.allSettled(sync_table_to_tinybird_1.AUTOMATION_SYNC_TARGETS.map(async (target) => {
            const sent = await (0, sync_table_to_tinybird_1.syncTableToTinybird)(target, {
                knex,
                ...ingest,
                now,
                fetch,
                createId,
                batchSize: BATCH_SIZE,
                maxPayloadBytes: MAX_PAYLOAD_BYTES,
                maxPayloadMessages: MAX_PAYLOAD_MESSAGES,
                requestTimeoutMs: REQUEST_TIMEOUT_MS,
            });
            logging.info({ system: { event: 'tinybird.sync.completed', table: target.table, sent } }, `[Tinybird sync] ${target.table}: sent ${sent} rows`);
        }));
        for (const result of results) {
            if (result.status === 'rejected') {
                logging.error(result.reason, '[Tinybird sync] Failed to sync table');
            }
        }
    };
    const runLoop = async (ingest) => {
        // Randomize the first wait to avoid all instances syncing at the same time.
        await sleep(Math.floor(random() * INTERVAL_MS));
        while (true) {
            if (labs.isSet('automationsTinybirdSync')) {
                await syncAll(ingest);
            }
            await sleep(INTERVAL_MS);
        }
    };
    const start = () => {
        if (started) {
            return;
        }
        const ingest = (0, get_ingest_config_1.getIngestConfig)({ config, settingsCache });
        if (!ingest) {
            logging.info('[Tinybird sync] Not started: Traffic Analytics service is not configured');
            return;
        }
        started = true;
        const isSyncEnabled = labs.isSet('automationsTinybirdSync');
        logging.info({ system: { event: 'tinybird.sync.started' } }, `[Tinybird sync] Started: sync ${isSyncEnabled ? 'enabled' : 'disabled'} by labs flag (but may change)`);
        void runLoop(ingest)
            .then(() => {
            logging.error('[Tinybird sync] Loop stopped unexpectedly');
        })
            .catch((error) => {
            logging.error(error, '[Tinybird sync] Loop stopped');
        });
    };
    return { start };
}
