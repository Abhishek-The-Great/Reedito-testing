const reeditoBookshelf = require('./base');

const Job = reeditoBookshelf.Model.extend({
  tableName: 'jobs',
});

module.exports = {
  Job: reeditoBookshelf.model('Job', Job),
};
