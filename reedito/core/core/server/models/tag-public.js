const reeditoBookshelf = require('./base');
const tag = require('./tag');

const TagPublic = tag.Tag.extend({
  shouldHavePosts: {
    joinTo: 'tag_id',
    joinTable: 'posts_tags',
  },
});

const TagsPublic = reeditoBookshelf.Collection.extend({
  model: TagPublic,
});

module.exports = {
  TagPublic: reeditoBookshelf.model('TagPublic', TagPublic),
  TagsPublic: reeditoBookshelf.collection('TagsPublic', TagsPublic),
};
