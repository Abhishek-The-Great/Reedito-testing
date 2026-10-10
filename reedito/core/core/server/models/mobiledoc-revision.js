const reeditoBookshelf = require('./base');

const MobiledocRevision = reeditoBookshelf.Model.extend(
  {
    tableName: 'mobiledoc_revisions',
  },
  {
    permittedOptions(methodName) {
      let options = reeditoBookshelf.Model.permittedOptions.call(this, methodName);
      const validOptions = {
        findAll: ['filter', 'columns'],
      };

      if (validOptions[methodName]) {
        options = options.concat(validOptions[methodName]);
      }

      return options;
    },

    orderDefaultRaw() {
      return 'created_at_ts DESC';
    },

    toJSON(unfilteredOptions) {
      const attrs = reeditoBookshelf.Model.prototype.toJSON.call(this, unfilteredOptions);

      // CASE: only for internal accuracy
      delete attrs.created_at_ts;
      return attrs;
    },
  },
);

module.exports = {
  MobiledocRevision: reeditoBookshelf.model('MobiledocRevision', MobiledocRevision),
};
