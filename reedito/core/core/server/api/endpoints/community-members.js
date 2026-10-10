const community = require('../../services/community');

/** @type {import('@reedito/api-framework').Controller} */
module.exports = {
  docName: 'community',

  feed: {
    headers: { cacheInvalidate: false },
    options: ['limit'],
    permissions: false,
    async query(frame) {
      return community.getReaderFeed(frame.options.context.member.id, frame.options.limit);
    },
  },

  bookmarks: {
    headers: { cacheInvalidate: false },
    options: ['limit'],
    permissions: false,
    async query(frame) {
      return community.getBookmarks(frame.options.context.member.id, frame.options.limit);
    },
  },

  digestPreferences: {
    headers: { cacheInvalidate: false },
    permissions: false,
    async query(frame) {
      return community.getDigestPreferences(frame.options.context.member.id);
    },
  },

  editDigestPreferences: {
    statusCode: 200,
    permissions: false,
    data: ['enabled'],
    validation: { data: { enabled: { type: 'boolean', required: true } } },
    async query(frame) {
      return community.setDigestPreferences(frame.options.context.member.id, frame.data.enabled);
    },
  },

  followAuthor: {
    statusCode: 200,
    permissions: false,
    options: ['id'],
    validation: { options: { id: { required: true } } },
    async query(frame) {
      return community.followAuthor(frame.options.context.member.id, frame.options.id);
    },
  },

  unfollowAuthor: {
    statusCode: 200,
    permissions: false,
    options: ['id'],
    validation: { options: { id: { required: true } } },
    async query(frame) {
      return community.unfollowAuthor(frame.options.context.member.id, frame.options.id);
    },
  },

  followTopic: {
    statusCode: 200,
    permissions: false,
    options: ['id'],
    validation: { options: { id: { required: true } } },
    async query(frame) {
      return community.followTopic(frame.options.context.member.id, frame.options.id);
    },
  },

  unfollowTopic: {
    statusCode: 200,
    permissions: false,
    options: ['id'],
    validation: { options: { id: { required: true } } },
    async query(frame) {
      return community.unfollowTopic(frame.options.context.member.id, frame.options.id);
    },
  },

  bookmark: {
    statusCode: 200,
    permissions: false,
    options: ['id'],
    validation: { options: { id: { required: true } } },
    async query(frame) {
      return community.bookmark(frame.options.context.member.id, frame.options.id);
    },
  },

  unbookmark: {
    statusCode: 200,
    permissions: false,
    options: ['id'],
    validation: { options: { id: { required: true } } },
    async query(frame) {
      return community.unbookmark(frame.options.context.member.id, frame.options.id);
    },
  },

  react: {
    statusCode: 200,
    permissions: false,
    options: ['id'],
    data: ['reaction'],
    validation: {
      options: { id: { required: true } },
      data: { reaction: { type: 'string', required: true } },
    },
    async query(frame) {
      return community.reactToArticle(
        frame.options.context.member.id,
        frame.options.id,
        frame.data.reaction,
      );
    },
  },

  clearReaction: {
    statusCode: 200,
    permissions: false,
    options: ['id'],
    validation: { options: { id: { required: true } } },
    async query(frame) {
      return community.clearArticleReaction(frame.options.context.member.id, frame.options.id);
    },
  },

  report: {
    statusCode: 201,
    permissions: false,
    options: ['type', 'id'],
    data: ['reason', 'details'],
    validation: {
      options: { type: { required: true }, id: { required: true } },
      data: { reason: { type: 'string', required: true }, details: { type: 'string' } },
    },
    async query(frame) {
      return community.reportContent(
        frame.options.context.member.id,
        frame.options.type,
        frame.options.id,
        frame.data.reason,
        frame.data.details,
      );
    },
  },

  blockAuthor: {
    statusCode: 200,
    permissions: false,
    options: ['id'],
    validation: { options: { id: { required: true } } },
    async query(frame) {
      return community.blockAuthor(frame.options.context.member.id, frame.options.id);
    },
  },

  unblockAuthor: {
    statusCode: 200,
    permissions: false,
    options: ['id'],
    validation: { options: { id: { required: true } } },
    async query(frame) {
      return community.unblockAuthor(frame.options.context.member.id, frame.options.id);
    },
  },
};
