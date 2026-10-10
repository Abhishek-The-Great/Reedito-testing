import React from 'react';
import { Button } from '@reedito/shade/components';
import { DirtyConfirmDialog, useDirtyConfirmation } from '@reedito/shade/patterns';
import { LucideIcon, useGlobalDirtyState } from '@reedito/shade/utils';
import { useNavigate } from '@reedito/admin-x-framework';

const ExitSettingsButton: React.FC = () => {
  const { isDirty } = useGlobalDirtyState();
  const { confirm, dialogProps } = useDirtyConfirmation();
  const navigate = useNavigate();

  const navigateAway = () => {
    navigate('/');
  };

  return (
    <>
      <Button
        aria-label="Close settings"
        className="text-muted-foreground hover:text-foreground"
        data-testid="exit-settings"
        id="done-button"
        size="icon"
        title="Close (ESC)"
        type="button"
        variant="ghost"
        onClick={() => confirm(isDirty, navigateAway)}
      >
        <LucideIcon.X className="size-6!" />
      </Button>
      <DirtyConfirmDialog {...dialogProps} />
    </>
  );
};

export default ExitSettingsButton;
