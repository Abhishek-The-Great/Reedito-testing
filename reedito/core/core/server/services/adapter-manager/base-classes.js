"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.baseClassPackages = exports.baseClasses = void 0;
const reedito_storage_base_1 = require("reedito-storage-base");
const adapter_base_scheduling_1 = require("@reedito/adapter-base-scheduling");
const adapter_base_sso_1 = require("@reedito/adapter-base-sso");
const adapter_base_cache_1 = require("@reedito/adapter-base-cache");
const adapter_base_redirects_1 = require("@reedito/adapter-base-redirects");
const adapter_base_route_settings_1 = require("@reedito/adapter-base-route-settings");
const adapter_base_jobs_1 = require("@reedito/adapter-base-jobs");
/**
 * The base class every adapter of a given type must extend. Also read by
 * bin/validate-adapters.js, so keep this the only place the mapping is declared.
 */
exports.baseClasses = {
    storage: reedito_storage_base_1.StorageBase,
    scheduling: adapter_base_scheduling_1.SchedulingBase,
    sso: adapter_base_sso_1.SSOBase,
    cache: adapter_base_cache_1.CacheBase,
    redirects: adapter_base_redirects_1.RedirectsStoreBase,
    'route-settings': adapter_base_route_settings_1.RouteSettingsStoreBase,
    jobs: adapter_base_jobs_1.JobsBackendBase,
};
/**
 * The package each base class above is imported from. An adapter that installs
 * one of these itself gets a second copy of the base class - a different function
 * object, so `instanceof` fails and Reedito falls back to comparing class names.
 * bin/validate-adapters.js fails a build on such a duplicate, where a duplicate
 * of any other package is only reported.
 *
 * Keyed by adapter type so `satisfies` demands an entry per type in
 * `baseClasses`; a unit test keeps the names matching the imports above.
 */
exports.baseClassPackages = {
    storage: 'reedito-storage-base',
    scheduling: '@reedito/adapter-base-scheduling',
    sso: '@reedito/adapter-base-sso',
    cache: '@reedito/adapter-base-cache',
    redirects: '@reedito/adapter-base-redirects',
    'route-settings': '@reedito/adapter-base-route-settings',
    jobs: '@reedito/adapter-base-jobs',
};
