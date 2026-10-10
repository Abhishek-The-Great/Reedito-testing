import { faker } from '@faker-js/faker';
import { createBuilder } from '../factory';
import { generateSlug } from '../utils';

/**
 * Raw entry shape expected by the optional Reedito changelog feed: snake_case,
 * `featured` is a "true"/"false" string, and `published_at` is ISO.
 *
 * A type alias (not an interface) so it gets an implicit index signature and
 * stays assignable to zod loose-object input types in consumers.
 */
export type ChangelogEntry = {
  slug: string;
  title: string;
  custom_excerpt: string | null;
  url: string;
  published_at: string;
  featured: 'true' | 'false';
  feature_image?: string;
  html?: string;
};

export const changelogEntry = createBuilder<ChangelogEntry>(() => {
  const title = `${faker.commerce.productAdjective()} ${faker.commerce.productName()}`;
  const slug = `${generateSlug(title)}-${faker.string.alphanumeric(6).toLowerCase()}`;

  return {
    slug,
    title,
    custom_excerpt: faker.lorem.sentence(),
    url: `https://updates.reedito.test/changelog/${slug}/`,
    published_at: new Date().toISOString(),
    featured: 'false',
  };
});
