import React from 'react';
import { SidebarGroup, SidebarGroupContent, SidebarMenu } from '@reedito/shade/components';
import { LucideIcon } from '@reedito/shade/utils';
import { useCurrentUser } from '@reedito/admin-x-framework/api/current-user';
import { isContributorUser } from '@reedito/admin-x-framework/api/users';
import { useFeaturebase } from '@reedito/admin-x-framework';
import { NavMenuItem } from './nav-menu-item';

function NavFeedback({ ...props }: React.ComponentProps<typeof SidebarGroup>) {
  const { data: currentUser } = useCurrentUser();
  const {
    isAvailable: featurebaseAvailable,
    openFeedbackWidget,
    preloadFeedbackWidget,
  } = useFeaturebase();

  if (!currentUser) {
    return null;
  }

  const showFeedback = featurebaseAvailable && !isContributorUser(currentUser);

  if (!showFeedback) {
    return null;
  }

  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {showFeedback && (
            <NavMenuItem>
              <NavMenuItem.Button
                onClick={openFeedbackWidget}
                onFocus={preloadFeedbackWidget}
                onMouseEnter={preloadFeedbackWidget}
              >
                <LucideIcon.MessageCircle />
                <NavMenuItem.Label>Feedback</NavMenuItem.Label>
              </NavMenuItem.Button>
            </NavMenuItem>
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export default NavFeedback;
