import { escapeNqlString } from '@reedito/nql-string';

export function buildResourceFilter(baseFilter: string, search: string): string {
  if (!search) {
    return baseFilter;
  }

  return `${baseFilter}+title:~${escapeNqlString(search)}`;
}
