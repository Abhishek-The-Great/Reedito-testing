import type { ReeditoErrorOptions } from '../../src/types.ts';

/** What the package throws, as the tests need to read it back off a caught value. */
export interface ThrownError extends Error {
  errorType: string;
  help?: string;
  // Required, unlike on the payload the package builds: a test reaching for these has
  // already decided the error it caught is one that carries them.
  errorDetails: { name: string; limit: number; total: number };
}

/**
 * Stand-ins for @tryghost/errors, so the tests can assert on what the package raises
 * without depending on the real error module.
 */
class TestError extends Error {
  errorType?: string;
  errorDetails?: ReeditoErrorOptions['errorDetails'];
  help?: string;

  constructor({
    errorType,
    errorDetails,
    message,
    help,
  }: Partial<ReeditoErrorOptions> & { errorType?: string }) {
    super(message ?? '');
    this.errorType = errorType;
    this.errorDetails = errorDetails;
    this.help = help;
  }
}

class IncorrectUsageError extends TestError {
  constructor(options: Partial<ReeditoErrorOptions>) {
    super(Object.assign({ errorType: 'IncorrectUsageError' }, options));
  }
}

class HostLimitError extends TestError {
  constructor(options: Partial<ReeditoErrorOptions>) {
    super(Object.assign({ errorType: 'HostLimitError' }, options));
  }
}

export default {
  IncorrectUsageError,
  HostLimitError,
};
