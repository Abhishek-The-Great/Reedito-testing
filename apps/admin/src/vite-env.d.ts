/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly REEDITO_BUILD_VERSION?: string;
  readonly REEDITO_GITHUB_REPOSITORY?: string;
  readonly REEDITO_CHANGELOG_URL?: string;
}

declare module '@tryghost/nql' {
  export default function nql(query: string): { queryJSON: (data: unknown) => boolean };
}
declare module '@tryghost/string' {
  export function slugify(string: string, options?: { requiredChangesOnly?: boolean }): string;
}
declare module '@reedito/koenig-lexical';
