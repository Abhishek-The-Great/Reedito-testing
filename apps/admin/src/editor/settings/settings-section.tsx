import type { ReactNode } from 'react';
import { Separator } from '@reedito/shade/components';
import { Stack } from '@reedito/shade/primitives';

/** One block of the settings panel, with the rule that closes it. */
export function SettingsSection({ children }: { children: ReactNode }) {
  return (
    <>
      <Stack className="px-5 py-4" gap="sm">
        {children}
      </Stack>
      <Separator />
    </>
  );
}
