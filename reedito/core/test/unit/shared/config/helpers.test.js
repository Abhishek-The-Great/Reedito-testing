const assert = require('node:assert/strict');
const configUtils = require('../../../utils/config-utils');

describe('vhost utils', function () {
  beforeEach(function () {
    configUtils.set('url', 'http://reedito.com');
  });

  afterEach(async function () {
    await configUtils.restore();
  });

  // url = 'http://reedito.com'
  describe('without separate admin url', function () {
    it('uses the default arg for both backend and frontend', function () {
      assert.deepEqual(configUtils.config.getBackendMountPath(), /.*/);
      assert.deepEqual(configUtils.config.getFrontendMountPath(), /.*/);
    });
  });

  // url       = 'http://reedito.com'
  // admin.url = 'https://admin.reedito.com'
  describe('with separate admin url', function () {
    beforeEach(function () {
      configUtils.set('admin:url', 'https://admin.reedito.com');
    });

    it('should use admin url and inverse as args', function () {
      assert.equal(configUtils.config.getBackendMountPath(), 'admin.reedito.com');
      assert.deepEqual(configUtils.config.getFrontendMountPath(), /^(?!admin\.reedito\.com).*/);
    });

    it('should have regex that excludes admin traffic on front-end', function () {
      const frontendRegex = configUtils.config.getFrontendMountPath();

      assert.equal(frontendRegex.test('localhost'), true);
      assert.equal(frontendRegex.test('reedito.com'), true);
      assert.equal(frontendRegex.test('admin.reedito.com'), false);
    });
  });

  // url       = 'http://reedito.com'
  // admin.url = 'https://reedito.com'
  describe('with separate admin protocol', function () {
    beforeEach(function () {
      configUtils.set('admin:url', 'https://reedito.com');
    });

    it('should mount and assign correct routes', function () {
      assert.deepEqual(configUtils.config.getBackendMountPath(), /.*/);
      assert.deepEqual(configUtils.config.getFrontendMountPath(), /.*/);
    });
  });
});

describe('env helpers', function () {
  afterEach(async function () {
    await configUtils.restore();
  });

  describe('isTestEnv', function () {
    it('returns true for testing and testing-mysql', function () {
      configUtils.set('env', 'testing');
      assert.equal(configUtils.config.isTestEnv(), true);

      configUtils.set('env', 'testing-mysql');
      assert.equal(configUtils.config.isTestEnv(), true);
    });

    it('returns false for development and production', function () {
      configUtils.set('env', 'development');
      assert.equal(configUtils.config.isTestEnv(), false);

      configUtils.set('env', 'production');
      assert.equal(configUtils.config.isTestEnv(), false);
    });
  });

  describe('isProductionOrDevelopment', function () {
    it('returns true for development and production', function () {
      configUtils.set('env', 'development');
      assert.equal(configUtils.config.isProductionOrDevelopment(), true);

      configUtils.set('env', 'production');
      assert.equal(configUtils.config.isProductionOrDevelopment(), true);
    });

    it('returns false for testing and other environments', function () {
      configUtils.set('env', 'testing');
      assert.equal(configUtils.config.isProductionOrDevelopment(), false);

      configUtils.set('env', 'staging');
      assert.equal(configUtils.config.isProductionOrDevelopment(), false);
    });
  });
});
