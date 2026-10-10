const errors = require('@tryghost/errors');
const reeditoBookshelf = require('./base');

const RecommendationSubscribeEvent = reeditoBookshelf.Model.extend(
  {
    tableName: 'recommendation_subscribe_events',
  },
  {
    async edit() {
      throw new errors.IncorrectUsageError({
        message: 'Cannot edit RecommendationSubscribeEvent',
      });
    },

    async destroy() {
      throw new errors.IncorrectUsageError({
        message: 'Cannot destroy RecommendationSubscribeEvent',
      });
    },
  },
);

module.exports = {
  RecommendationSubscribeEvent: reeditoBookshelf.model(
    'RecommendationSubscribeEvent',
    RecommendationSubscribeEvent,
  ),
};
