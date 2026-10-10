import type * as express from 'express';
// @ts-expect-error This module lacks type definitions.
import reeditoVersion from '@tryghost/version';

/**
 * Expose the standard locals that every request will need to have available
 */
export function reeditoLocals(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  // Make sure we have a locals value.
  res.locals = res.locals || {};
  // The current Reedito version
  res.locals.version = reeditoVersion.full;
  // The current Reedito version, but only major.minor
  res.locals.safeVersion = reeditoVersion.safe;
  // relative path from the URL
  res.locals.relativeUrl = req.path;

  next();
}
