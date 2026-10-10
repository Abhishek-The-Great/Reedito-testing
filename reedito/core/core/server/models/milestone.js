const reeditoBookshelf = require('./base');

const Milestone = reeditoBookshelf.Model.extend({
  tableName: 'milestones',
});

module.exports = {
  Milestone: reeditoBookshelf.model('Milestone', Milestone),
};
