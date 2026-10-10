"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIngestConfig = getIngestConfig;
const zod_1 = require("zod");
const StatsConfigSchema = zod_1.z.object({
    id: zod_1.z.string().min(1).optional(),
});
const SiteUuidSchema = zod_1.z.string().min(1);
const SyncAuthKeySchema = zod_1.z.string().min(1);
const TrackerEndpointSchema = zod_1.z.url();
const ANALYTICS_PATH_PREFIX = '/.reedito/analytics/';
function getIngestConfig({ config, settingsCache, }) {
    const trackerEndpointResult = TrackerEndpointSchema.safeParse(config.get('tinybird:tracker:endpoint'));
    const syncAuthKeyResult = SyncAuthKeySchema.safeParse(config.get('tinybird:sync_auth_key'));
    if (!trackerEndpointResult.success || !syncAuthKeyResult.success) {
        return null;
    }
    const endpoint = new URL(trackerEndpointResult.data);
    const analyticsPathIndex = endpoint.pathname.indexOf(ANALYTICS_PATH_PREFIX);
    if (analyticsPathIndex === -1) {
        return null;
    }
    endpoint.pathname = `${endpoint.pathname.slice(0, analyticsPathIndex + ANALYTICS_PATH_PREFIX.length)}api/v1/tinybird-sync`;
    const statsResult = StatsConfigSchema.safeParse(config.get('tinybird:stats'));
    const settingsSiteUuidResult = SiteUuidSchema.safeParse(settingsCache.get('site_uuid'));
    let siteUuid = statsResult.success ? statsResult.data.id : undefined;
    if (!siteUuid && settingsSiteUuidResult.success) {
        siteUuid = settingsSiteUuidResult.data;
    }
    if (!siteUuid) {
        return null;
    }
    return {
        endpoint,
        // secretlint-disable-next-line @secretlint/secretlint-rule-pattern
        trafficAnalyticsAuth: syncAuthKeyResult.data,
        siteUuid,
    };
}
