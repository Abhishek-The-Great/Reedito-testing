import { expect, test } from '@/helpers/playwright';

test.describe('Reedito Admin - Deep-link redirects', () => {
  test('redirects /reedito/<path> to /reedito/#/<path> with no trailing slash', async ({
    reeditoInstance,
    playwright,
  }) => {
    const request = await playwright.request.newContext({ baseURL: reeditoInstance.baseUrl });

    try {
      const response = await request.fetch('/reedito/members/import', { maxRedirects: 0 });

      expect(response.status()).toBe(302);
      expect(response.headers().location).toBe('/reedito/#/members/import');
    } finally {
      await request.dispose();
    }
  });
});
