const reeditoBookshelf = require('./base');
const urlUtils = require('../../shared/url-utils').default;
const mobiledocLib = require('../lib/mobiledoc');
const lexicalLib = require('../lib/lexical');
const _ = require('lodash');

const Snippet = reeditoBookshelf.Model.extend(
  {
    tableName: 'snippets',

    actionsCollectCRUD: true,
    actionsResourceType: 'snippet',

    formatOnWrite(attrs) {
      if (attrs.mobiledoc) {
        attrs.mobiledoc = urlUtils.mobiledocToTransformReady(attrs.mobiledoc, {
          cardTransformers: mobiledocLib.cards,
        });
      }

      if (attrs.lexical) {
        attrs.lexical = urlUtils.lexicalToTransformReady(attrs.lexical, {
          nodes: lexicalLib.nodes,
          transformMap: lexicalLib.urlTransformMap,
        });
      }

      return attrs;
    },

    parse() {
      const attrs = reeditoBookshelf.Model.prototype.parse.apply(this, arguments);

      if (attrs.mobiledoc) {
        attrs.mobiledoc = urlUtils.transformReadyToAbsolute(attrs.mobiledoc);
      }

      if (attrs.lexical) {
        attrs.lexical = urlUtils.transformReadyToAbsolute(attrs.lexical);
      }

      return attrs;
    },

    formatsToJSON: function formatsToJSON(attrs, options) {
      const defaultFormats = ['mobiledoc'];
      const formatsToKeep = options.formats || defaultFormats;

      // Iterate over all known formats, and if they are not in the keep list, remove them
      _.each(Snippet.allowedFormats, function (format) {
        if (formatsToKeep.indexOf(format) === -1) {
          delete attrs[format];
        }
      });

      return attrs;
    },
    toJSON: function toJSON(options) {
      let attrs = reeditoBookshelf.Model.prototype.toJSON.call(this, options);

      attrs = this.formatsToJSON(attrs, options);

      return attrs;
    },
  },
  {
    allowedFormats: ['mobiledoc', 'lexical'],
  },
);

const Snippets = reeditoBookshelf.Collection.extend({
  model: Snippet,
});

module.exports = {
  Snippet: reeditoBookshelf.model('Snippet', Snippet),
  Snippets: reeditoBookshelf.collection('Snippets', Snippets),
};
