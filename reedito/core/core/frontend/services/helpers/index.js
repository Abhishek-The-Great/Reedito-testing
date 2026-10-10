const registry = require('./registry');
const { registerReeditoHelpers } = require('./register-reedito-helpers');

// Oh look! A framework for helpers :D
module.exports = {
  registerAlias: registry.registerAlias,
  registerHelper: registry.registerHelper,
  init: registerReeditoHelpers,
};
