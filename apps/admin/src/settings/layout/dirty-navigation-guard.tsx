import { DirtyConfirmDialog } from '@reedito/shade/patterns';
import { NavigationType, useBlocker } from '@reedito/admin-x-framework';
import { useConfirmUnload } from '@reedito/admin-x-framework/hooks';
import { useGlobalDirtyState } from '@reedito/shade/utils';
import { isOnRouterHistoryEntry } from '@/hooks/use-router-history-entry';
import { useRef } from 'react';
import { dialogIdentity } from './dirty-navigation-guard-identity';

// Only history (back/forward) navigations are blocked: every in-app way out of a
// dirty settings dialog already runs its own dirty confirmation before navigating.
export const DirtyNavigationGuard: React.FC = () => {
  const { isDirty } = useGlobalDirtyState();
  const leaveConfirmedRef = useRef(false);
  useConfirmUnload(isDirty);

  const blocker = useBlocker(({ currentLocation, nextLocation, historyAction }) => {
    if (!isDirty || historyAction !== NavigationType.Pop) {
      return false;
    }
    if (!isOnRouterHistoryEntry()) {
      return false;
    }
    return dialogIdentity(currentLocation.pathname) !== dialogIdentity(nextLocation.pathname);
  });
  const isBlocked = blocker.state === 'blocked';

  return (
    <DirtyConfirmDialog
      open={isBlocked}
      onConfirm={() => {
        leaveConfirmedRef.current = true;
        blocker.proceed?.();
      }}
      onOpenChange={(open) => {
        if (open) {
          return;
        }
        // Leave closes the dialog while the blocker still reads as blocked;
        // don't reset the navigation the user just confirmed.
        if (leaveConfirmedRef.current) {
          leaveConfirmedRef.current = false;
          return;
        }
        if (isBlocked) {
          blocker.reset?.();
        }
      }}
    />
  );
};
