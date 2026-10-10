const reeditoBookshelf = require('./base');

const Mention = reeditoBookshelf.Model.extend(
  {
    tableName: 'mentions',
    defaults: {
      deleted: false,
      verified: false,
      revalidation_failure_count: 0,
    },
    defaultFilters() {
      return 'deleted:false';
    },
  },
  {
    permittedOptions(methodName) {
      let options = reeditoBookshelf.Model.permittedOptions.call(this, methodName);
      const validOptions = {
        findPage: ['selectRaw', 'whereRaw'],
      };

      if (validOptions[methodName]) {
        options = options.concat(validOptions[methodName]);
      }

      return options;
    },
  },
);

module.exports = {
  Mention: reeditoBookshelf.model('Mention', Mention),
};
