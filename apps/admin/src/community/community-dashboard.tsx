import { useCallback, useEffect, useState } from 'react';
import { apiUrl } from '@reedito/admin-x-framework/helpers';
import { useFetchApi } from '@reedito/admin-x-framework/hooks';
import { useCurrentUser } from '@reedito/admin-x-framework/api/current-user';
import { hasAdminAccess } from '@reedito/admin-x-framework/api/users';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Textarea,
} from '@reedito/shade/components';
import { Grid, Inline, Stack, Text } from '@reedito/shade/primitives';
import { PageHeader } from '@reedito/shade/patterns';
import { LucideIcon } from '@reedito/shade/utils';

interface CreatorUpdate {
  id: string;
  content: string;
  status: 'pending' | 'published' | 'hidden';
  created_at: string;
  author_name?: string;
}

interface CommunityReport {
  id: string;
  target_type: 'post' | 'update';
  target_id: string;
  reason: string;
  details: string | null;
  created_at: string;
  target: {
    title: string | null;
    content: string | null;
    status: string;
    author_name: string | null;
  };
}

interface Analytics {
  published_articles: number;
  followers: number;
  reads: number;
  member_signups: number;
  reactions: number;
  bookmarks: number;
  reads_available: boolean;
  articles: Array<{
    id: string;
    title: string;
    published_at: string;
    reads: number;
    signups: number;
    reactions: number;
    bookmarks: number;
  }>;
  reader_sources: Array<{
    post_id: string;
    source: string;
    free_members: number;
    paid_members: number;
    post_title: string;
  }>;
}

interface CommunityResponse {
  updates?: CreatorUpdate[];
  reports?: CommunityReport[];
  pending_updates?: CreatorUpdate[];
  analytics?: Analytics;
}

const requestOptions = { retry: false };

export default function CommunityDashboard() {
  const fetchApi = useFetchApi();
  const { data: currentUser } = useCurrentUser();
  const canModerate = Boolean(currentUser && hasAdminAccess(currentUser));
  const [updates, setUpdates] = useState<CreatorUpdate[]>([]);
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [pendingUpdates, setPendingUpdates] = useState<CreatorUpdate[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [own, stats, moderation] = await Promise.all([
        fetchApi<CommunityResponse>(apiUrl('/community/updates/'), requestOptions),
        fetchApi<CommunityResponse>(apiUrl('/community/analytics/'), requestOptions),
        canModerate
          ? fetchApi<CommunityResponse>(apiUrl('/community/moderation/'), requestOptions)
          : Promise.resolve<CommunityResponse>({}),
      ]);
      setUpdates(own.updates ?? []);
      setAnalytics(stats.analytics ?? null);
      setReports(moderation.reports ?? []);
      setPendingUpdates(moderation.pending_updates ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load community data.');
    } finally {
      setLoading(false);
    }
  }, [canModerate, fetchApi]);

  useEffect(() => {
    void load();
  }, [load]);

  const createUpdate = async () => {
    const normalized = content.trim();
    if (!normalized) {
      setError('Write a short update before submitting it.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await fetchApi<CommunityResponse>(apiUrl('/community/updates/'), {
        method: 'POST',
        body: JSON.stringify({ content: normalized }),
        retry: false,
      });
      setContent('');
      setNotice('Your update was sent to the moderation queue.');
      await load();
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : 'Could not submit your update.',
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteUpdate = async (id: string) => {
    try {
      await fetchApi(apiUrl(`/community/updates/${encodeURIComponent(id)}/`), {
        method: 'DELETE',
        retry: false,
      });
      await load();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : 'Could not delete this update.',
      );
    }
  };

  const reviewReport = async (report: CommunityReport, action: 'dismiss' | 'hide') => {
    try {
      await fetchApi(apiUrl(`/community/reports/${encodeURIComponent(report.id)}/`), {
        method: 'PUT',
        body: JSON.stringify({ action }),
        retry: false,
      });
      await load();
    } catch (reviewError) {
      setError(
        reviewError instanceof Error ? reviewError.message : 'Could not review this report.',
      );
    }
  };

  const moderateUpdate = async (update: CreatorUpdate, status: 'published' | 'hidden') => {
    try {
      await fetchApi(apiUrl(`/community/updates/${encodeURIComponent(update.id)}/moderate/`), {
        method: 'PUT',
        body: JSON.stringify({ status }),
        retry: false,
      });
      await load();
    } catch (reviewError) {
      setError(
        reviewError instanceof Error ? reviewError.message : 'Could not moderate this update.',
      );
    }
  };

  return (
    <Stack className="mx-auto w-full max-w-6xl px-6 py-8" gap="lg">
      <PageHeader blurredBackground={false} sticky={false}>
        <PageHeader.Left>
          <PageHeader.Title>
            Community
            <PageHeader.Description>
              Writer updates, creator analytics, and moderation.
            </PageHeader.Description>
          </PageHeader.Title>
        </PageHeader.Left>
        <PageHeader.Actions>
          <Button disabled={loading} variant="outline" onClick={() => void load()}>
            <LucideIcon.RefreshCw /> Refresh
          </Button>
        </PageHeader.Actions>
      </PageHeader>

      {error && (
        <div
          className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-md border border-border-default bg-card p-3 text-sm" role="status">
          {notice}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Share a short update</CardTitle>
          <CardDescription>
            Updates are limited to 500 characters and reviewed before they appear in the reader
            feed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Stack gap="sm">
            <Textarea
              aria-label="Your update"
              maxLength={500}
              placeholder="Share a question, note, or announcement…"
              rows={4}
              value={content}
              onChange={(event) => setContent(event.target.value)}
            />
            <Inline align="center" gap="sm" justify="between">
              <Text size="sm" tone="secondary">
                {content.length}/500 · up to 5 per hour
              </Text>
              <Button disabled={saving || !content.trim()} onClick={() => void createUpdate()}>
                {saving ? 'Submitting…' : 'Submit for review'}
              </Button>
            </Inline>
          </Stack>
        </CardContent>
      </Card>

      <section aria-label="Creator analytics">
        <h2 className="mb-3 text-lg font-semibold">Your creator analytics</h2>
        {analytics ? (
          <Grid className="lg:grid-cols-5" columns={2} gap="sm">
            <Metric title="Published articles" value={analytics.published_articles} />
            <Metric title="Followers" value={analytics.followers} />
            <Metric
              detail={!analytics.reads_available ? 'Web analytics is not configured' : undefined}
              title="Reads"
              value={analytics.reads}
            />
            <Metric title="Member sign-ups" value={analytics.member_signups} />
            <Metric
              title="Reactions · saved"
              value={`${analytics.reactions} · ${analytics.bookmarks}`}
            />
          </Grid>
        ) : (
          <Text size="sm" tone="secondary">
            {loading ? 'Loading analytics…' : 'No analytics are available yet.'}
          </Text>
        )}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Your short updates</CardTitle>
          <CardDescription>Only you can see your own draft and review status.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Text size="sm" tone="secondary">
              Loading…
            </Text>
          ) : updates.length ? (
            <Stack gap="sm">
              {updates.map((update) => (
                <div key={update.id} className="rounded-md border border-border-default p-3">
                  <Inline align="start" gap="md" justify="between">
                    <Stack className="min-w-0" gap="xs">
                      <Text>{update.content}</Text>
                      <Text size="sm" tone="secondary">
                        {update.status} · {new Date(update.created_at).toLocaleString()}
                      </Text>
                    </Stack>
                    {update.status === 'pending' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void deleteUpdate(update.id)}
                      >
                        Delete
                      </Button>
                    )}
                  </Inline>
                </div>
              ))}
            </Stack>
          ) : (
            <Text size="sm" tone="secondary">
              You have not submitted an update yet.
            </Text>
          )}
        </CardContent>
      </Card>

      {analytics?.articles.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Article performance</CardTitle>
            <CardDescription>
              Totals and article rows cover your newest {analytics.articles.length} published
              articles. Referral sources include the five newest published articles.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border-default text-muted-foreground">
                    <th className="py-2 pr-4">Article</th>
                    <th className="py-2 pr-4">Reads</th>
                    <th className="py-2 pr-4">Sign-ups</th>
                    <th className="py-2 pr-4">Reactions</th>
                    <th className="py-2">Saved</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.articles.map((article) => (
                    <tr key={article.id} className="border-b border-border-default last:border-0">
                      <td className="py-2 pr-4">{article.title}</td>
                      <td className="py-2 pr-4">{article.reads}</td>
                      <td className="py-2 pr-4">{article.signups}</td>
                      <td className="py-2 pr-4">{article.reactions}</td>
                      <td className="py-2">{article.bookmarks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!!analytics.reader_sources.length && (
              <Stack className="mt-5" gap="sm">
                <Text weight="semibold">Reader sources</Text>
                {analytics.reader_sources.map((source) => (
                  <Text key={`${source.post_id}-${source.source}`} size="sm">
                    {source.post_title}: {source.source} ·{' '}
                    {source.free_members + source.paid_members} sign-ups
                  </Text>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>
      ) : null}

      {canModerate && (
        <section aria-label="Community moderation" className="space-y-4">
          <h2 className="text-lg font-semibold">Moderation queue</h2>
          <Card>
            <CardHeader>
              <CardTitle>Reported content</CardTitle>
              <CardDescription>
                Hide an article to return it to drafts, or hide a creator update. Dismiss a report
                to keep its content available.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {reports.length ? (
                <Stack gap="sm">
                  {reports.map((report) => (
                    <div key={report.id} className="rounded-md border border-border-default p-3">
                      <Stack gap="sm">
                        <Text weight="semibold">
                          {report.target.title ||
                            report.target.content ||
                            'Reported item no longer exists'}
                        </Text>
                        <Text size="sm" tone="secondary">
                          {report.target_type} · {report.target.author_name || 'Unknown creator'} ·{' '}
                          {report.reason}
                          {report.details ? ` · ${report.details}` : ''}
                        </Text>
                        <Inline gap="sm">
                          <Button
                            variant="destructive"
                            onClick={() => void reviewReport(report, 'hide')}
                          >
                            Hide content
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => void reviewReport(report, 'dismiss')}
                          >
                            Dismiss report
                          </Button>
                        </Inline>
                      </Stack>
                    </div>
                  ))}
                </Stack>
              ) : (
                <Text size="sm" tone="secondary">
                  No open reports.
                </Text>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Creator updates awaiting review</CardTitle>
              <CardDescription>
                Approve an update to show it in the reader feed, or hide it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingUpdates.length ? (
                <Stack gap="sm">
                  {pendingUpdates.map((update) => (
                    <div key={update.id} className="rounded-md border border-border-default p-3">
                      <Stack gap="sm">
                        <Text>{update.content}</Text>
                        <Text size="sm" tone="secondary">
                          {update.author_name} · {new Date(update.created_at).toLocaleString()}
                        </Text>
                        <Inline gap="sm">
                          <Button onClick={() => void moderateUpdate(update, 'published')}>
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => void moderateUpdate(update, 'hidden')}
                          >
                            Hide
                          </Button>
                        </Inline>
                      </Stack>
                    </div>
                  ))}
                </Stack>
              ) : (
                <Text size="sm" tone="secondary">
                  No updates are waiting for review.
                </Text>
              )}
            </CardContent>
          </Card>
        </section>
      )}
    </Stack>
  );
}

function Metric({
  title,
  value,
  detail,
}: {
  title: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <Text size="sm" tone="secondary">
          {title}
        </Text>
        <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
        {detail && (
          <Text size="xs" tone="secondary">
            {detail}
          </Text>
        )}
      </CardContent>
    </Card>
  );
}
