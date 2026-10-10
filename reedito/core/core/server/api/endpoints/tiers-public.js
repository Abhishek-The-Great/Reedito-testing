const tiersService = require('../../services/tiers');

/** @type {import('@reedito/api-framework').Controller} */
const controller = {
  docName: 'tiers',

  browse: {
    headers: {
      cacheInvalidate: false,
    },
    options: ['limit', 'fields', 'filter', 'order', 'debug', 'page'],
    permissions: true,
    query(frame) {
      return tiersService.api.browse(frame.options);
    },
  },
};

module.exports = controller;
