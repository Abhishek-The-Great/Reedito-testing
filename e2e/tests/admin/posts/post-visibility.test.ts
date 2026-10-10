import { PostPage } from '@/helpers/pages';
import { buildLexicalParagraph, createPostFactory } from '@/data-factory';
import { expect, test } from '@/helpers/playwright';

test.describe('Reedito Admin - Post Visibility', () => {
  test('members-only post shows subscriber gate', async ({ page }) => {
    const title = `members-only-post-${Date.now()}`;
    const body = 'This is my members-only post body.';

    const postFactory = createPostFactory(page.request);
    const post = await postFactory.create({
      title,
      status: 'published',
      visibility: 'members',
      lexical: buildLexicalParagraph(body),
    });

    const publicPage = new PostPage(page);
    await publicPage.gotoPost(post.slug);
    await expect(publicPage.accessCtaHeading).toHaveText('This post is for subscribers only');
  });

  test('paid-members-only post shows paid subscriber gate', async ({ page }) => {
    const title = `paid-members-only-post-${Date.now()}`;
    const body = 'This is my paid-members-only post body.';

    const postFactory = createPostFactory(page.request);
    const post = await postFactory.create({
      title,
      status: 'published',
      visibility: 'paid',
      lexical: buildLexicalParagraph(body),
    });

    const publicPage = new PostPage(page);
    await publicPage.gotoPost(post.slug);
    await expect(publicPage.accessCtaHeading).toHaveText(
      'This post is for paying subscribers only',
    );
  });
});
