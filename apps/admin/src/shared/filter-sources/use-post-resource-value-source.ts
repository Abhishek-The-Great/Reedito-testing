import {
  type Page,
  type PagesResponseType,
  useBrowsePagesInfinite,
} from '@reedito/admin-x-framework/api/pages';
import {
  type Post,
  type PostsResponseType,
  useBrowsePostsInfinite,
} from '@reedito/admin-x-framework/api/posts';
import { type ValueSource } from '@reedito/shade/patterns';
import { createCombinedValueSource } from './create-combined-value-source';
import { createReeditoBrowseValueSource } from './create-reedito-browse-value-source';
import { escapeNqlString } from '@reedito/nql-string';
import { keepPreviousData } from '@tanstack/react-query';

function buildPublishedFilter(query: string) {
  return query ? `status:published+title:~${escapeNqlString(query)}` : 'status:published';
}

function toPostOption(post: Post) {
  return {
    value: post.id,
    label: post.title,
  };
}

function toPageOption(page: Page) {
  return {
    value: page.id,
    label: page.title,
    detail: 'Page',
  };
}

const buildPublishedSearchParams = (query: string) => ({
  filter: buildPublishedFilter(query),
  limit: '25',
  fields: 'id,title',
  order: 'published_at DESC',
});

const buildHydrateSearchParams = (selectedFilter: string) => ({
  fields: 'id,title',
  filter: selectedFilter,
});

const usePublishedPostValueSource = createReeditoBrowseValueSource<Post, PostsResponseType>({
  id: 'posts.published.remote',
  buildBrowseSearchParams: buildPublishedSearchParams,
  buildHydrateSearchParams,
  selectItems: (data) => data?.posts,
  useQuery: ({ enabled, searchParams }) => {
    return useBrowsePostsInfinite({
      enabled,
      placeholderData: keepPreviousData,
      searchParams,
    });
  },
  toOption: toPostOption,
});

const usePublishedPageValueSource = createReeditoBrowseValueSource<Page, PagesResponseType>({
  id: 'pages.published.remote',
  buildBrowseSearchParams: buildPublishedSearchParams,
  buildHydrateSearchParams,
  selectItems: (data) => data?.pages,
  useQuery: ({ enabled, searchParams }) => {
    return useBrowsePagesInfinite({
      enabled,
      placeholderData: keepPreviousData,
      searchParams,
    });
  },
  toOption: toPageOption,
});

const useCombinedPostResourceValueSource = createCombinedValueSource(
  usePublishedPostValueSource,
  usePublishedPageValueSource,
  (value) => ({
    value,
    label: `ID: ${value}`,
  }),
);

export function usePostResourceValueSource(): ValueSource<string> {
  return useCombinedPostResourceValueSource();
}
