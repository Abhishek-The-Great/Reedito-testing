const debug = require('@tryghost/debug')('members');
const bodyParser = require('body-parser');
const express = require('../../../shared/express');
const sentry = require('../../../shared/sentry');
const membersService = require('../../services/members');
const audienceFeedbackService = require('../../services/audience-feedback');
const middleware = membersService.middleware;
const shared = require('../shared');
const errorHandler = require('@tryghost/mw-error-handler');
const { http } = require('@reedito/api-framework');
const api = require('../../api').endpoints;

const accountRoutes = require('./account');
const commentRouter = require('../comments');
const announcementRouter = require('../announcement');
const corsMiddleware = require('./middleware/cors');
const communityRoutes = require('./community/routes');

/**
 * @returns {import('express').Application}
 */
module.exports = function setupMembersApp() {
  debug('Members App setup start');
  const membersApp = express('members');

  // Members API shouldn't be cached
  membersApp.use(shared.middleware.cacheControl('private'));

  // Support CORS for requests from the frontend
  membersApp.use(corsMiddleware);

  // Currently global handling for signing in with ?token= magiclinks
  membersApp.use(middleware.createSessionFromMagicLink);

  // Routing

  // Initializes members specific routes as well as assigns members specific data to the req/res objects.

  // Manage newsletter subscription via unsubscribe link - these should be authenticated by uuid and hashed key
  membersApp.get(
    '/api/member/newsletters',
    middleware.authMemberByUuid,
    middleware.getMemberNewsletters,
  );
  membersApp.put(
    '/api/member/newsletters',
    bodyParser.json({ limit: '50mb' }),
    middleware.authMemberByUuid,
    middleware.updateMemberNewsletters,
  );

  // A member's own account. Its routes and how they authenticate live together.
  membersApp.use('/api/member', accountRoutes());

  membersApp.post('/api/member/email', bodyParser.json({ limit: '50mb' }), (req, res, next) =>
    membersService.api.middleware.updateEmailAddress(req, res, next),
  );

  // Member offers (retention etc.)
  membersApp.post(
    '/api/member/offers',
    bodyParser.json(),
    function lazyGetMemberOffersMw(req, res, next) {
      return membersService.api.middleware.getMemberOffers(req, res, next);
    },
  );

  // Remove email from suppression list
  // Manage session
  membersApp.get('/api/session', middleware.getIdentityToken);
  membersApp.delete('/api/session', bodyParser.json({ limit: '5mb' }), middleware.deleteSession);

  membersApp.get('/api/entitlements', middleware.getEntitlementToken);
  membersApp.get('/api/integrity-token', middleware.createIntegrityToken);

  membersApp.post(
    '/api/send-magic-link',
    bodyParser.json(),
    middleware.verifyIntegrityToken,
    // Prevent brute forcing email addresses (user enumeration)
    shared.middleware.brute.membersAuthEnumeration,
    // Prevent brute forcing passwords for the same email address
    shared.middleware.brute.membersAuth,
    // NOTE: this is wrapped in a function to ensure we always go via the getter
    function lazySendMagicLinkMw(req, res, next) {
      return membersService.api.middleware.sendMagicLink(req, res, next);
    },
  );
  membersApp.post(
    '/api/verify-otc',
    bodyParser.json(),
    middleware.verifyIntegrityToken,
    shared.middleware.brute.otcVerificationEnumeration,
    shared.middleware.brute.otcVerification,
    // NOTE: this is wrapped in a function to ensure we always go via the getter
    function lazyVerifyOTCMw(req, res, next) {
      return membersService.api.middleware.verifyOTC(req, res, next);
    },
  );
  // Comments
  membersApp.use('/api/comments', commentRouter());

  // Reader feed, follows, saved articles, reactions, reports, and blocks
  membersApp.use('/api/community', communityRoutes());

  // Feedback
  membersApp.post(
    '/api/feedback',
    bodyParser.json({ limit: '50mb' }),
    middleware.loadMemberSession,
    middleware.authMemberByUuid,
    http(api.feedbackMembers.add),
  );

  // Durable, id-based feedback link from newsletters. Resolves the post's
  // current URL at click time so changing a slug never breaks feedback buttons.
  membersApp.get('/feedback/:postId/:score', (req, res, next) =>
    audienceFeedbackService.controller.redirectToPost(req, res, next),
  );

  // Gifts
  membersApp.get(
    '/api/gifts/:token/redeem',
    middleware.loadMemberSession,
    http(api.giftsMembers.getRedeemable),
  );
  membersApp.post(
    '/api/gifts/:token/redeem',
    bodyParser.json({ limit: '50mb' }),
    middleware.loadMemberSession,
    http(api.giftsMembers.redeem),
  );

  // Announcement
  membersApp.use('/api/announcement', middleware.loadMemberSession, announcementRouter());

  // Recommendations
  membersApp.post(
    '/api/recommendations/:id/clicked',
    middleware.loadMemberSession,
    http(api.recommendationsPublic.trackClicked),
  );

  // Recommendations
  membersApp.post(
    '/api/recommendations/:id/subscribed',
    middleware.loadMemberSession,
    http(api.recommendationsPublic.trackSubscribed),
  );

  // Allow external systems to read public settings via the members api
  // Without CORS issues and without a required integration token
  // 1. Detect if a site is Running Reedito
  // 2. For recommendations to know when we can offer 'one-click-subscribe' to know if members are enabled
  // Why not content API? Domain can be different from recommended domain + CORS issues
  membersApp.get('/api/site', http(api.site.read));

  // API error handling
  membersApp.use('/api', errorHandler.resourceNotFound);
  membersApp.use('/api', errorHandler.handleJSONResponse(sentry));

  // Webhook error handling
  membersApp.use('/webhooks', errorHandler.resourceNotFound);
  membersApp.use('/webhooks', errorHandler.handleJSONResponse(sentry));

  debug('Members App setup end');

  return membersApp;
};
