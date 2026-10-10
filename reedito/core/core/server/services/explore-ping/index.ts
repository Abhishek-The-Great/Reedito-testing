import { ExplorePingService } from './explore-ping-service';

const config = require('../../../shared/config');
const logging = require('@tryghost/logging');
const reeditoVersion = require('@tryghost/version');
const request = require('@tryghost/request');
const settingsCache = require('../../../shared/settings-cache');
const posts = require('../posts/posts-service-instance');
const members = require('../members');

// Export the creation function for testing
export function createService(): ExplorePingService {
  return new ExplorePingService({
    settingsCache,
    config,
    logging,
    reeditoVersion,
    request,
    posts: posts(),
    members,
  });
}

export async function init(): Promise<void> {
  // The explore ping is a background "phone home" request. It should not run
  // in the test environment (cf. the update-check service, which gates on the
  // same environments), where there is no explore URL configured.
  if (!config.isProductionOrDevelopment()) {
    return;
  }

  const explorePingService = createService();

  // The final intention is to have this run on a schedule
  // For the initial version, we'll just ping when the server starts
  // Without waiting for the response
  explorePingService.ping();
}
