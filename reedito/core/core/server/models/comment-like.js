const _ = require('lodash');
const reeditoBookshelf = require('./base');

const CommentLike = reeditoBookshelf.Model.extend(
  {
    tableName: 'comment_likes',

    defaults: function defaults() {
      return {
        score: 1,
      };
    },

    comment() {
      return this.belongsTo('Comment', 'comment_id');
    },

    member() {
      return this.belongsTo('Member', 'member_id');
    },

    serialize(options) {
      return _.omit(reeditoBookshelf.Model.prototype.serialize.call(this, options), 'score');
    },

    emitChange: function emitChange(event, options) {
      const eventToTrigger = 'comment_like' + '.' + event;
      reeditoBookshelf.Model.prototype.emitChange.bind(this)(this, eventToTrigger, options);
    },

    onCreated: function onCreated(model, options) {
      const result = reeditoBookshelf.Model.prototype.onCreated.apply(this, arguments);

      model.emitChange('added', options);

      return result;
    },
  },
  {},
);

module.exports = {
  CommentLike: reeditoBookshelf.model('CommentLike', CommentLike),
};
