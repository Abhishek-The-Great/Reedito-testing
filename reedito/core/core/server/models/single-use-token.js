const reeditoBookshelf = require('./base');
const crypto = require('crypto');

const SingleUseToken = reeditoBookshelf.Model.extend(
  {
    tableName: 'tokens',

    defaults() {
      return {
        used_count: 0,
        otc_used_count: 0,
        uuid: crypto.randomUUID(),
        token: crypto
          .randomBytes(192 / 8)
          .toString('base64')
          // base64url encoding means the tokens are URL safe
          .replace(/\+/g, '-')
          .replace(/\//g, '_'),
      };
    },
  },
  {},
);

const SingleUseTokens = reeditoBookshelf.Collection.extend({
  model: SingleUseToken,
});

module.exports = {
  SingleUseToken: reeditoBookshelf.model('SingleUseToken', SingleUseToken),
  SingleUseTokens: reeditoBookshelf.collection('SingleUseTokens', SingleUseTokens),
};
