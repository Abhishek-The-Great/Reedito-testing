const reeditoBookshelf = require('./base');

const CommentReport = reeditoBookshelf.Model.extend(
  {
    tableName: 'comment_reports',

    defaults: function defaults() {
      return {};
    },

    comment() {
      return this.belongsTo('Comment', 'comment_id');
    },

    member() {
      return this.belongsTo('Member', 'member_id');
    },

    emitChange: function emitChange(event, options) {
      const eventToTrigger = 'comment_report' + '.' + event;
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
  CommentReport: reeditoBookshelf.model('CommentReport', CommentReport),
};
