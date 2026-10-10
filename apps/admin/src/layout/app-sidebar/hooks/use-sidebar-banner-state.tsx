import type { ReactNode } from 'react';

import ThemeErrorsBanner from '@/layout/app-sidebar/theme-errors-banner';
import { useAdminSidebarVisibility } from '@/layout/sidebar-visibility';
import { WhatsNewBanner } from '@/whats-new/api';

import { useWhatsNewStatus } from './use-whats-new-status';
import { useActiveThemeErrors } from './use-theme-errors';

export interface SidebarBannerState {
  bannerType: 'theme-errors' | 'whats-new' | null;
  banner: ReactNode;
  hasBanner: boolean;
}

export function useSidebarBannerState(): SidebarBannerState {
  const { hasErrors } = useActiveThemeErrors();
  const { showWhatsNewBanner } = useWhatsNewStatus();
  const sidebarVisible = useAdminSidebarVisibility();

  if (!sidebarVisible) {
    return {
      bannerType: null,
      banner: null,
      hasBanner: false,
    };
  }

  if (hasErrors) {
    return {
      bannerType: 'theme-errors',
      banner: <ThemeErrorsBanner />,
      hasBanner: true,
    };
  }

  if (showWhatsNewBanner) {
    return {
      bannerType: 'whats-new',
      banner: <WhatsNewBanner />,
      hasBanner: true,
    };
  }

  return {
    bannerType: null,
    banner: null,
    hasBanner: false,
  };
}
