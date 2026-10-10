const reeditoBookshelf = require('./base');

const OfferRedemption = reeditoBookshelf.Model.extend({
  tableName: 'offer_redemptions',
});

module.exports = {
  OfferRedemption: reeditoBookshelf.model('OfferRedemption', OfferRedemption),
};
