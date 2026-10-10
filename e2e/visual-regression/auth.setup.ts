import { expect, test as setup } from '@playwright/test';

/**
 * Authenticates once against the running Reedito instance and saves
 * the session to a storage-state file so all visual-regression specs
 * can reuse it without logging in again.
 *
 * Expects the default Reedito development credentials:
 *   Email:    reedito-author@example.com
 *   Password: Sl1m3rson99
 */
const AUTH_FILE = './e2e/visual-regression/.auth/state.json';

setup('authenticate', async ({ page }) => {
  const email = process.env.REEDITO_ADMIN_EMAIL || 'reedito-author@example.com';
  const password = process.env.REEDITO_ADMIN_PASSWORD || 'Sl1m3rson99';

  await page.goto('/reedito/#/signin');
  await page.waitForLoadState('load');

  await page.getByRole('textbox', { name: 'Email address' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: /Sign in/ }).click();

  // Wait for the admin to fully load (sidebar with navigation links)
  await expect(page.getByRole('link', { name: 'Posts' })).toBeVisible({ timeout: 30_000 });

  await page.context().storageState({ path: AUTH_FILE });
});
