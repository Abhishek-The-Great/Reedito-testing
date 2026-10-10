const reeditoBookshelf = require('./base');
const urlUtils = require('../../shared/url-utils').default;

const PostsMeta = reeditoBookshelf.Model.extend(
  {
    tableName: 'posts_meta',

    defaults: function defaults() {
      return {
        email_only: false,
      };
    },

    formatOnWrite(attrs) {
      ['og_image', 'twitter_image'].forEach((attr) => {
        if (attrs[attr]) {
          attrs[attr] = urlUtils.toTransformReady(attrs[attr]);
        }
      });

      return attrs;
    },

    parse() {
      const attrs = reeditoBookshelf.Model.prototype.parse.apply(this, arguments);

      ['og_image', 'twitter_image'].forEach((attr) => {
        if (attrs[attr]) {
          attrs[attr] = urlUtils.transformReadyToAbsolute(attrs[attr]);
        }
      });

      return attrs;
    },
  },
  {
    post() {
      return this.belongsTo('Post');
    },
  },
);

module.exports = {
  PostsMeta: reeditoBookshelf.model('PostsMeta', PostsMeta),
};
