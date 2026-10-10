import { useMatch } from '@reedito/admin-x-framework';

interface UseIsActiveLinkOptions {
  path?: string;
  activeOnSubpath?: boolean;
}

export function useIsActiveLink({
  path,
  activeOnSubpath = false,
}: UseIsActiveLinkOptions): boolean {
  const pattern = activeOnSubpath && path ? `${path}/*` : path;
  const match = useMatch(pattern || '');

  return match !== null;
}
