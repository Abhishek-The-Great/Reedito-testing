import { upgradeRoute } from '@reedito/admin-x-framework/api/config';
import { useGlobalData } from '@/settings/providers/global-data-context';

export function useUpgradeRoute() {
  const { config } = useGlobalData();

  return upgradeRoute(config);
}
