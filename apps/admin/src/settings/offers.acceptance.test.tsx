import { describe, expect, it } from 'vitest';

import {
  fakeAdminEndpoint,
  fakeSettingsScreens,
  renderAdminApp,
  settingsResponse,
} from '@test-utils/acceptance';
import { offersScreen } from './offers.screen';

describe('Offers', () => {
  it('blocks direct offer routes when only historical Stripe credentials exist', async () => {
    fakeSettingsScreens();
    const offersApi = fakeAdminEndpoint('GET', '/offers/', { offers: [] });
    await renderAdminApp('/settings/offers/new', {
      boot: {
        browseSettings: {
          response: settingsResponse({
            settings: {
              stripe_connect_publishable_key: 'pk_test_old',
              stripe_connect_secret_key: 'sk_test_old',
              stripe_connect_display_name: 'Historical account',
              stripe_connect_account_id: 'acct_old',
            },
          }),
        },
      },
    });

    await expect(offersScreen.addModal()).toHaveCount(0);
    await expect(offersScreen.listModal()).toHaveCount(0);
    expect(offersApi.requests).toHaveLength(0);
  });
});
