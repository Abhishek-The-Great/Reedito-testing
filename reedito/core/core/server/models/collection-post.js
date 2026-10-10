const reeditoBookshelf = require('./base');

const CollectionPost = reeditoBookshelf.Model.extend({
  tableName: 'collections_posts',
});

module.exports = {
  CollectionPost: reeditoBookshelf.model('CollectionPost', CollectionPost),
};
