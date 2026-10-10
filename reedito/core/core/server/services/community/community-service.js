const ObjectId = require('bson-objectid').default;
const errors = require('@tryghost/errors');
const logging = require('@tryghost/logging');
const bookshelf = require('../../models/base/bookshelf');
const models = require('../../models');
const statsService = require('../stats');
const urlService = require('../url');
const urlUtils = require('../../../shared/url-utils').default;

const knex = bookshelf.knex;
const REPORT_REASONS = new Set(['spam', 'harassment', 'misinformation', 'other']);
const UPDATE_STATUSES = new Set(['published', 'hidden']);
const MAX_FEED_ITEMS = 30;
const MAX_CREATOR_UPDATES = 5;
const MAX_REPORTS_PER_HOUR = 5;
const MAX_UPDATE_LENGTH = 500;
const MAX_FOLLOWED_CREATORS = 500;
const MAX_FOLLOWED_TOPICS = 100;
const MAX_BLOCKED_CREATORS = 100;
const MAX_WEEKLY_DIGEST_RECIPIENTS = 500;
const DIGEST_LOOKBACK_DAYS = 7;
const SERIES_TAG_PREFIX = 'series: ';

const id = () => ObjectId().toHexString();

function requireId(value, name = 'id') {
  if (typeof value !== 'string' || !/^[a-f0-9]{24}$/i.test(value)) {
    throw new errors.BadRequestError({ message: `A valid ${name} is required.` });
  }
  return value;
}

function asNumber(value) {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    return Number.parseInt(value, 10) || 0;
  }
  return 0;
}

function countQuery(query) {
  return query
    .count({ count: '*' })
    .first()
    .then((row) => asNumber(row?.count));
}

function getArticleSeries(tags) {
  const seriesTag = tags.find((tag) => tag.name.toLowerCase().startsWith(SERIES_TAG_PREFIX));
  if (!seriesTag) {
    return null;
  }

  const name = seriesTag.name.slice(SERIES_TAG_PREFIX.length).trim();
  if (!name) {
    return null;
  }

  return {
    name,
    url: urlService.getUrlForResource(
      { id: seriesTag.id, slug: seriesTag.slug, type: 'tags' },
      { absolute: true },
    ),
  };
}

class CommunityService {
  async getDigestPreferences(memberId) {
    const preference = await knex('reader_digest_preferences')
      .where({ member_id: memberId })
      .first();
    return { enabled: preference?.enabled === true || preference?.enabled === 1 };
  }

  async setDigestPreferences(memberId, enabled) {
    if (typeof enabled !== 'boolean') {
      throw new errors.BadRequestError({ message: 'Digest preference must be a boolean.' });
    }

    const now = new Date();
    await knex('reader_digest_preferences')
      .insert({
        member_id: memberId,
        enabled,
        last_sent_at: null,
        created_at: now,
        updated_at: now,
      })
      .onConflict('member_id')
      .merge({ enabled, updated_at: now });

    return this.getDigestPreferences(memberId);
  }

  async sendWeeklyDigests() {
    const mailService = require('../mail');
    const ReeditoMailer = mailService.ReeditoMailer;
    const { NotificationEmailService } = require('../notifications/notification-email');
    const digestMailer = new NotificationEmailService({
      mailer: new ReeditoMailer(),
      generateEmailContent: mailService.utils.generateContent,
      getSiteUrl: () => urlUtils.urlFor('home', true),
    });
    const now = new Date();
    const fallbackSince = new Date(now.getTime() - DIGEST_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    // Leave schedule jitter room so a weekly run still processes members when
    // the randomly selected off-peak hour falls slightly earlier than 7 days.
    const retryBefore = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    const preferencesUrl = `${urlUtils.urlFor('home', true).replace(/\/$/, '')}/portal/#/portal/community/`;
    let lastProcessedMemberId = null;

    while (true) {
      const recipientQuery = knex('reader_digest_preferences as preference')
        .join('members as member', 'member.id', 'preference.member_id')
        .select('preference.member_id', 'preference.last_sent_at', 'member.email')
        .where({ 'preference.enabled': true, 'member.email_disabled': false })
        .where(function () {
          this.whereNull('preference.last_sent_at').orWhere(
            'preference.last_sent_at',
            '<=',
            retryBefore,
          );
        })
        .orderBy('preference.member_id', 'asc')
        .limit(MAX_WEEKLY_DIGEST_RECIPIENTS);

      if (lastProcessedMemberId) {
        recipientQuery.where('preference.member_id', '>', lastProcessedMemberId);
      }

      const recipients = await recipientQuery;

      if (!recipients.length) {
        break;
      }

      for (const recipient of recipients) {
        lastProcessedMemberId = recipient.member_id;
        try {
          const since = recipient.last_sent_at ? new Date(recipient.last_sent_at) : fallbackSince;
          const articles = await knex('posts as post')
            .join('posts_authors as author_link', function () {
              this.on('author_link.post_id', '=', 'post.id').andOn(
                'author_link.sort_order',
                '=',
                knex.raw('?', [0]),
              );
            })
            .join('users as author', 'author.id', 'author_link.author_id')
            .distinct(
              'post.id',
              'post.title',
              'post.custom_excerpt',
              'post.published_at',
              'post.url',
              'author.name as author_name',
            )
            .where({
              'post.type': 'post',
              'post.status': 'published',
              'post.visibility': 'public',
              'author.status': 'active',
              'author.visibility': 'public',
            })
            .where('post.published_at', '>', since)
            .where(function () {
              this.whereExists(function () {
                this.select(knex.raw('1'))
                  .from('reader_author_follows as followed_author')
                  .whereRaw('followed_author.member_id = ?', [recipient.member_id])
                  .whereRaw('followed_author.author_id = author.id');
              }).orWhereExists(function () {
                this.select(knex.raw('1'))
                  .from('posts_tags as post_topic')
                  .join(
                    'reader_topic_follows as followed_topic',
                    'followed_topic.tag_id',
                    'post_topic.tag_id',
                  )
                  .whereRaw('post_topic.post_id = post.id')
                  .whereRaw('followed_topic.member_id = ?', [recipient.member_id]);
              });
            })
            .whereNotExists(function () {
              this.select(knex.raw('1'))
                .from('reader_blocked_authors as blocked_author')
                .whereRaw('blocked_author.member_id = ?', [recipient.member_id])
                .whereRaw('blocked_author.author_id = author.id');
            })
            .orderBy('post.published_at', 'desc')
            .limit(20);

          const safeArticles = articles.filter((article) => article.url);
          if (safeArticles.length) {
            const escapeHtml = (value) =>
              String(value ?? '').replace(
                /[&<>"']/g,
                (character) =>
                  ({
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    '"': '&quot;',
                    "'": '&#39;',
                  })[character],
              );
            const content = [
              '<p>Here are new articles from creators and topics you follow.</p>',
              '<ul>',
              ...safeArticles.map(
                (article) =>
                  `<li><a href="${escapeHtml(article.url)}">${escapeHtml(article.title)}</a> by ${escapeHtml(article.author_name)}${article.custom_excerpt ? `<p>${escapeHtml(article.custom_excerpt)}</p>` : ''}</li>`,
              ),
              '</ul>',
              `<p><a href="${escapeHtml(preferencesUrl)}">Manage your digest preferences</a></p>`,
            ].join('');
            await digestMailer.send({
              to: [recipient.email],
              subject: 'Your weekly creator digest',
              content,
            });
          }

          await knex('reader_digest_preferences')
            .where({ member_id: recipient.member_id, enabled: true })
            .update({ last_sent_at: now, updated_at: now });
        } catch (error) {
          logging.error(
            `[Community] Could not send weekly digest to member ${recipient.member_id}`,
            error,
          );
          // Leave the timestamp untouched so the next weekly run retries this
          // recipient, while the member-id cursor avoids retrying it in this run.
        }
      }
    }
  }

  async requirePublicPost(postId) {
    const post = await knex('posts')
      .select('id', 'title', 'slug', 'url', 'status', 'visibility', 'published_at')
      .where({
        id: requireId(postId, 'post id'),
        type: 'post',
        status: 'published',
        visibility: 'public',
      })
      .first();

    if (!post) {
      throw new errors.NotFoundError({ message: 'Article not found.' });
    }

    return post;
  }

  async requirePublicAuthor(authorId) {
    const author = await knex('users')
      .select('id')
      .where({ id: requireId(authorId, 'creator id'), status: 'active', visibility: 'public' })
      .first();

    if (!author) {
      throw new errors.NotFoundError({ message: 'Creator not found.' });
    }
  }

  async requirePublicTopic(tagId) {
    const topic = await knex('tags')
      .select('id')
      .where({ id: requireId(tagId, 'topic id'), visibility: 'public' })
      .first();

    if (!topic) {
      throw new errors.NotFoundError({ message: 'Topic not found.' });
    }
  }

  async assertRateLimit(table, column, value, max, actionName) {
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const count = await countQuery(
      knex(table).where(column, value).where('created_at', '>=', since),
    );
    if (count >= max) {
      throw new errors.TooManyRequestsError({
        message: `You have reached the hourly limit for ${actionName}. Please try again later.`,
      });
    }
  }

  async getReaderFeed(memberId, requestedLimit = 20) {
    const limit = Math.max(1, Math.min(MAX_FEED_ITEMS, asNumber(requestedLimit) || 20));
    const [followedAuthors, followedTopics, blockedAuthors, authors, topics] = await Promise.all([
      knex('reader_author_follows').select('author_id').where({ member_id: memberId }),
      knex('reader_topic_follows').select('tag_id').where({ member_id: memberId }),
      knex('reader_blocked_authors').select('author_id').where({ member_id: memberId }),
      knex('users as u')
        .join('posts_authors as pa', 'pa.author_id', 'u.id')
        .join('posts as p', 'p.id', 'pa.post_id')
        .where({
          'u.status': 'active',
          'u.visibility': 'public',
          'p.type': 'post',
          'p.status': 'published',
          'p.visibility': 'public',
        })
        .groupBy('u.id', 'u.name', 'u.slug', 'u.bio', 'u.profile_image')
        .select('u.id', 'u.name', 'u.slug', 'u.bio', 'u.profile_image')
        .countDistinct({ article_count: 'p.id' })
        .orderBy('u.name', 'asc')
        .limit(100),
      knex('tags as t')
        .join('posts_tags as pt', 'pt.tag_id', 't.id')
        .join('posts as p', 'p.id', 'pt.post_id')
        .where({
          't.visibility': 'public',
          'p.type': 'post',
          'p.status': 'published',
          'p.visibility': 'public',
        })
        .groupBy('t.id', 't.name', 't.slug')
        .select('t.id', 't.name', 't.slug')
        .countDistinct({ article_count: 'p.id' })
        .orderBy('t.name', 'asc')
        .limit(100),
    ]);

    const followedAuthorIds = new Set(followedAuthors.map((item) => item.author_id));
    const followedTopicIds = new Set(followedTopics.map((item) => item.tag_id));
    const blockedAuthorIds = blockedAuthors.map((item) => item.author_id);

    const postsQuery = knex('posts as p')
      .join('posts_authors as pa', function () {
        this.on('pa.post_id', '=', 'p.id').andOn('pa.sort_order', '=', knex.raw('?', [0]));
      })
      .join('users as u', 'u.id', 'pa.author_id')
      .where({
        'p.status': 'published',
        'p.type': 'post',
        'p.visibility': 'public',
        'u.status': 'active',
        'u.visibility': 'public',
      })
      .select(
        'p.id',
        'p.uuid',
        'p.title',
        'p.slug',
        'p.custom_excerpt',
        'p.feature_image',
        'p.published_at',
        'p.status',
        'p.type',
        'p.visibility',
        'p.featured',
        'u.id as author_id',
        'u.name as author_name',
        'u.slug as author_slug',
        'u.profile_image as author_image',
      );

    if (blockedAuthorIds.length) {
      postsQuery.whereNotExists(function () {
        this.select(knex.raw('1'))
          .from('posts_authors as pa_blocked')
          .join('reader_blocked_authors as rba', 'rba.author_id', 'pa_blocked.author_id')
          .whereRaw('pa_blocked.post_id = p.id')
          .andWhere('rba.member_id', memberId);
      });
    }

    const followedAuthorCase = followedAuthorIds.size
      ? knex.raw(
          'CASE WHEN EXISTS (SELECT 1 FROM reader_author_follows raf WHERE raf.member_id = ? AND raf.author_id = pa.author_id) THEN 1 ELSE 0 END',
          [memberId],
        )
      : knex.raw('0');
    const followedTopicCase = followedTopicIds.size
      ? knex.raw(
          'CASE WHEN EXISTS (SELECT 1 FROM posts_tags pt JOIN reader_topic_follows rtf ON rtf.tag_id = pt.tag_id WHERE pt.post_id = p.id AND rtf.member_id = ?) THEN 1 ELSE 0 END',
          [memberId],
        )
      : knex.raw('0');

    const postRows = await postsQuery
      .select({ followed_creator: followedAuthorCase, followed_topic: followedTopicCase })
      .orderBy('followed_creator', 'desc')
      .orderBy('followed_topic', 'desc')
      .orderBy('p.featured', 'desc')
      .orderBy('p.published_at', 'desc')
      .limit(limit);

    const updatesQuery = knex('creator_updates as cu')
      .join('users as u', 'u.id', 'cu.author_id')
      .where({ 'cu.status': 'published', 'u.status': 'active', 'u.visibility': 'public' })
      .select(
        'cu.id',
        'cu.content',
        'cu.created_at',
        'u.id as author_id',
        'u.name as author_name',
        'u.slug as author_slug',
        'u.profile_image as author_image',
      )
      .orderBy('cu.created_at', 'desc')
      .limit(limit);
    if (blockedAuthorIds.length) {
      updatesQuery.whereNotIn('u.id', blockedAuthorIds);
    }

    const updateRows = await updatesQuery;
    const postIds = postRows.map((post) => post.id);
    const [tagRows, memberBookmarks, memberReactions, reactionCounts, bookmarkCounts] =
      postIds.length
        ? await Promise.all([
            knex('posts_tags as pt')
              .join('tags as t', 't.id', 'pt.tag_id')
              .whereIn('pt.post_id', postIds)
              .where('t.visibility', 'public')
              .select('pt.post_id', 't.id', 't.name', 't.slug'),
            knex('article_bookmarks')
              .select('post_id')
              .where({ member_id: memberId })
              .whereIn('post_id', postIds),
            knex('article_reactions')
              .select('post_id', 'reaction')
              .where({ member_id: memberId })
              .whereIn('post_id', postIds),
            knex('article_reactions')
              .select('post_id')
              .count({ count: '*' })
              .whereIn('post_id', postIds)
              .groupBy('post_id'),
            knex('article_bookmarks')
              .select('post_id')
              .count({ count: '*' })
              .whereIn('post_id', postIds)
              .groupBy('post_id'),
          ])
        : [[], [], [], [], []];

    const tagsByPost = new Map();
    for (const tag of tagRows) {
      const tagsForPost = tagsByPost.get(tag.post_id) ?? [];
      tagsForPost.push({ id: tag.id, name: tag.name, slug: tag.slug });
      tagsForPost[tagsForPost.length - 1].visibility = 'public';
      tagsByPost.set(tag.post_id, tagsForPost);
    }
    const reactionCountByPost = new Map(
      reactionCounts.map((row) => [row.post_id, asNumber(row.count)]),
    );
    const bookmarkCountByPost = new Map(
      bookmarkCounts.map((row) => [row.post_id, asNumber(row.count)]),
    );
    const reactionByPost = new Map(memberReactions.map((row) => [row.post_id, row.reaction]));
    const bookmarkedPosts = new Set(memberBookmarks.map((row) => row.post_id));

    const authorProfile = (author) => ({
      id: author.id,
      name: author.name,
      slug: author.slug,
      profile_image: author.profile_image,
      url: urlService.getUrlForResource(
        { id: author.id, slug: author.slug, type: 'authors' },
        { absolute: true },
      ),
    });
    const postItems = postRows.map((post) => {
      const tags = tagsByPost.get(post.id) ?? [];
      const author = authorProfile({
        id: post.author_id,
        name: post.author_name,
        slug: post.author_slug,
        profile_image: post.author_image,
      });
      const generatedUrl = urlService.getUrlForResource(
        {
          ...post,
          id: post.id,
          type: 'posts',
          status: 'published',
          visibility: 'public',
          authors: [author],
          primary_author: author,
          tags,
          primary_tag: tags[0] ?? null,
        },
        { absolute: true },
      );
      const fallbackUrl = urlUtils.urlFor({ relativeUrl: `/${post.slug}/` }, true);
      return {
        type: 'article',
        id: post.id,
        title: post.title,
        slug: post.slug,
        url: generatedUrl.includes('/404/') ? fallbackUrl : generatedUrl,
        excerpt: post.custom_excerpt,
        feature_image: post.feature_image,
        published_at: post.published_at,
        featured: Boolean(post.featured),
        followed_creator: Boolean(post.followed_creator),
        followed_topic: Boolean(post.followed_topic),
        author,
        tags,
        series: getArticleSeries(tags),
        reaction_count: reactionCountByPost.get(post.id) ?? 0,
        bookmark_count: bookmarkCountByPost.get(post.id) ?? 0,
        member_reaction: reactionByPost.get(post.id) ?? null,
        is_bookmarked: bookmarkedPosts.has(post.id),
      };
    });
    const updateItems = updateRows.map((update) => ({
      type: 'update',
      id: update.id,
      content: update.content,
      published_at: update.created_at,
      followed_creator: followedAuthorIds.has(update.author_id),
      followed_topic: false,
      author: authorProfile({
        id: update.author_id,
        name: update.author_name,
        slug: update.author_slug,
        profile_image: update.author_image,
      }),
    }));
    const items = [...postItems, ...updateItems].sort((a, b) => {
      const relevance = (item) => Number(item.followed_creator) * 2 + Number(item.followed_topic);
      return (
        relevance(b) - relevance(a) ||
        Number(Boolean(b.featured)) - Number(Boolean(a.featured)) ||
        new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
      );
    });

    return {
      items: items.slice(0, limit),
      authors: authors.map((author) => ({
        ...author,
        article_count: asNumber(author.article_count),
        following: followedAuthorIds.has(author.id),
        blocked: blockedAuthorIds.includes(author.id),
        url: urlService.getUrlForResource(
          { id: author.id, slug: author.slug, type: 'authors' },
          { absolute: true },
        ),
      })),
      topics: topics.map((topic) => ({
        ...topic,
        article_count: asNumber(topic.article_count),
        following: followedTopicIds.has(topic.id),
      })),
    };
  }

  async getBookmarks(memberId, requestedLimit = 30) {
    const limit = Math.max(1, Math.min(MAX_FEED_ITEMS, asNumber(requestedLimit) || MAX_FEED_ITEMS));
    const rows = await knex('article_bookmarks as b')
      .join('posts as p', 'p.id', 'b.post_id')
      .join('posts_authors as pa', function () {
        this.on('pa.post_id', '=', 'p.id').andOn('pa.sort_order', '=', knex.raw('?', [0]));
      })
      .join('users as u', 'u.id', 'pa.author_id')
      .where({
        'b.member_id': memberId,
        'p.status': 'published',
        'p.type': 'post',
        'p.visibility': 'public',
        'u.status': 'active',
        'u.visibility': 'public',
      })
      .select(
        'p.id',
        'p.uuid',
        'p.title',
        'p.slug',
        'p.custom_excerpt',
        'p.feature_image',
        'p.published_at',
        'u.id as author_id',
        'u.name as author_name',
        'u.slug as author_slug',
      )
      .orderBy('b.created_at', 'desc')
      .limit(limit);

    const tagRows = rows.length
      ? await knex('posts_tags as pt')
          .join('tags as t', 't.id', 'pt.tag_id')
          .whereIn(
            'pt.post_id',
            rows.map((row) => row.id),
          )
          .where('t.visibility', 'public')
          .select('pt.post_id', 't.id', 't.name', 't.slug')
      : [];
    const tagsByPost = new Map();
    for (const tag of tagRows) {
      const tags = tagsByPost.get(tag.post_id) ?? [];
      tags.push({ ...tag, visibility: 'public' });
      tagsByPost.set(tag.post_id, tags);
    }

    return {
      bookmarks: rows.map((row) => {
        const author = { id: row.author_id, slug: row.author_slug, name: row.author_name };
        const tags = tagsByPost.get(row.id) ?? [];
        const modelUrl = urlService.getUrlForResource(
          {
            id: row.id,
            uuid: row.uuid,
            slug: row.slug,
            status: 'published',
            type: 'posts',
            published_at: row.published_at,
            authors: [author],
            primary_author: author,
            tags,
            primary_tag: tags[0] ?? null,
          },
          { absolute: true },
        );
        return {
          id: row.id,
          title: row.title,
          url: modelUrl.includes('/404/')
            ? urlUtils.urlFor({ relativeUrl: `/${row.slug}/` }, true)
            : modelUrl,
          excerpt: row.custom_excerpt,
          feature_image: row.feature_image,
          published_at: row.published_at,
          author,
          series: getArticleSeries(tags),
        };
      }),
    };
  }

  async followAuthor(memberId, authorId) {
    await this.requirePublicAuthor(authorId);
    const blocked = await knex('reader_blocked_authors')
      .where({ member_id: memberId, author_id: authorId })
      .first();
    if (blocked) {
      throw new errors.BadRequestError({ message: 'Unblock this creator before following them.' });
    }
    const existing = await knex('reader_author_follows')
      .where({ member_id: memberId, author_id: authorId })
      .first();
    if (
      !existing &&
      (await countQuery(knex('reader_author_follows').where({ member_id: memberId }))) >=
        MAX_FOLLOWED_CREATORS
    ) {
      throw new errors.BadRequestError({ message: 'You have reached the creator follow limit.' });
    }
    await knex('reader_author_follows')
      .insert({ id: id(), member_id: memberId, author_id: authorId, created_at: new Date() })
      .onConflict(['member_id', 'author_id'])
      .ignore();
    return { following: true };
  }

  async unfollowAuthor(memberId, authorId) {
    await knex('reader_author_follows')
      .where({ member_id: memberId, author_id: requireId(authorId, 'creator id') })
      .del();
    return { following: false };
  }

  async followTopic(memberId, tagId) {
    await this.requirePublicTopic(tagId);
    const existing = await knex('reader_topic_follows')
      .where({ member_id: memberId, tag_id: tagId })
      .first();
    if (
      !existing &&
      (await countQuery(knex('reader_topic_follows').where({ member_id: memberId }))) >=
        MAX_FOLLOWED_TOPICS
    ) {
      throw new errors.BadRequestError({ message: 'You have reached the topic follow limit.' });
    }
    await knex('reader_topic_follows')
      .insert({ id: id(), member_id: memberId, tag_id: tagId, created_at: new Date() })
      .onConflict(['member_id', 'tag_id'])
      .ignore();
    return { following: true };
  }

  async unfollowTopic(memberId, tagId) {
    await knex('reader_topic_follows')
      .where({ member_id: memberId, tag_id: requireId(tagId, 'topic id') })
      .del();
    return { following: false };
  }

  async bookmark(memberId, postId) {
    await this.requirePublicPost(postId);
    await knex('article_bookmarks')
      .insert({ id: id(), member_id: memberId, post_id: postId, created_at: new Date() })
      .onConflict(['member_id', 'post_id'])
      .ignore();
    return { bookmarked: true };
  }

  async unbookmark(memberId, postId) {
    await knex('article_bookmarks')
      .where({ member_id: memberId, post_id: requireId(postId, 'article id') })
      .del();
    return { bookmarked: false };
  }

  async reactToArticle(memberId, postId, reaction) {
    await this.requirePublicPost(postId);
    if (!['like', 'clap'].includes(reaction)) {
      throw new errors.BadRequestError({ message: 'Choose either like or clap.' });
    }
    const now = new Date();
    await knex('article_reactions')
      .insert({
        id: id(),
        member_id: memberId,
        post_id: postId,
        reaction,
        created_at: now,
        updated_at: null,
      })
      .onConflict(['member_id', 'post_id'])
      .merge({ reaction, updated_at: now });
    return { reaction };
  }

  async clearArticleReaction(memberId, postId) {
    await knex('article_reactions')
      .where({ member_id: memberId, post_id: requireId(postId, 'article id') })
      .del();
    return { reaction: null };
  }

  async reportContent(memberId, targetType, targetId, reason, details) {
    if (!['post', 'update'].includes(targetType) || !REPORT_REASONS.has(reason)) {
      throw new errors.BadRequestError({ message: 'The report type or reason is invalid.' });
    }

    const safeTargetId = requireId(targetId, 'content id');
    if (targetType === 'post') {
      await this.requirePublicPost(safeTargetId);
    } else {
      const update = await knex('creator_updates')
        .select('id')
        .where({ id: safeTargetId, status: 'published' })
        .first();
      if (!update) {
        throw new errors.NotFoundError({ message: 'Update not found.' });
      }
    }

    const existing = await knex('community_reports')
      .where({ reporter_member_id: memberId, target_type: targetType, target_id: safeTargetId })
      .first();
    if (existing) {
      return { reported: true, duplicate: true };
    }

    await this.assertRateLimit(
      'community_reports',
      'reporter_member_id',
      memberId,
      MAX_REPORTS_PER_HOUR,
      'reports',
    );
    const now = new Date();
    await knex('community_reports').insert({
      id: id(),
      reporter_member_id: memberId,
      target_type: targetType,
      target_id: safeTargetId,
      reason,
      details: typeof details === 'string' ? details.trim().slice(0, 2000) || null : null,
      status: 'open',
      created_at: now,
      updated_at: now,
    });

    return { reported: true, duplicate: false };
  }

  async blockAuthor(memberId, authorId) {
    await this.requirePublicAuthor(authorId);
    const existing = await knex('reader_blocked_authors')
      .where({ member_id: memberId, author_id: authorId })
      .first();
    if (
      !existing &&
      (await countQuery(knex('reader_blocked_authors').where({ member_id: memberId }))) >=
        MAX_BLOCKED_CREATORS
    ) {
      throw new errors.BadRequestError({ message: 'You have reached the creator block limit.' });
    }
    await knex('reader_author_follows').where({ member_id: memberId, author_id: authorId }).del();
    await knex('reader_blocked_authors')
      .insert({ id: id(), member_id: memberId, author_id: authorId, created_at: new Date() })
      .onConflict(['member_id', 'author_id'])
      .ignore();
    return { blocked: true };
  }

  async unblockAuthor(memberId, authorId) {
    await knex('reader_blocked_authors')
      .where({ member_id: memberId, author_id: requireId(authorId, 'creator id') })
      .del();
    return { blocked: false };
  }

  async getMyUpdates(authorId) {
    const rows = await knex('creator_updates')
      .select('id', 'content', 'status', 'created_at', 'updated_at')
      .where({ author_id: authorId })
      .orderBy('created_at', 'desc')
      .limit(30);
    return { updates: rows };
  }

  async createUpdate(authorId, content) {
    const normalizedContent = typeof content === 'string' ? content.trim() : '';
    if (!normalizedContent || normalizedContent.length > MAX_UPDATE_LENGTH) {
      throw new errors.BadRequestError({
        message: `Updates must be between 1 and ${MAX_UPDATE_LENGTH} characters.`,
      });
    }

    await this.assertRateLimit(
      'creator_updates',
      'author_id',
      authorId,
      MAX_CREATOR_UPDATES,
      'short updates',
    );
    const author = await knex('users')
      .select('id')
      .where({ id: authorId, status: 'active' })
      .first();
    if (!author) {
      throw new errors.NoPermissionError({
        message: 'Only active creator accounts can post updates.',
      });
    }

    const now = new Date();
    const update = {
      id: id(),
      author_id: authorId,
      content: normalizedContent,
      status: 'pending',
      created_at: now,
      updated_at: now,
    };
    await knex('creator_updates').insert(update);
    return { updates: [update] };
  }

  async deleteMyUpdate(authorId, updateId) {
    const deleted = await knex('creator_updates')
      .where({ id: requireId(updateId, 'update id'), author_id: authorId, status: 'pending' })
      .update({ status: 'hidden', updated_at: new Date() });
    if (!deleted) {
      throw new errors.NotFoundError({ message: 'Pending update not found.' });
    }
  }

  async getModerationQueue() {
    const reports = await knex('community_reports as cr')
      .select(
        'cr.id',
        'cr.target_type',
        'cr.target_id',
        'cr.reason',
        'cr.details',
        'cr.status',
        'cr.created_at',
      )
      .where({ status: 'open' })
      .orderBy('cr.created_at', 'asc')
      .limit(100);

    const postIds = [
      ...new Set(
        reports.filter((item) => item.target_type === 'post').map((item) => item.target_id),
      ),
    ];
    const updateIds = [
      ...new Set(
        reports.filter((item) => item.target_type === 'update').map((item) => item.target_id),
      ),
    ];
    const [posts, updates, pendingUpdates] = await Promise.all([
      postIds.length
        ? knex('posts as p')
            .leftJoin('posts_authors as pa', function () {
              this.on('pa.post_id', '=', 'p.id').andOn('pa.sort_order', '=', knex.raw('?', [0]));
            })
            .leftJoin('users as u', 'u.id', 'pa.author_id')
            .whereIn('p.id', postIds)
            .select('p.id', 'p.title', 'p.status', 'u.name as author_name')
        : [],
      updateIds.length
        ? knex('creator_updates as cu')
            .leftJoin('users as u', 'u.id', 'cu.author_id')
            .whereIn('cu.id', updateIds)
            .select('cu.id', 'cu.content', 'cu.status', 'u.name as author_name')
        : [],
      knex('creator_updates as cu')
        .join('users as u', 'u.id', 'cu.author_id')
        .where({ 'cu.status': 'pending', 'u.status': 'active' })
        .select(
          'cu.id',
          'cu.content',
          'cu.created_at',
          'u.id as author_id',
          'u.name as author_name',
        )
        .orderBy('cu.created_at', 'asc')
        .limit(100),
    ]);

    const postById = new Map(posts.map((item) => [item.id, item]));
    const updateById = new Map(updates.map((item) => [item.id, item]));
    return {
      reports: reports.map((report) => {
        const target =
          report.target_type === 'post'
            ? postById.get(report.target_id)
            : updateById.get(report.target_id);
        return {
          ...report,
          target: target
            ? {
                id: target.id,
                title: target.title ?? null,
                content: target.content ?? null,
                status: target.status,
                author_name: target.author_name,
              }
            : {
                id: report.target_id,
                title: null,
                content: null,
                status: 'unavailable',
                author_name: null,
              },
        };
      }),
      pending_updates: pendingUpdates,
    };
  }

  async reviewReport(reportId, moderatorId, action, reviewNote) {
    if (!['dismiss', 'hide'].includes(action)) {
      throw new errors.BadRequestError({ message: 'Choose dismiss or hide for this report.' });
    }
    const report = await knex('community_reports')
      .where({ id: requireId(reportId, 'report id'), status: 'open' })
      .first();
    if (!report) {
      throw new errors.NotFoundError({ message: 'Open report not found.' });
    }

    if (action === 'hide') {
      if (report.target_type === 'post') {
        const post = await knex('posts')
          .select('id', 'status')
          .where({ id: report.target_id })
          .first();
        if (post?.status === 'published') {
          await models.Post.edit(
            { status: 'draft' },
            { id: post.id, context: { internal: true, user: moderatorId }, user: moderatorId },
          );
        }
      } else {
        await knex('creator_updates').where({ id: report.target_id }).update({
          status: 'hidden',
          moderated_by: moderatorId,
          moderated_at: new Date(),
          updated_at: new Date(),
        });
      }
    }

    await knex('community_reports')
      .where({ id: report.id })
      .update({
        status: action === 'hide' ? 'actioned' : 'dismissed',
        reviewed_by: moderatorId,
        review_note:
          typeof reviewNote === 'string' ? reviewNote.trim().slice(0, 2000) || null : null,
        reviewed_at: new Date(),
        updated_at: new Date(),
      });
    return { id: report.id, status: action === 'hide' ? 'actioned' : 'dismissed' };
  }

  async moderateUpdate(updateId, moderatorId, status) {
    if (!UPDATE_STATUSES.has(status)) {
      throw new errors.BadRequestError({
        message: 'Choose published or hidden for a creator update.',
      });
    }
    const update = await knex('creator_updates')
      .select('id', 'status')
      .where({ id: requireId(updateId, 'update id') })
      .first();
    if (!update) {
      throw new errors.NotFoundError({ message: 'Creator update not found.' });
    }
    const now = new Date();
    const count = await knex('creator_updates').where({ id: update.id }).update({
      status,
      moderated_by: moderatorId,
      moderated_at: now,
      updated_at: now,
    });
    logging.info(
      `[Community] Creator update ${update.id} changed from ${update.status} to ${status} by ${moderatorId}`,
    );
    return { id: update.id, status, count };
  }

  async getCreatorAnalytics(authorId) {
    const allPosts = knex('posts as p')
      .join('posts_authors as pa', 'pa.post_id', 'p.id')
      .where('pa.author_id', authorId)
      .andWhere({ 'p.type': 'post', 'p.status': 'published' });
    const publishedCount = await countQuery(allPosts.clone());

    const posts = await knex('posts as p')
      .join('posts_authors as pa', 'pa.post_id', 'p.id')
      .where('pa.author_id', authorId)
      .andWhere({ 'p.type': 'post', 'p.status': 'published' })
      .select('p.id', 'p.uuid', 'p.title', 'p.published_at')
      .orderBy('p.published_at', 'desc')
      .limit(25);

    const followerCount = await countQuery(
      knex('reader_author_follows').where({ author_id: authorId }),
    );
    const ownPostIds = posts.map((post) => post.id);
    const [reactionCounts, bookmarkCounts] = ownPostIds.length
      ? await Promise.all([
          knex('article_reactions')
            .select('post_id')
            .count({ count: '*' })
            .whereIn('post_id', ownPostIds)
            .groupBy('post_id'),
          knex('article_bookmarks')
            .select('post_id')
            .count({ count: '*' })
            .whereIn('post_id', ownPostIds)
            .groupBy('post_id'),
        ])
      : [[], []];

    const visitorResponse = statsService.api?.getPostsVisitorCounts
      ? await statsService.api.getPostsVisitorCounts(posts.map((post) => post.uuid))
      : {};
    const visitors = visitorResponse?.data?.visitor_counts ?? {};
    const signups = statsService.api?.getPostsMemberCounts
      ? await statsService.api.getPostsMemberCounts(ownPostIds)
      : {};
    const reactionsByPost = new Map(
      reactionCounts.map((row) => [row.post_id, asNumber(row.count)]),
    );
    const bookmarksByPost = new Map(
      bookmarkCounts.map((row) => [row.post_id, asNumber(row.count)]),
    );
    const recentPosts = posts.slice(0, 5);
    const sources = statsService.api?.getReferrersForPost
      ? (
          await Promise.all(
            recentPosts.map(async (post) => {
              try {
                const result = await statsService.api.getReferrersForPost(post.id, { limit: 3 });
                return (result?.data ?? []).map((source) => ({
                  post_id: post.id,
                  source: source.source,
                  free_members: asNumber(source.free_members),
                  paid_members: asNumber(source.paid_members),
                  post_title: post.title,
                }));
              } catch (error) {
                logging.error(
                  `[Community] Could not load referral sources for creator post ${post.id}`,
                  error,
                );
                return [];
              }
            }),
          )
        ).flat()
      : [];

    const articleStats = posts.map((post) => ({
      id: post.id,
      title: post.title,
      published_at: post.published_at,
      reads: asNumber(visitors[post.uuid]),
      signups: asNumber(signups[post.id]?.free_members) + asNumber(signups[post.id]?.paid_members),
      reactions: reactionsByPost.get(post.id) ?? 0,
      bookmarks: bookmarksByPost.get(post.id) ?? 0,
    }));

    return {
      analytics: {
        published_articles: publishedCount,
        followers: followerCount,
        reads: articleStats.reduce((total, post) => total + post.reads, 0),
        member_signups: articleStats.reduce((total, post) => total + post.signups, 0),
        reactions: articleStats.reduce((total, post) => total + post.reactions, 0),
        bookmarks: articleStats.reduce((total, post) => total + post.bookmarks, 0),
        reads_available: Boolean(statsService.api?.posts?.tinybirdClient),
        articles: articleStats,
        reader_sources: sources,
      },
    };
  }
}

module.exports = new CommunityService();
