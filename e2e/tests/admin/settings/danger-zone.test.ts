import { SettingsPage } from '@/admin-pages';
import { expect, test } from '@/helpers/playwright';
import { usePerTestIsolation } from '@/helpers/playwright/isolation';

usePerTestIsolation();

interface ApiKey {
  type: string;
  secret: string;
}

interface Integration {
  slug: string;
  api_keys: ApiKey[];
}

async function snapshotApiKeys(
  page: SettingsPage['page'],
  baseURL: string,
): Promise<Array<{ slug: string; type: string; secret: string }>> {
  const response = await page.request.get(
    `${baseURL}/reedito/api/admin/integrations/?include=api_keys`,
  );
  expect(response.ok(), 'integrations list returns 2xx').toBe(true);
  const body = (await response.json()) as { integrations: Integration[] };
  return body.integrations
    .flatMap((i) => i.api_keys.map((k) => ({ slug: i.slug, type: k.type, secret: k.secret })))
    .sort((a, b) => `${a.slug}|${a.type}`.localeCompare(`${b.slug}|${b.type}`));
}

test.describe('Reedito Admin - Danger Zone security actions', () => {
  test('reset all authentication - rotates every visible key, locks owner, kills session', async ({
    page,
    reeditoAccountOwner,
    baseURL,
  }) => {
    const url = baseURL ?? '';
    const settingsPage = new SettingsPage(page);
    await settingsPage.dangerZoneSection.goto();

    const preKeys = await snapshotApiKeys(page, url);
    expect(preKeys.length, 'integrations expose at least one key pre-rotation').toBeGreaterThan(0);

    const preContentKey = preKeys.find((k) => k.type === 'content')?.secret;
    expect(preContentKey, 'a content key exists pre-rotation').toBeTruthy();
    const preContentResponse = await page.request.get(
      `${url}/reedito/api/content/posts/?key=${preContentKey}&limit=1`,
    );
    expect(preContentResponse.status(), 'pre-rotation content key works').toBe(200);

    await settingsPage.dangerZoneSection.openResetAuthModal();
    await settingsPage.dangerZoneSection.resetAuthOkButton.click();

    await page.waitForURL(/\/reedito\/(#\/)?signin\/?/, { timeout: 15000 });

    // Old credentials must now be rejected — the owner is locked.
    const loginResponse = await page.request.post(`${url}/reedito/api/admin/session/`, {
      // secretlint-disable-next-line @secretlint/secretlint-rule-pattern
      data: { username: reeditoAccountOwner.email, password: reeditoAccountOwner.password },
      headers: { Origin: url },
    });
    expect([401, 403, 422], 'locked user login attempt is rejected').toContain(
      loginResponse.status(),
    );

    // Old content key must now be rejected — every api_keys.secret rotated.
    const oldKeyResponse = await page.request.get(
      `${url}/reedito/api/content/posts/?key=${preContentKey}&limit=1`,
    );
    expect(oldKeyResponse.status(), 'pre-rotation content key is rejected').toBe(401);
  });
});
