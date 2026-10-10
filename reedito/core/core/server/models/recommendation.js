const reeditoBookshelf = require('./base');

const Recommendation = reeditoBookshelf.Model.extend(
  {
    tableName: 'recommendations',
    defaults: {},
  },
  {},
);

module.exports = {
  Recommendation: reeditoBookshelf.model('Recommendation', Recommendation),
};
