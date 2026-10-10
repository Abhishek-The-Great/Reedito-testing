const express = require('../../../shared/express');
const config = require('../../../shared/config');
const urlUtils = require('../../../shared/url-utils').default;

// Extract the core redirect logic for easier testing
const handleAdminRedirect = function (req, res) {
  const adminPath = req.path.replace(/^\/reedito/, '') || '/';
  return urlUtils.redirectToAdmin(301, res, adminPath);
};

// redirect to /reedito to the admin
module.exports = function redirectReeditoToAdmin() {
  const router = express.Router('redirect-reedito-to-admin');

  if (config.get('admin:redirects')) {
    router.get(/^\/reedito(\/.*)?\/?$/, handleAdminRedirect);
  }

  return router;
};

// Export the core logic for testing
module.exports.handleAdminRedirect = handleAdminRedirect;
