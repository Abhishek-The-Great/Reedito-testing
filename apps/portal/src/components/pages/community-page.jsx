import { useCallback, useContext, useEffect, useState } from 'react';
import AppContext from '../../app-context';
import LoadingPage from './loading-page';
import { t } from '../../utils/i18n';

const reportReasons = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'misinformation', label: 'Misinformation' },
  { value: 'other', label: 'Something else' },
];

function CreatorLink({ creator }) {
  return (
    <a className="community-creator" href={creator.url}>
      {creator.profile_image ? (
        <img src={creator.profile_image} alt="" />
      ) : (
        <span className="community-avatar-fallback" />
      )}
      <span>{creator.name}</span>
    </a>
  );
}

function ReportControl({ api, type, id, onError }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('spam');
  const [details, setDetails] = useState('');
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  const submit = async () => {
    setPending(true);
    try {
      await api.community.report({ type, id, reason, details });
      setSent(true);
      setOpen(false);
    } catch (error) {
      onError(error);
    } finally {
      setPending(false);
    }
  };

  if (sent) {
    return <span className="community-muted">{t('Report sent')}</span>;
  }

  return (
    <div className="community-report-control">
      <button className="gh-portal-btn-text" type="button" onClick={() => setOpen(!open)}>
        {open ? t('Cancel report') : t('Report')}
      </button>
      {open && (
        <div className="community-report-form">
          <label>
            {t('Reason')}
            <select value={reason} onChange={(event) => setReason(event.target.value)}>
              {reportReasons.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.label)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('Details (optional)')}
            <textarea
              maxLength={2000}
              value={details}
              onChange={(event) => setDetails(event.target.value)}
            />
          </label>
          <button
            className="gh-portal-btn gh-portal-btn-primary"
            disabled={pending}
            type="button"
            onClick={submit}
          >
            {pending ? t('Sending…') : t('Send report')}
          </button>
        </div>
      )}
    </div>
  );
}

function ArticleCard({ item, api, onChange, onError }) {
  const toggleReaction = async (reaction) => {
    try {
      if (item.member_reaction === reaction) {
        await api.community.clearReaction({ id: item.id });
      } else {
        await api.community.react({ id: item.id, reaction });
      }
      onChange();
    } catch (error) {
      onError(error);
    }
  };

  const toggleBookmark = async () => {
    try {
      if (item.is_bookmarked) {
        await api.community.unbookmark({ id: item.id });
      } else {
        await api.community.bookmark({ id: item.id });
      }
      onChange();
    } catch (error) {
      onError(error);
    }
  };

  const blockCreator = async () => {
    try {
      await api.community.blockCreator({ id: item.author.id });
      await onChange();
    } catch (error) {
      onError(error);
    }
  };

  return (
    <article className="community-card">
      <div className="community-card-header">
        <CreatorLink creator={item.author} />
        <time>{new Date(item.published_at).toLocaleDateString()}</time>
      </div>
      {item.feature_image && (
        <a href={item.url}>
          <img className="community-feature-image" src={item.feature_image} alt="" />
        </a>
      )}
      <h3>
        <a href={item.url}>{item.title}</a>
      </h3>
      {item.excerpt && <p>{item.excerpt}</p>}
      {item.series && (
        <p className="community-series">
          {t('Series')}: <a href={item.series.url}>{item.series.name}</a>
        </p>
      )}
      {item.tags?.length > 0 && (
        <div className="community-tags">
          {item.tags.map((tag) => (
            <span key={tag.id}>{tag.name}</span>
          ))}
        </div>
      )}
      <div className="community-card-actions">
        <button
          className="gh-portal-btn-text"
          type="button"
          aria-pressed={item.member_reaction === 'like'}
          onClick={() => toggleReaction('like')}
        >
          {item.member_reaction === 'like' ? t('Liked') : t('Like')} · {item.reaction_count}
        </button>
        <button
          className="gh-portal-btn-text"
          type="button"
          aria-pressed={item.member_reaction === 'clap'}
          onClick={() => toggleReaction('clap')}
        >
          {item.member_reaction === 'clap' ? t('Clapped') : t('Clap')}
        </button>
        <button
          className="gh-portal-btn-text"
          type="button"
          aria-pressed={item.is_bookmarked}
          onClick={toggleBookmark}
        >
          {item.is_bookmarked ? t('Saved') : t('Save')}
        </button>
        <ReportControl api={api} type="post" id={item.id} onError={onError} />
        <button className="gh-portal-btn-text" type="button" onClick={blockCreator}>
          {t('Block creator')}
        </button>
      </div>
    </article>
  );
}

function UpdateCard({ item, api, onChange, onError }) {
  const block = async () => {
    try {
      await api.community.blockCreator({ id: item.author.id });
      await onChange();
    } catch (error) {
      onError(error);
    }
  };

  return (
    <article className="community-card community-update-card">
      <div className="community-card-header">
        <CreatorLink creator={item.author} />
        <time>{new Date(item.published_at).toLocaleDateString()}</time>
      </div>
      <p className="community-update-content">{item.content}</p>
      <div className="community-card-actions">
        <ReportControl api={api} type="update" id={item.id} onError={onError} />
        <button className="gh-portal-btn-text" type="button" onClick={block}>
          {t('Block creator')}
        </button>
      </div>
    </article>
  );
}

export default function CommunityPage() {
  const { api, member, doAction } = useContext(AppContext);
  const [tab, setTab] = useState('feed');
  const [feed, setFeed] = useState({ items: [], authors: [], topics: [] });
  const [bookmarks, setBookmarks] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [digestEnabled, setDigestEnabled] = useState(false);
  const [digestPending, setDigestPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!api?.community) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [nextFeed, nextBookmarks, nextDigest] = await Promise.all([
        api.community.feed(),
        api.community.bookmarks(),
        api.community.digestPreferences?.() ?? Promise.resolve({ enabled: false }),
      ]);
      setFeed(nextFeed);
      setBookmarks(nextBookmarks.bookmarks ?? []);
      setDigestEnabled(nextDigest.enabled === true);
      try {
        const recommendationData = await api.site.recommendations();
        setRecommendations(recommendationData.recommendations ?? []);
      } catch {
        setRecommendations([]);
      }
    } catch (loadError) {
      setError(loadError.message || t('Could not load your reader community.'));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (!member) {
      doAction('switchPage', {
        page: 'signin',
        pageData: {
          redirect: `${window.location.origin}${window.location.pathname}#/portal/community/`,
        },
      });
      return;
    }
    load();
  }, [doAction, load, member]);

  const onError = (requestError) =>
    setError(requestError.message || t('That action could not be completed.'));

  const toggleCreator = async (creator) => {
    try {
      if (creator.blocked) {
        await api.community.unblockCreator({ id: creator.id });
        setNotice(t('Creator unblocked.'));
      } else if (creator.following) {
        await api.community.unfollowCreator({ id: creator.id });
        setNotice(t('Creator unfollowed.'));
      } else {
        await api.community.followCreator({ id: creator.id });
        setNotice(t('Creator followed.'));
      }
      await load();
    } catch (requestError) {
      onError(requestError);
    }
  };

  const toggleTopic = async (topic) => {
    try {
      if (topic.following) {
        await api.community.unfollowTopic({ id: topic.id });
      } else {
        await api.community.followTopic({ id: topic.id });
      }
      await load();
    } catch (requestError) {
      onError(requestError);
    }
  };

  const toggleDigest = async (enabled) => {
    if (!api?.community?.updateDigestPreferences) {
      setError(t('Digest preferences are not available on this server version.'));
      return;
    }
    setDigestPending(true);
    setError('');
    try {
      const result = await api.community.updateDigestPreferences({ enabled });
      setDigestEnabled(result.enabled === true);
      setNotice(
        result.enabled
          ? t('Weekly creator digests are turned on.')
          : t('Weekly creator digests are turned off.'),
      );
    } catch (requestError) {
      onError(requestError);
    } finally {
      setDigestPending(false);
    }
  };

  if (!member) {
    return null;
  }

  if (loading) {
    return <LoadingPage />;
  }

  return (
    <main className="community-page">
      <header className="community-header">
        <button
          className="gh-portal-btn-text"
          type="button"
          onClick={() => doAction('switchPage', { page: 'accountHome' })}
        >
          {t('← Account')}
        </button>
        <h1 className="gh-portal-main-title">{t('Reader community')}</h1>
        <p>{t('Follow writers and topics, save articles, and catch up on creator updates.')}</p>
        <label className="community-digest-setting">
          <input
            type="checkbox"
            checked={digestEnabled}
            disabled={digestPending}
            onChange={(event) => toggleDigest(event.target.checked)}
          />
          <span>{t('Email me a weekly digest of articles from creators and topics I follow')}</span>
        </label>
      </header>

      <nav className="community-tabs" aria-label={t('Community sections')}>
        {[
          ['feed', 'Your feed'],
          ['saved', 'Saved'],
          ['explore', 'Explore'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={tab === value ? 'active' : ''}
            aria-current={tab === value ? 'page' : undefined}
            onClick={() => {
              setTab(value);
              setNotice('');
            }}
          >
            {t(label)}
          </button>
        ))}
      </nav>

      {error && (
        <div className="community-message community-error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="community-message" role="status">
          {notice}
        </div>
      )}

      {tab === 'feed' && (
        <>
          <section aria-label={t('Your feed')} className="community-feed">
            {feed.items.length ? (
              feed.items.map((item) =>
                item.type === 'article' ? (
                  <ArticleCard
                    key={`article-${item.id}`}
                    item={item}
                    api={api}
                    onChange={load}
                    onError={onError}
                  />
                ) : (
                  <UpdateCard
                    key={`update-${item.id}`}
                    item={item}
                    api={api}
                    onChange={load}
                    onError={onError}
                  />
                ),
              )
            ) : (
              <p className="community-empty">
                {t(
                  'No articles yet. Follow a creator or topic in Explore to personalize your feed.',
                )}
              </p>
            )}
          </section>
          {!!recommendations.length && (
            <section className="community-recommendations">
              <h2>{t('Recommended publications')}</h2>
              <div className="community-recommendation-list">
                {recommendations.slice(0, 6).map((publication) => (
                  <a href={publication.url} key={publication.id || publication.url}>
                    {publication.favicon && <img src={publication.favicon} alt="" />}
                    <span>{publication.title}</span>
                  </a>
                ))}
              </div>
              <button
                className="gh-portal-btn-text"
                type="button"
                onClick={() =>
                  doAction('switchPage', { page: 'recommendations', pageData: { signup: false } })
                }
              >
                {t('Browse all recommendations')}
              </button>
            </section>
          )}
        </>
      )}

      {tab === 'saved' && (
        <section className="community-feed" aria-label={t('Saved articles')}>
          {bookmarks.length ? (
            bookmarks.map((article) => (
              <article className="community-card" key={article.id}>
                <div className="community-card-header">
                  <span>{article.author.name}</span>
                  <time>{new Date(article.published_at).toLocaleDateString()}</time>
                </div>
                <h3>
                  <a href={article.url}>{article.title}</a>
                </h3>
                {article.excerpt && <p>{article.excerpt}</p>}
                {article.series && (
                  <p className="community-series">
                    {t('Series')}: <a href={article.series.url}>{article.series.name}</a>
                  </p>
                )}
                <button
                  className="gh-portal-btn-text"
                  type="button"
                  onClick={async () => {
                    try {
                      await api.community.unbookmark({ id: article.id });
                      await load();
                    } catch (requestError) {
                      onError(requestError);
                    }
                  }}
                >
                  {t('Remove saved article')}
                </button>
              </article>
            ))
          ) : (
            <p className="community-empty">{t('Articles you save will appear here.')}</p>
          )}
        </section>
      )}

      {tab === 'explore' && (
        <div className="community-explore">
          <section>
            <h2>{t('Writers')}</h2>
            {feed.authors.map((creator) => (
              <div className="community-explore-item" key={creator.id}>
                <CreatorLink creator={creator} />
                <span className="community-muted">
                  {creator.article_count} {t('articles')}
                </span>
                <button
                  className="gh-portal-btn-text"
                  type="button"
                  onClick={() => toggleCreator(creator)}
                >
                  {creator.blocked
                    ? t('Unblock')
                    : creator.following
                      ? t('Following')
                      : t('Follow')}
                </button>
              </div>
            ))}
          </section>
          <section>
            <h2>{t('Topics')}</h2>
            {feed.topics.map((topic) => (
              <div className="community-explore-item" key={topic.id}>
                <span>{topic.name}</span>
                <span className="community-muted">
                  {topic.article_count} {t('articles')}
                </span>
                <button
                  className="gh-portal-btn-text"
                  type="button"
                  onClick={() => toggleTopic(topic)}
                >
                  {topic.following ? t('Following') : t('Follow')}
                </button>
              </div>
            ))}
          </section>
        </div>
      )}
    </main>
  );
}
