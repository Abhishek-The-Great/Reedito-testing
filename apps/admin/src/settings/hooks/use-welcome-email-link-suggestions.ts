import { getSettingValues } from '@reedito/admin-x-framework/api/settings';
import { useGlobalData } from '@/settings/providers/global-data-context';
import { useKoenigLinkSuggestions } from '@reedito/admin-x-framework';

export const useWelcomeEmailLinkSuggestions = () => {
  const { settings, siteData } = useGlobalData();
  const [
    membersSignupAccess,
    paidMembersEnabled = false,
    donationsEnabled = false,
    recommendationsEnabled = false,
  ] = getSettingValues(settings, [
    'members_signup_access',
    'paid_members_enabled',
    'donations_enabled',
    'recommendations_enabled',
  ]);

  if (typeof membersSignupAccess !== 'string') {
    throw new TypeError('members_signup_access should be a string');
  }
  if (typeof donationsEnabled !== 'boolean') {
    throw new TypeError('donations_enabled should be a boolean');
  }
  if (typeof paidMembersEnabled !== 'boolean') {
    throw new TypeError('paid_members_enabled should be a boolean');
  }
  if (typeof recommendationsEnabled !== 'boolean') {
    throw new TypeError('recommendations_enabled should be a boolean');
  }

  return useKoenigLinkSuggestions({
    siteUrl: siteData.url,
    membersSignupAccess,
    paidMembersEnabled,
    donationsEnabled,
    recommendationsEnabled,
  });
};
