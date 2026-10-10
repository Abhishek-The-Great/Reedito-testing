const debug = require('@tryghost/debug')('web:backend');
const express = require('../../../shared/express');
const { BASE_API_PATH } = require('../../../shared/url-utils');
const urlUtils = require('../../../shared/url-utils').default;

/**
 *
 * @returns {import('express').Application}
 */
module.exports = () => {
  debug('BackendApp setup start');
  // BACKEND
  // Wrap the admin and API apps into a single express app for use with vhost
  const backendApp = express('backend');

  backendApp.lazyUse(BASE_API_PATH, require('../api'));
  backendApp.lazyUse('/reedito/.well-known', require('../well-known'));

  // Preserve the established Ghost API and ActivityPub endpoints for existing
  // themes and integrations while Reedito uses the new paths by default.
  backendApp.lazyUse('/ghost/api', require('../api'));
  backendApp.lazyUse('/ghost/.well-known', require('../well-known'));

  backendApp.use(
    '/reedito',
    require('../../services/auth/session').createSessionFromToken(),
    require('../admin')(),
  );

  // Old Admin URLs redirect to Reedito. API requests above continue to work
  // at /ghost/api for clients that have not moved to /reedito/api yet.
  backendApp.use('/ghost', (req, res) => {
    const legacyPrefix = `${urlUtils.getSubdir()}/ghost`;
    const reeditoPrefix = `${urlUtils.getSubdir()}/reedito`;
    res.redirect(301, req.originalUrl.replace(legacyPrefix, reeditoPrefix));
  });

  return backendApp;
};
