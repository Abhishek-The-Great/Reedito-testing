import { describe, expect, it } from 'vitest';

import { fakeSettingsScreens, renderAdminApp, settingsResponse } from '@test-utils/acceptance';
import { settingsScreen } from '@/settings/settings.screen';

describe('Tips and donations settings', () => {
  it('stays hidden when historical Stripe credentials are present', async () => {
    fakeSettingsScreens();
    await renderAdminApp('/settings', {
      boot: {
        browseSettings: {
          response: settingsResponse({
            settings: {
              donations_enabled: true,
              stripe_connect_publishable_key: 'pk_test_old',
              stripe_connect_secret_key: 'sk_test_old',
              stripe_connect_display_name: 'Historical account',
              stripe_connect_account_id: 'acct_old',
            },
          }),
        },
      },
    });

    await expect(settingsScreen.tipsAndDonations()).toHaveCount(0);
    await expect(settingsScreen.navItem('Tips & donations')).toHaveCount(0);
  });
});
