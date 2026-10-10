const express = require('../../../../shared/express');
const bodyParser = require('body-parser');
const { http } = require('@reedito/api-framework');
const api = require('../../../api').endpoints;
const middleware = require('../../../services/members/middleware');
const shared = require('../../shared');

module.exports = function communityRoutes() {
  const router = express.Router('member-community-api');
  router.use(bodyParser.json({ limit: '16kb' }));
  router.use(middleware.loadMemberIdentity);
  router.use(middleware.rejectWhenAnonymous);

  router.get('/feed', http(api.communityMembers.feed));
  router.get('/bookmarks', http(api.communityMembers.bookmarks));
  router.get('/digest', http(api.communityMembers.digestPreferences));
  router.put('/digest', http(api.communityMembers.editDigestPreferences));
  router.post('/follow/creators/:id', http(api.communityMembers.followAuthor));
  router.delete('/follow/creators/:id', http(api.communityMembers.unfollowAuthor));
  router.post('/follow/topics/:id', http(api.communityMembers.followTopic));
  router.delete('/follow/topics/:id', http(api.communityMembers.unfollowTopic));
  router.post('/bookmarks/:id', http(api.communityMembers.bookmark));
  router.delete('/bookmarks/:id', http(api.communityMembers.unbookmark));
  router.put('/reactions/:id', http(api.communityMembers.react));
  router.delete('/reactions/:id', http(api.communityMembers.clearReaction));
  router.post(
    '/reports/:type/:id',
    shared.middleware.brute.communityReportLimiter,
    http(api.communityMembers.report),
  );
  router.post('/blocks/creators/:id', http(api.communityMembers.blockAuthor));
  router.delete('/blocks/creators/:id', http(api.communityMembers.unblockAuthor));

  return router;
};
