const reeditoBookshelf = require('./base');

const Suppression = reeditoBookshelf.Model.extend({
  tableName: 'suppressions',
});

module.exports = {
  Suppression: reeditoBookshelf.model('Suppression', Suppression),
};
