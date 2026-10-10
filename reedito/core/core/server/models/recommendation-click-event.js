const errors = require('@tryghost/errors');
const reeditoBookshelf = require('./base');

const RecommendationClickEvent = reeditoBookshelf.Model.extend(
  {
    tableName: 'recommendation_click_events',
  },
  {
    async edit() {
      throw new errors.IncorrectUsageError({
        message: 'Cannot edit RecommendationClickEvent',
      });
    },

    async destroy() {
      throw new errors.IncorrectUsageError({
        message: 'Cannot destroy RecommendationClickEvent',
      });
    },
  },
);

module.exports = {
  RecommendationClickEvent: reeditoBookshelf.model(
    'RecommendationClickEvent',
    RecommendationClickEvent,
  ),
};
