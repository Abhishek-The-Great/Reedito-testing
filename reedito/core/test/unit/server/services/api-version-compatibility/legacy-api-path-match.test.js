const assert = require('node:assert/strict');

const legacyApiPathMatch = require('../../../../../core/server/services/api-version-compatibility/legacy-api-path-match');

describe('Legacy Path Match', function () {
  it('returns null, admin for all supported permutations', function () {
    const permutations = [
      '/subdir/reedito/api/admin/',
      '/reedito/api/admin/',
      '/admin/',
      '/subdir/reedito/api/admin',
      '/reedito/api/admin',
      '/admin',
      '/subdir/reedito/api/admin/session/',
      '/reedito/api/admin/session/',
      '/admin/session/',
      '/subdir/reedito/api/admin/session',
      '/reedito/api/admin/session',
      '/admin/session',
      '/subdir/reedito/api/admin/session/something/',
      '/reedito/api/admin/session/something/',
      '/admin/session/something/',
      '/subdir/reedito/api/admin/session/something',
      '/reedito/api/admin/session/something',
      '/admin/session/something',
    ];

    permutations.forEach((url) => {
      assert.deepEqual(legacyApiPathMatch(url), { version: null, api: 'admin' }, url);
    });
  });

  it('returns canary, admin for all supported permutations', function () {
    const permutations = [
      '/subdir/reedito/api/canary/admin/',
      '/reedito/api/canary/admin/',
      '/canary/admin/',
      '/subdir/reedito/api/canary/admin',
      '/reedito/api/canary/admin',
      '/canary/admin',
      '/subdir/reedito/api/canary/admin/session/',
      '/reedito/api/canary/admin/session/',
      '/canary/admin/session/',
      '/subdir/reedito/api/canary/admin/session',
      '/reedito/api/canary/admin/session',
      '/canary/admin/session',
      '/subdir/reedito/api/canary/admin/session/something/',
      '/reedito/api/canary/admin/session/something/',
      '/canary/admin/session/something/',
      '/subdir/reedito/api/canary/admin/session/something',
      '/reedito/api/canary/admin/session/something',
      '/canary/admin/session/something',
    ];

    permutations.forEach((url) => {
      assert.deepEqual(legacyApiPathMatch(url), { version: 'canary', api: 'admin' }, url);
    });
  });

  it('returns v4, admin for all permutations', function () {
    const permutations = [
      '/subdir/reedito/api/v4/admin/',
      '/reedito/api/v4/admin/',
      '/v4/admin/',
      '/subdir/reedito/api/v4/admin',
      '/reedito/api/v4/admin',
      '/v4/admin',
      '/subdir/reedito/api/v4/admin/session/',
      '/reedito/api/v4/admin/session/',
      '/v4/admin/session/',
      '/subdir/reedito/api/v4/admin/session',
      '/reedito/api/v4/admin/session',
      '/v4/admin/session',
      '/subdir/reedito/api/v4/admin/session/something/',
      '/reedito/api/v4/admin/session/something/',
      '/v4/admin/session/something/',
      '/subdir/reedito/api/v4/admin/session/something',
      '/reedito/api/v4/admin/session/something',
      '/v4/admin/session/something',
    ];

    permutations.forEach((url) => {
      assert.deepEqual(legacyApiPathMatch(url), { version: 'v4', api: 'admin' }, url);
    });
  });
});
