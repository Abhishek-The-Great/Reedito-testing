import { createRequire } from 'node:module';
import { dirname, resolve } from 'path';

import { defaultClientConditions } from 'vite';

const require = createRequire(import.meta.url);

/**
 * Config fragments shared by vite.config.ts (dev/build + unit tests) and
 * vitest.acceptance.config.ts, so the TODO-gated @tryghost/nql shims live in
 * exactly one place.
 */

const REEDITO_CARDS_PATH = resolve(__dirname, '../../reedito/core/core/frontend/src/cards');

// luxon's exports map hides its subpaths, so the file is located via its manifest.
const LUXON_ES_BUILD = resolve(
  dirname(require.resolve('luxon/package.json')),
  'build/es6/luxon.mjs',
);

export const sharedDefine = {
  'process.env.DEBUG': false, // Shim env var utilized by the @tryghost/nql package
  'import.meta.env.REEDITO_GITHUB_REPOSITORY': JSON.stringify(
    process.env.REEDITO_GITHUB_REPOSITORY || process.env.GITHUB_REPOSITORY || '',
  ),
  'import.meta.env.REEDITO_CHANGELOG_URL': JSON.stringify(process.env.REEDITO_CHANGELOG_URL || ''),
};

export const testDefine = {
  ...sharedDefine,
  // Keep changelog tests hermetic while production builds make no external
  // request until an operator configures a Reedito feed.
  'import.meta.env.REEDITO_CHANGELOG_URL': JSON.stringify(
    process.env.REEDITO_CHANGELOG_URL || 'https://updates.reedito.test/changelog.json',
  ),
};

export const sharedResolve = {
  tsconfigPaths: true,
  // Resolve internal workspace packages to their TypeScript source.
  conditions: ['source', ...defaultClientConditions],
  alias: {
    '@reedito-cards': REEDITO_CARDS_PATH,
    // TODO: Remove this when @tryghost/nql is updated
    mingo: require.resolve('mingo/dist/mingo.js'),
    // luxon ships one file for `import` and another for `require`. Workspace packages
    // resolve to source and take the first, @tryghost/nql-lang is published CommonJS and
    // takes the second, and without this the bundle carries both. Pin everyone to the ES
    // build, which is the one that tree-shakes.
    luxon: LUXON_ES_BUILD,
  },
};
