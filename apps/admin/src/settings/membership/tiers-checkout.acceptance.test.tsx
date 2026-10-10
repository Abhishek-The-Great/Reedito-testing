import { describe, expect, it } from 'vitest';

import {
  fakeAdminEndpoint,
  fakeSettingsScreens,
  fakeTiers,
  renderAdminApp,
  settingsResponse,
  tier,
} from '@test-utils/acceptance';
import { settingsScreen } from '@/settings/settings.screen';

const freeTier = tier({ id: 'free-tier', name: 'Free', slug: 'free', type: 'free' });
const paidTier = tier({ id: 'paid-tier', name: 'Supporter', slug: 'supporter', type: 'paid' });

describe('Tier checkout collection in a payment-free build', () => {
  it('does not load checkout configuration when old Stripe credentials and labs flags exist', async () => {
    fakeSettingsScreens();
    fakeTiers([freeTier, paidTier]);
    const checkoutConfigApi = fakeAdminEndpoint('GET', '/tiers/checkout_config/', {
      tiers_checkout_config: [],
    });
    await renderAdminApp('/settings', {
      labs: { stripeCheckoutCollection: true, membersCustomFields: true },
      boot: {
        browseSettings: {
          response: settingsResponse({
            settings: {
              stripe_connect_publishable_key: 'pk_test_old',
              stripe_connect_secret_key: 'sk_test_old',
              stripe_connect_account_id: 'acct_old',
            },
          }),
        },
      },
    });

    const tiers = settingsScreen.tiers();
    await expect.element(tiers.getByText('Free', { exact: true })).toBeVisible();
    await expect(tiers.getByText('Supporter', { exact: true })).toHaveCount(0);
    expect(checkoutConfigApi.requests).toHaveLength(0);
  });
});
