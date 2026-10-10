import { SidebarContent } from '@reedito/shade/components';

import AppSidebarBanner from './app-sidebar-banner';
import NavMain from './nav-main';
import NavContent from './nav-content';
import NavFeedback from './nav-feedback';
import NavSettings from './nav-settings';
import { useSidebarBannerState } from './hooks/use-sidebar-banner-state';

function AppSidebarContent() {
  const { banner, bannerType } = useSidebarBannerState();
  let bannerContainerClassName = '';

  if (bannerType === 'theme-errors') {
    bannerContainerClassName = 'pb-[110px]';
  } else if (bannerType === 'whats-new') {
    bannerContainerClassName = 'pb-[180px]';
  }

  return (
    <SidebarContent className="justify-between px-3 pt-4 pb-1">
      <div className="flex flex-col gap-2 sidebar:gap-4">
        <NavMain />
        <NavContent />
        <NavFeedback />
      </div>
      <div className={`flex flex-col gap-2 sidebar:gap-4 ${bannerContainerClassName}`}>
        <AppSidebarBanner banner={banner} />
        <NavSettings className="pb-0" />
      </div>
    </SidebarContent>
  );
}

export default AppSidebarContent;
