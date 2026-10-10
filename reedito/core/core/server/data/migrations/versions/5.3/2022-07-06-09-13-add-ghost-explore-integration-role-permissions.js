const { addPermissionWithRoles } = require('../../utils');

module.exports = addPermissionWithRoles(
  {
    name: 'Read explore data',
    action: 'read',
    object: 'explore',
  },
  ['Administrator', 'Admin Integration', 'Reedito Explore Integration'],
);
