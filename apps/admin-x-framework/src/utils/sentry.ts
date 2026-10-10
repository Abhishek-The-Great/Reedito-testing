import * as Sentry from '@sentry/react';

/**
 * The React Admin bundle shares the Sentry client initialized by the legacy
 * Admin shell. Its static entrypoint cannot know the DSN when it first loads,
 * so consumers must also check for an active SDK client.
 */
export function isSentryEnabled(configuredDsn?: string | null): boolean {
  return Boolean(configuredDsn || Sentry.getClient());
}
