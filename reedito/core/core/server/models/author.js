const reeditoBookshelf = require('./base');
const user = require('./user');

const Author = user.User.extend({
  shouldHavePosts: {
    joinTo: 'author_id',
    joinTable: 'posts_authors',
  },
});

const Authors = reeditoBookshelf.Collection.extend({
  model: Author,
});

module.exports = {
  Author: reeditoBookshelf.model('Author', Author),
  Authors: reeditoBookshelf.collection('Authors', Authors),
};
