const publicConfig = require('../../services/public-config');

/** @type {import('@reedito/api-framework').Controller} */
const controller = {
  docName: 'config',

  read: {
    headers: {
      cacheInvalidate: false,
    },
    permissions: false,
    query() {
      return publicConfig.config;
    },
  },
};

module.exports = controller;
