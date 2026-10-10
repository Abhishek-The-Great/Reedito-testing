const reeditoBookshelf = require('./base');

const MemberNewsletter = reeditoBookshelf.Model.extend({
  tableName: 'members_newsletters',
});

module.exports = {
  MemberNewsletter: reeditoBookshelf.model('MemberNewsletter', MemberNewsletter),
};
