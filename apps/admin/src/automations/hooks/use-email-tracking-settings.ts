import { useEmailTrackClicks, useEmailTrackOpens } from '@reedito/admin-x-framework/api/settings';

export const useEmailTrackingSettings = () => {
  const emailTrackOpens = useEmailTrackOpens() ?? false;
  const emailTrackClicks = useEmailTrackClicks() ?? false;

  return { emailTrackOpens, emailTrackClicks };
};
