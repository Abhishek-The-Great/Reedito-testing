const community = require('../../services/community');
const errors = require('@tryghost/errors');

function requireCommunityModerator(user) {
  const roleNames = (user?.roles ?? []).map((role) =>
    typeof role === 'string' ? role : role?.name,
  );
  if (!roleNames.some((role) => role === 'Owner' || role === 'Administrator')) {
    throw new errors.NoPermissionError({
      message: 'Only publication owners and administrators can moderate community content.',
    });
  }
}

/** @type {import('@reedito/api-framework').Controller} */
module.exports = {
  docName: 'community',

  myUpdates: {
    headers: { cacheInvalidate: false },
    permissions: { docName: 'posts', method: 'browse' },
    async query(frame) {
      return community.getMyUpdates(frame.user.id);
    },
  },

  createUpdate: {
    statusCode: 201,
    permissions: { docName: 'posts', method: 'add' },
    data: ['content'],
    validation: { data: { content: { type: 'string', required: true } } },
    async query(frame) {
      return community.createUpdate(frame.user.id, frame.data.content);
    },
  },

  deleteUpdate: {
    statusCode: 204,
    permissions: { docName: 'posts', method: 'edit' },
    options: ['id'],
    validation: { options: { id: { required: true } } },
    async query(frame) {
      return community.deleteMyUpdate(frame.user.id, frame.options.id);
    },
  },

  analytics: {
    headers: { cacheInvalidate: false },
    permissions: { docName: 'posts', method: 'browse' },
    async query(frame) {
      return community.getCreatorAnalytics(frame.user.id);
    },
  },

  moderationQueue: {
    headers: { cacheInvalidate: false },
    permissions: { docName: 'comments', method: 'browse' },
    async query(frame) {
      requireCommunityModerator(frame.user);
      return community.getModerationQueue();
    },
  },

  reviewReport: {
    permissions: { docName: 'comments', method: 'browse' },
    options: ['id'],
    data: ['action', 'review_note'],
    validation: {
      options: { id: { required: true } },
      data: { action: { type: 'string', required: true }, review_note: { type: 'string' } },
    },
    async query(frame) {
      requireCommunityModerator(frame.user);
      return community.reviewReport(
        frame.options.id,
        frame.user.id,
        frame.data.action,
        frame.data.review_note,
      );
    },
  },

  moderateUpdate: {
    permissions: { docName: 'comments', method: 'browse' },
    options: ['id'],
    data: ['status'],
    validation: {
      options: { id: { required: true } },
      data: { status: { type: 'string', required: true } },
    },
    async query(frame) {
      requireCommunityModerator(frame.user);
      return community.moderateUpdate(frame.options.id, frame.user.id, frame.data.status);
    },
  },
};
