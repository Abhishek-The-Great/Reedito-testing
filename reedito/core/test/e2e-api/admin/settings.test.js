const assert = require('node:assert/strict');
const sinon = require('sinon');
const logging = require('@tryghost/logging');
const SingleUseTokenProvider = require('../../../core/server/services/members/single-use-token-provider');
const settingsCache = require('../../../core/shared/settings-cache');
const config = require('../../../core/shared/config');
const {
  agentProvider,
  fixtureManager,
  mockManager,
  matchers,
  configUtils,
} = require('../../utils/e2e-framework');
const { stringMatching, anyEtag, anyUuid, anyContentLength, anyContentVersion } = matchers;
const models = require('../../../core/server/models');
const limits = require('../../../core/server/services/limits');
const { anyErrorId } = matchers;

// Updated to reflect current total based on test output
const CURRENT_SETTINGS_COUNT = 113;

const settingsMatcher = {};

const publicHashSettingMatcher = {
  key: 'public_hash',
  value: stringMatching(/[a-z0-9]{30}/),
};

const labsSettingMatcher = {
  key: 'labs',
  value: stringMatching(/\{[^\s]+\}/),
};

const matchSettingsArray = (length) => {
  const settingsArray = new Array(length).fill(settingsMatcher);

  if (length > 38) {
    // Added a setting that is alphabetically before 'public_hash'? then you need to increment this counter.
    // Item at index x is the public hash, which is always different
    settingsArray[38] = publicHashSettingMatcher;
  }

  if (length > 74) {
    // Added a setting that is alphabetically before 'labs'? then you need to increment this counter.
    // Item at index x is the lab settings, which changes as we add and remove features
    settingsArray[74] = labsSettingMatcher;
  }

  return settingsArray;
};

describe('Settings API', function () {
  let agent;
  let emailMockReceiver;
  beforeAll(async function () {
    agent = await agentProvider.getAdminAPIAgent();
    await fixtureManager.init();
    await agent.loginAsOwner();
  });

  beforeEach(function () {
    emailMockReceiver = mockManager.mockMail();
  });

  afterEach(function () {
    mockManager.restore();
    sinon.restore();
  });

  describe('Browse', function () {
    it('Can request all settings', async function () {
      await agent
        .get('settings/')
        .expectStatus(200)
        .matchBodySnapshot({
          settings: matchSettingsArray(CURRENT_SETTINGS_COUNT),
        })
        .matchHeaderSnapshot({
          etag: anyEtag,
          // Special rule for this test, as the labs setting changes a lot
          'content-length': anyContentLength,
          'content-version': anyContentVersion,
        });
    });

    it('Can request settings by group', async function () {
      await agent
        .get('settings/?group=theme')
        .expectStatus(200)
        .matchBodySnapshot({
          settings: matchSettingsArray(1),
        })
        .matchHeaderSnapshot({
          'content-version': anyContentVersion,
          etag: anyEtag,
        });
    });

    it('Requesting core settings by group ignores the parameter and returns no settings', async function () {
      await agent
        .get('settings/?group=core')
        .expectStatus(200)
        .matchBodySnapshot()
        .matchHeaderSnapshot({
          'content-version': anyContentVersion,
          etag: anyEtag,
        });
    });
  });

  describe('Edit', function () {
    it('Can edit a setting', async function () {
      const settingsToChange = [
        {
          key: 'title',
          value: '',
        },
        {
          key: 'codeinjection_head',
          value: null,
        },
        {
          key: 'announcement_content',
          value: '<p>Great news coming soon!</p>',
        },
        {
          key: 'announcement_visibility',
          value: JSON.stringify(['visitors', 'free_members']),
        },
        {
          key: 'navigation',
          value: JSON.stringify([
            {
              label: 'label1',
              url: '/',
            },
          ]),
        },
        {
          key: 'slack_username',
          value: 'New Slack Username',
        },
        {
          key: 'is_private',
          value: false,
        },
        {
          key: 'meta_title',
          value: 'SEO title',
        },
        {
          key: 'meta_description',
          value: 'SEO description',
        },
        {
          key: 'og_image',
          value: '/content/images/2019/07/facebook.png',
        },
        {
          key: 'og_title',
          value: 'facebook title',
        },
        {
          key: 'og_description',
          value: 'facebook description',
        },
        {
          key: 'twitter_image',
          value: '/content/images/2019/07/twitter.png',
        },
        {
          key: 'twitter_title',
          value: 'twitter title',
        },
        {
          key: 'twitter_description',
          value: 'twitter description',
        },
        {
          key: 'locale',
          value: 'ua',
        },
        {
          key: 'labs',
          value: JSON.stringify({}),
        },
        {
          key: 'timezone',
          value: 'Pacific/Auckland',
        },
        {
          key: 'unsplash',
          value: false,
        },
      ];

      await agent
        .put('settings/')
        .body({
          settings: settingsToChange,
        })
        .expectStatus(200)
        .matchBodySnapshot({
          settings: matchSettingsArray(CURRENT_SETTINGS_COUNT),
        })
        .matchHeaderSnapshot({
          'content-length': anyContentLength,
          'content-version': anyContentVersion,
          etag: anyEtag,
        });

      emailMockReceiver.assertSentEmailCount(0);
    });

    it('removes image size prefixes when setting the icon', async function () {
      const settingsToChange = [
        {
          key: 'icon',
          value: '/content/images/size/w256h256/2019/07/icon.png',
        },
      ];

      const { body } = await agent
        .put('settings/')
        .body({
          settings: settingsToChange,
        })
        .expectStatus(200)
        .matchBodySnapshot({
          settings: matchSettingsArray(CURRENT_SETTINGS_COUNT),
        })
        .matchHeaderSnapshot({
          etag: anyEtag,
          // Special rule for this test, as the labs setting changes a lot
          'content-length': anyContentLength,
          'content-version': anyContentVersion,
        });

      // Check returned WITH prefix
      const val = body.settings.find((setting) => setting.key === 'icon');
      assert.ok(val);
      assert.equal(val.value, `${config.get('url')}/content/images/size/w256h256/2019/07/icon.png`);

      // Check if not changed (also check internal ones)
      const afterValue = settingsCache.get('icon');
      assert.equal(afterValue, `${config.get('url')}/content/images/2019/07/icon.png`);

      emailMockReceiver.assertSentEmailCount(0);
    });

    it('cannot edit uneditable settings', async function () {
      await agent
        .put('settings/')
        .body({
          settings: [{ key: 'email_verification_required', value: true }],
        })
        .expectStatus(200)
        .matchBodySnapshot({
          settings: matchSettingsArray(CURRENT_SETTINGS_COUNT),
        })
        .matchHeaderSnapshot({
          etag: anyEtag,
          // Special rule for this test, as the labs setting changes a lot
          'content-length': anyContentLength,
          'content-version': anyContentVersion,
        })
        .expect(({ body }) => {
          const emailVerificationRequired = body.settings.find(
            (setting) => setting.key === 'email_verification_required',
          );
          assert.equal(emailVerificationRequired.value, false);
        });
      emailMockReceiver.assertSentEmailCount(0);
    });

    it('can disable Portal gift promotion settings', async function () {
      try {
        await agent
          .put('settings/')
          .body({
            settings: [
              { key: 'portal_signup_gift_promotion', value: false },
              { key: 'portal_account_gift_promotion', value: false },
            ],
          })
          .expectStatus(200)
          .expect(({ body }) => {
            const signupPromotion = body.settings.find(
              (setting) => setting.key === 'portal_signup_gift_promotion',
            );
            const accountPromotion = body.settings.find(
              (setting) => setting.key === 'portal_account_gift_promotion',
            );
            assert.equal(signupPromotion.value, false);
            assert.equal(accountPromotion.value, false);
          });

        assert.equal(settingsCache.get('portal_signup_gift_promotion'), false);
        assert.equal(settingsCache.get('portal_account_gift_promotion'), false);
        emailMockReceiver.assertSentEmailCount(0);
      } finally {
        await models.Settings.edit({ key: 'portal_signup_gift_promotion', value: true });
        await models.Settings.edit({ key: 'portal_account_gift_promotion', value: true });
      }
    });

    it('can disable llms_enabled', async function () {
      try {
        await agent
          .put('settings/')
          .body({
            settings: [{ key: 'llms_enabled', value: false }],
          })
          .expectStatus(200)
          .matchBodySnapshot({
            settings: matchSettingsArray(CURRENT_SETTINGS_COUNT),
          })
          .matchHeaderSnapshot({
            etag: anyEtag,
            // Special rule for this test, as the labs setting changes a lot
            'content-length': anyContentLength,
            'content-version': anyContentVersion,
          })
          .expect(({ body }) => {
            const llmsEnabled = body.settings.find((setting) => setting.key === 'llms_enabled');
            assert.equal(llmsEnabled.value, false);
          });

        assert.equal(settingsCache.get('llms_enabled'), false);
        emailMockReceiver.assertSentEmailCount(0);
      } finally {
        // Restore so later tests see the default value
        await models.Settings.edit({ key: 'llms_enabled', value: true });
      }
    });

    it('does not trigger email verification flow if members_support_address remains the same', async function () {
      await models.Settings.edit({
        key: 'members_support_address',
        value: 'support@example.com',
      });

      await agent
        .put('settings/')
        .body({
          settings: [{ key: 'members_support_address', value: 'support@example.com' }],
        })
        .expectStatus(200)
        .matchBodySnapshot({
          settings: matchSettingsArray(CURRENT_SETTINGS_COUNT),
        })
        .matchHeaderSnapshot({
          etag: anyEtag,
          // Special rule for this test, as the labs setting changes a lot
          'content-length': anyContentLength,
          'content-version': anyContentVersion,
        })
        .expect(({ body }) => {
          const membersSupportAddress = body.settings.find(
            (setting) => setting.key === 'members_support_address',
          );
          assert.equal(membersSupportAddress.value, 'support@example.com');

          assert.deepEqual(body.meta, {});
        });

      emailMockReceiver.assertSentEmailCount(0);
    });

    it('fails to edit setting with unsupported announcement_visibility value', async function () {
      const loggingStub = sinon.stub(logging, 'warn');
      const settingsToChange = [
        {
          key: 'announcement_visibility',
          value: JSON.stringify(['invalid value']),
        },
      ];

      await agent
        .put('settings/')
        .body({
          settings: settingsToChange,
        })
        .expectStatus(422)
        .matchBodySnapshot({
          errors: [
            {
              id: anyErrorId,
            },
          ],
        })
        .matchHeaderSnapshot({
          'content-version': anyContentVersion,
          etag: anyEtag,
        });

      sinon.assert.calledOnce(loggingStub);
    });

    it('fails to edit setting with unsupported announcement_background value', async function () {
      const loggingStub = sinon.stub(logging, 'warn');
      const settingsToChange = [
        {
          key: 'announcement_background',
          value: 'not a background value',
        },
      ];

      await agent
        .put('settings/')
        .body({
          settings: settingsToChange,
        })
        .expectStatus(422)
        .matchBodySnapshot({
          errors: [
            {
              id: anyErrorId,
            },
          ],
        })
        .matchHeaderSnapshot({
          'content-version': anyContentVersion,
          etag: anyEtag,
        });

      sinon.assert.calledOnce(loggingStub);
    });

    it('ignores payment settings in the payment-free build', async function () {
      const keys = [
        'stripe_secret_key',
        'stripe_publishable_key',
        'stripe_connect_secret_key',
        'stripe_connect_publishable_key',
        'stripe_connect_account_id',
        'machine_payments_secret',
        'machine_payments_deposit_address',
        'machine_payments_enabled',
        'machine_payments_amount',
        'machine_payments_currency',
      ];
      const readPaymentSettings = async () => {
        const { body } = await agent.get('settings/').expectStatus(200);
        return body.settings
          .filter((setting) => keys.includes(setting.key))
          .map(({ key, value }) => ({ key, value }));
      };
      const before = await readPaymentSettings();

      await agent
        .put('settings/')
        .body({
          settings: [
            { key: 'stripe_secret_key', value: 'sk_live_ignored' },
            { key: 'stripe_publishable_key', value: 'pk_live_ignored' },
            { key: 'stripe_connect_secret_key', value: 'sk_live_connect_ignored' },
            { key: 'stripe_connect_publishable_key', value: 'pk_live_connect_ignored' },
            { key: 'stripe_connect_account_id', value: 'acct_ignored' },
            { key: 'machine_payments_secret', value: 'secret_ignored' },
            { key: 'machine_payments_deposit_address', value: '0xignored' },
            { key: 'machine_payments_enabled', value: true },
            { key: 'machine_payments_amount', value: 25 },
            { key: 'machine_payments_currency', value: 'USD' },
          ],
        })
        .expectStatus(200);

      assert.deepEqual(await readPaymentSettings(), before);
    });

  });

  describe('verify key update', function () {
    it('can update members_support_address via token', async function () {
      const token = await new SingleUseTokenProvider({
        SingleUseTokenModel: models.SingleUseToken,
        validityPeriod: 24 * 60 * 60 * 1000,
        validityPeriodAfterUsage: 10 * 60 * 1000,
        maxUsageCount: 1,
      }).create({ key: 'members_support_address', value: 'support@example.com' });
      await agent
        .put('settings/verifications/')
        .body({
          token,
        })
        .expectStatus(200)
        .matchBodySnapshot({
          settings: matchSettingsArray(CURRENT_SETTINGS_COUNT),
        })
        .matchHeaderSnapshot({
          etag: anyEtag,
          // Special rule for this test, as the labs setting changes a lot
          'content-length': anyContentLength,
          'content-version': anyContentVersion,
        })
        .expect(({ body }) => {
          const membersSupportAddress = body.settings.find(
            (setting) => setting.key === 'members_support_address',
          );
          assert.equal(membersSupportAddress.value, 'support@example.com');
        });

      emailMockReceiver.assertSentEmailCount(0);
    });

    it('cannot update invalid keys via token', async function () {
      const loggingStub = sinon.stub(logging, 'warn');
      const token = await new SingleUseTokenProvider({
        SingleUseTokenModel: models.SingleUseToken,
        validityPeriod: 24 * 60 * 60 * 1000,
        validityPeriodAfterUsage: 10 * 60 * 1000,
        maxUsageCount: 1,
      }).create({ key: 'members_support_address_invalid', value: 'support@example.com' });
      await agent
        .put('settings/verifications/')
        .body({
          token,
        })
        .expectStatus(400)
        .matchBodySnapshot({
          errors: [
            {
              id: anyErrorId,
            },
          ],
        })
        .matchHeaderSnapshot({
          'content-version': anyContentVersion,
          etag: anyEtag,
        });

      sinon.assert.calledOnce(loggingStub);
    });
  });

  describe('Managed email without custom sending domain', function () {
    beforeEach(function () {
      configUtils.set('hostSettings:managedEmail:enabled', true);
      configUtils.set('hostSettings:managedEmail:sendingDomain', null);
      configUtils.set('mail:from', 'default@email.com');
    });

    it('editing members_support_address triggers email verification flow', async function () {
      const currentSetting = settingsCache.get('members_support_address');
      assert(
        currentSetting !== 'othersupport@example.com',
        'This test requires a changed email address',
      );

      await agent
        .put('settings/')
        .body({
          settings: [{ key: 'members_support_address', value: 'othersupport@example.com' }],
        })
        .expectStatus(200)
        .matchBodySnapshot({
          settings: matchSettingsArray(CURRENT_SETTINGS_COUNT),
        })
        .matchHeaderSnapshot({
          etag: anyEtag,
          // Special rule for this test, as the labs setting changes a lot
          'content-length': anyContentLength,
          'content-version': anyContentVersion,
        })
        .expect(({ body }) => {
          const membersSupportAddress = body.settings.find(
            (setting) => setting.key === 'members_support_address',
          );
          assert.equal(membersSupportAddress.value, currentSetting);

          assert.deepEqual(body.meta, {
            sent_email_verification: ['members_support_address'],
          });
        });

      emailMockReceiver.assertSentEmailCount(1);
      mockManager.assert.sentEmail({
        subject: 'Verify email address',
        to: 'othersupport@example.com',
      });
    });

    it('editing members_support_address equaling default does not trigger verification flow', async function () {
      await agent
        .put('settings/')
        .body({
          settings: [{ key: 'members_support_address', value: 'default@email.com' }],
        })
        .expectStatus(200)
        .matchBodySnapshot({
          settings: matchSettingsArray(CURRENT_SETTINGS_COUNT),
        })
        .matchHeaderSnapshot({
          etag: anyEtag,
          // Special rule for this test, as the labs setting changes a lot
          'content-length': anyContentLength,
          'content-version': anyContentVersion,
        });

      emailMockReceiver.assertSentEmailCount(0);
    });
  });

  describe('Managed email with custom sending domain', function () {
    beforeEach(function () {
      configUtils.set('hostSettings:managedEmail:enabled', true);
      configUtils.set('hostSettings:managedEmail:sendingDomain', 'sendingdomain.com');
      configUtils.set('mail:from', 'default@email.com');
    });

    it('editing members_support_address without matching domain triggers email verification flow', async function () {
      const currentSetting = settingsCache.get('members_support_address');
      assert(
        currentSetting !== 'othersupport@example.com',
        'This test requires a changed email address',
      );

      await agent
        .put('settings/')
        .body({
          settings: [{ key: 'members_support_address', value: 'othersupport@example.com' }],
        })
        .expectStatus(200)
        .matchBodySnapshot({
          settings: matchSettingsArray(CURRENT_SETTINGS_COUNT),
        })
        .matchHeaderSnapshot({
          etag: anyEtag,
          // Special rule for this test, as the labs setting changes a lot
          'content-length': anyContentLength,
          'content-version': anyContentVersion,
        })
        .expect(({ body }) => {
          const membersSupportAddress = body.settings.find(
            (setting) => setting.key === 'members_support_address',
          );
          assert.equal(membersSupportAddress.value, currentSetting);

          assert.deepEqual(body.meta, {
            sent_email_verification: ['members_support_address'],
          });
        });

      emailMockReceiver.assertSentEmailCount(1);
      mockManager.assert.sentEmail({
        subject: 'Verify email address',
        to: 'othersupport@example.com',
      });
    });

    it('editing members_support_address with matching domain does not trigger email verification flow', async function () {
      const currentSetting = settingsCache.get('members_support_address');
      assert(
        currentSetting !== 'support@sendingdomain.com',
        'This test requires a changed email address',
      );

      await agent
        .put('settings/')
        .body({
          settings: [{ key: 'members_support_address', value: 'support@sendingdomain.com' }],
        })
        .expectStatus(200)
        .matchBodySnapshot({
          settings: matchSettingsArray(CURRENT_SETTINGS_COUNT),
        })
        .matchHeaderSnapshot({
          etag: anyEtag,
          // Special rule for this test, as the labs setting changes a lot
          'content-length': anyContentLength,
          'content-version': anyContentVersion,
        });

      emailMockReceiver.assertSentEmailCount(0);
    });

    it('editing members_support_address equaling default does not trigger verification flow', async function () {
      await agent
        .put('settings/')
        .body({
          settings: [{ key: 'members_support_address', value: 'default@email.com' }],
        })
        .expectStatus(200)
        .matchBodySnapshot({
          settings: matchSettingsArray(CURRENT_SETTINGS_COUNT),
        })
        .matchHeaderSnapshot({
          etag: anyEtag,
          // Special rule for this test, as the labs setting changes a lot
          'content-length': anyContentLength,
          'content-version': anyContentVersion,
        });

      emailMockReceiver.assertSentEmailCount(0);
    });
  });

  describe('Self hoster without managed email', function () {
    beforeEach(function () {
      configUtils.set('hostSettings:managedEmail:enabled', false);
      configUtils.set('hostSettings:managedEmail:sendingDomain', '');
    });

    it('editing members_support_address does not trigger email verification flow', async function () {
      const currentSetting = settingsCache.get('members_support_address');
      assert(
        currentSetting !== 'support@customdomain.com',
        'This test requires a changed email address',
      );

      await agent
        .put('settings/')
        .body({
          settings: [{ key: 'members_support_address', value: 'support@customdomain.com' }],
        })
        .expectStatus(200)
        .matchBodySnapshot({
          settings: matchSettingsArray(CURRENT_SETTINGS_COUNT),
        })
        .matchHeaderSnapshot({
          etag: anyEtag,
          // Special rule for this test, as the labs setting changes a lot
          'content-length': anyContentLength,
          'content-version': anyContentVersion,
        });

      emailMockReceiver.assertSentEmailCount(0);
    });

    it('editing members_support_address equaling default does not trigger verification flow', async function () {
      await agent
        .put('settings/')
        .body({
          settings: [{ key: 'members_support_address', value: 'default@email.com' }],
        })
        .expectStatus(200)
        .matchBodySnapshot({
          settings: matchSettingsArray(CURRENT_SETTINGS_COUNT),
        })
        .matchHeaderSnapshot({
          etag: anyEtag,
          // Special rule for this test, as the labs setting changes a lot
          'content-length': anyContentLength,
          'content-version': anyContentVersion,
        });

      emailMockReceiver.assertSentEmailCount(0);
    });
  });

  describe('publicSiteAccess limit', function () {
    function stubPublicSiteAccessDisabled(disabled) {
      // Stub the singleton directly rather than driving the limit through configUtils +
      // limits.init(). The hostSettings.limits config is registered once at boot from the
      // `@reedito/limit-service` allowlist; bumps of that package are owned by Renovate
      // so this PR cannot rely on `publicSiteAccess` being a recognised name yet.
      sinon.stub(limits, 'isDisabled').withArgs('publicSiteAccess').returns(disabled);
    }

    it('marks is_private and password as is_read_only when the limit is disabled', async function () {
      stubPublicSiteAccessDisabled(true);

      const response = await agent.get('settings/').expectStatus(200);
      const byKey = Object.fromEntries(response.body.settings.map((s) => [s.key, s]));

      assert.equal(byKey.is_private.is_read_only, true);
      assert.equal(byKey.password.is_read_only, true);
    });

    it('rejects external attempts to set is_private = false', async function () {
      stubPublicSiteAccessDisabled(true);
      sinon.stub(logging, 'error');

      await agent
        .put('settings/')
        .body({
          settings: [{ key: 'is_private', value: false }],
        })
        .expectStatus(403)
        .matchBodySnapshot({
          errors: [
            {
              id: anyErrorId,
            },
          ],
        });
    });

    it('rejects external attempts to change the access code', async function () {
      stubPublicSiteAccessDisabled(true);
      sinon.stub(logging, 'error');

      await agent
        .put('settings/')
        .body({
          settings: [{ key: 'password', value: 'attacker-chosen-code' }],
        })
        .expectStatus(403)
        .matchBodySnapshot({
          errors: [
            {
              id: anyErrorId,
            },
          ],
        });
    });

    it('regenerates the access code server-side when settings edits are locked', async function () {
      stubPublicSiteAccessDisabled(true);
      const passwordSetting = await models.Settings.findOne(
        { key: 'password' },
        { context: { internal: true } },
      );

      try {
        const response = await agent
          .post('settings/access_code/regenerate/')
          .body({ password: 'caller-chosen-code' })
          .expectStatus(200);

        const byKey = Object.fromEntries(response.body.settings.map((s) => [s.key, s]));
        assert.equal(typeof byKey.password.value, 'string');
        assert.match(byKey.password.value, /^[a-z]+\d{3}$/);
        assert.notEqual(byKey.password.value, 'caller-chosen-code');
        assert.equal(byKey.password.is_read_only, true);

        emailMockReceiver.assertSentEmailCount(0);
      } finally {
        const originalPasswordSetting = passwordSetting.toJSON();
        await models.Base.knex('settings')
          .where({ key: 'password' })
          .update({ value: originalPasswordSetting.value });
        settingsCache.set('password', originalPasswordSetting);
      }
    });

    it('does not mark is_private or password as is_read_only when the limit is not disabled', async function () {
      stubPublicSiteAccessDisabled(false);

      const response = await agent.get('settings/').expectStatus(200);
      const byKey = Object.fromEntries(response.body.settings.map((s) => [s.key, s]));

      assert.notEqual(byKey.is_private.is_read_only, true);
      assert.notEqual(byKey.password.is_read_only, true);
    });
  });

  describe('Settings overrides', function () {
    beforeEach(async function () {
      const settingsOverrides = {
        email_track_clicks: false,
      };
      configUtils.set('hostSettings:settingsOverrides', settingsOverrides);
      await fixtureManager.init();
    });

    it('respects settings overrides defined in hostSettings:settingsOverrides', async function () {
      await agent
        .get('settings/')
        .expectStatus(200)
        .matchBodySnapshot({
          settings: matchSettingsArray(CURRENT_SETTINGS_COUNT),
        })
        .matchHeaderSnapshot({
          'content-version': anyContentVersion,
          'content-length': anyContentLength,
          etag: anyEtag,
        });
    });

    it('prevents modification of overridden settings via API', async function () {
      await agent
        .put('settings/')
        .body({
          settings: [
            {
              key: 'email_track_clicks',
              value: true,
            },
          ],
        })
        .expectStatus(200)
        .matchBodySnapshot({
          settings: matchSettingsArray(CURRENT_SETTINGS_COUNT),
        })
        .matchHeaderSnapshot({
          'content-version': anyContentVersion,
          'content-length': anyContentLength,
          etag: anyEtag,
        });
    });
  });
});
