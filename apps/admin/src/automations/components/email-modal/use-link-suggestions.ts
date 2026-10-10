import { getSettingValues, useBrowseSettings } from '@reedito/admin-x-framework/api/settings';
import { useBrowseSite } from '@reedito/admin-x-framework/api/site';
import { useKoenigLinkSuggestions } from '@reedito/admin-x-framework';

// Provides Koenig link autocomplete config for the email editor. Reads settings
// and site directly from framework hooks (no global data provider required) and
// falls back to safe defaults while those requests are still loading.
export const useEmailLinkSuggestions = () => {
  const { data: settingsData } = useBrowseSettings();
  const { data: siteData } = useBrowseSite();
  const settings = settingsData?.settings || [];
  const siteUrl = siteData?.site?.url || '';
  const [
    membersSignupAccess = 'all',
    paidMembersEnabled = false,
    donationsEnabled = false,
    recommendationsEnabled = false,
  ] = getSettingValues(settings, [
    'members_signup_access',
    'paid_members_enabled',
    'donations_enabled',
    'recommendations_enabled',
  ]);

  return useKoenigLinkSuggestions({
    siteUrl,
    membersSignupAccess: typeof membersSignupAccess === 'string' ? membersSignupAccess : 'all',
    paidMembersEnabled: paidMembersEnabled === true,
    donationsEnabled: Boolean(donationsEnabled),
    recommendationsEnabled: Boolean(recommendationsEnabled),
  });
};
