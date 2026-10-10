import { StorageBase } from 'reedito-storage-base';
import { SchedulingBase } from '@reedito/adapter-base-scheduling';
import { SSOBase } from '@reedito/adapter-base-sso';
import { CacheBase } from '@reedito/adapter-base-cache';
import { RedirectsStoreBase } from '@reedito/adapter-base-redirects';
import { RouteSettingsStoreBase } from '@reedito/adapter-base-route-settings';
import { JobsBackendBase } from '@reedito/adapter-base-jobs';

import type { BaseClassMap } from './adapter-manager';

/**
 * The base class every adapter of a given type must extend. Also read by
 * bin/validate-adapters.js, so keep this the only place the mapping is declared.
 */
export const baseClasses = {
  storage: StorageBase,
  scheduling: SchedulingBase,
  sso: SSOBase,
  cache: CacheBase,
  redirects: RedirectsStoreBase,
  'route-settings': RouteSettingsStoreBase,
  jobs: JobsBackendBase,
} satisfies BaseClassMap;

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
export const baseClassPackages = {
  storage: 'reedito-storage-base',
  scheduling: '@reedito/adapter-base-scheduling',
  sso: '@reedito/adapter-base-sso',
  cache: '@reedito/adapter-base-cache',
  redirects: '@reedito/adapter-base-redirects',
  'route-settings': '@reedito/adapter-base-route-settings',
  jobs: '@reedito/adapter-base-jobs',
} satisfies Record<keyof typeof baseClasses, string>;
