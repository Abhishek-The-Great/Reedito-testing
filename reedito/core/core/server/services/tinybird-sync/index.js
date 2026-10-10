"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.start = void 0;
const promises_1 = require("node:timers/promises");
const bson_objectid_1 = __importDefault(require("bson-objectid"));
const logging_1 = __importDefault(require("@tryghost/logging"));
const config_1 = __importDefault(require("../../../shared/config"));
// @ts-expect-error This module lacks type definitions.
const labs_1 = __importDefault(require("../../../shared/labs"));
// @ts-expect-error This module lacks type definitions.
const settings_cache_1 = __importDefault(require("../../../shared/settings-cache"));
const db_1 = require("../../data/db");
const tinybird_sync_service_1 = require("./tinybird-sync-service");
const service = (0, tinybird_sync_service_1.createTinybirdSyncService)({
    config: config_1.default,
    settingsCache: settings_cache_1.default,
    labs: labs_1.default,
    knex: db_1.knex,
    logging: logging_1.default,
    sleep: async (ms) => {
        await (0, promises_1.setTimeout)(ms, undefined, { ref: false });
    },
    random: Math.random,
    now: () => new Date(),
    fetch: globalThis.fetch,
    createId: () => (0, bson_objectid_1.default)().toHexString(),
});
exports.start = service.start;
