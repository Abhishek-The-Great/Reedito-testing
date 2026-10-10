import { describe, expect, it } from 'vitest';

import {
  fakeSettingsScreens,
  fakeTiers,
  renderAdminApp,
  settingsResponse,
  tier,
} from '@test-utils/acceptance';
import { settingsScreen } from '@/settings/settings.screen';

const freeTier = tier({ id: 'free-tier', name: 'Free', slug: 'free', type: 'free' });
const paidTier = tier({ id: 'paid-tier', name: 'Supporter', slug: 'supporter', type: 'paid' });

describe('Tier settings without a payment processor', () => {
  it('shows free member settings and hides payment controls even with historical credentials', async () => {
    fakeSettingsScreens();
    fakeTiers([freeTier, paidTier]);

    const settings = settingsResponse({
      settings: {
        paid_members_enabled: false,
        stripe_connect_publishable_key: 'pk_test_old',
        stripe_connect_secret_key: 'sk_test_old',
        machine_payments_enabled: true,
      },
      labs: { machinePayments: true },
    });

    await renderAdminApp('/settings', { boot: { browseSettings: { response: settings } } });

    await expect.element(settingsScreen.tiers().getByText('Free', { exact: true })).toBeVisible();
    await expect(settingsScreen.tiers().getByText('Supporter', { exact: true })).toHaveCount(0);
    await expect(settingsScreen.tiers().getByText('Connect with Stripe')).toHaveCount(0);
    await expect(settingsScreen.tiers().getByText('Accept payments from AI agents')).toHaveCount(0);
  });
});
