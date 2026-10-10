import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { isoDatetimeToDate } from '@/schemas/primitives';

const ChangelogEntrySchema = z
  .looseObject({
    slug: z.string(),
    title: z.string(),
    custom_excerpt: z.string().nullish(),
    url: z.string().url(),
    published_at: isoDatetimeToDate,
    featured: z.stringbool(),
    feature_image: z.string().url().nullish(),
    html: z.string().nullish(),
  })
  .transform((data) => ({
    slug: data.slug,
    title: data.title,
    customExcerpt: data.custom_excerpt,
    url: data.url,
    publishedAt: data.published_at,
    featured: data.featured,
    featureImage: data.feature_image,
    html: data.html,
  }));

export type RawChangelogEntry = z.input<typeof ChangelogEntrySchema>;
export type ChangelogEntry = z.output<typeof ChangelogEntrySchema>;

export const ChangelogResponseSchema = z
  .object({
    posts: z.array(ChangelogEntrySchema).default([]),
    changelogUrl: z.string().url().or(z.literal('')).default(''),
  })
  .transform((data) => ({
    entries: data.posts,
    changelogUrl: data.changelogUrl,
  }));

export type RawChangelogResponse = z.input<typeof ChangelogResponseSchema>;
export type ChangelogResponse = z.output<typeof ChangelogResponseSchema>;

const CHANGELOG_API_URL = import.meta.env.REEDITO_CHANGELOG_URL;

export const useChangelog = () =>
  useQuery({
    queryKey: ['changelog'],
    queryFn: async () => {
      if (!CHANGELOG_API_URL) {
        return ChangelogResponseSchema.parse({});
      }

      // eslint-disable-next-line no-restricted-syntax -- optional external changelog endpoint, not the Admin API
      const response = await fetch(CHANGELOG_API_URL);

      if (!response.ok) {
        throw new Error(`Failed to fetch changelog: ${response.status}`);
      }

      const data = (await response.json()) as unknown;

      return ChangelogResponseSchema.parse(data);
    },
    staleTime: Infinity,
  });
