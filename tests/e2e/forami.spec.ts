import { expect, test } from '@playwright/test';
import type { FormamiTracker } from '../../src/tracker';
import { authHeaders, loginPage, loginViaApi } from './helpers';

test.beforeEach(async ({ baseURL }) => {
  expect(baseURL, 'Formami smoke tests must only target the isolated local instance').toBe(
    'http://127.0.0.1:3035',
  );
});

test('Formami branding is usable on desktop, dark theme and mobile', async ({ page }) => {
  await page.goto('/login');
  await expect(page).toHaveTitle('Login | Formami');
  await expect(page.getByRole('heading', { name: 'Formami', exact: true })).toBeVisible();
  await expect(page.getByText('SEE THE FOREST', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/forami-login-light.png', fullPage: true });
  await page.evaluate(() => localStorage.setItem('theme', 'dark'));
  await page.reload();
  await expect(page.locator('[data-theme="dark"]').first()).toBeAttached();
  await expect(page.getByRole('heading', { name: 'Formami', exact: true })).toBeVisible();
  await expect(page.getByTestId('button-submit')).toBeVisible();
  await page.screenshot({ path: 'test-results/forami-login-dark.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('button-submit')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/forami-login-mobile.png', fullPage: true });
});

test('existing Tracker API records a pageview, identity and event in Formami', async ({
  page,
  request,
}) => {
  const auth = await loginViaApi(request);
  const created = await request.post('/api/websites', {
    headers: authHeaders(auth),
    data: { name: 'Formami local smoke', domain: 'localhost' },
  });
  expect(created.status()).toBe(200);
  const { id } = await created.json();
  try {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/forami-local-smoke', route =>
      route.fulfill({
        contentType: 'text/html',
        body: `<html><head><title>Local test product</title><script defer src="/script.js" data-website-id="${id}"></script></head><body>Local product fixture</body></html>`,
      }),
    );
    const pageview = page.waitForResponse(response => response.url().endsWith('/api/send'));
    await page.goto('/forami-local-smoke');
    expect((await pageview).status()).toBe(200);
    await page.evaluate(async () => {
      const tracker = (window as unknown as { formami: FormamiTracker }).formami;
      await tracker.identify('forami-local-subject', { plan: 'test' });
      await tracker.track('feature_used', { feature: 'local_smoke' });
    });
    const endAt = Date.now() + 60_000;
    const startAt = endAt - 3_600_000;
    const query = `startAt=${startAt}&endAt=${endAt}`;
    await expect
      .poll(async () => {
        const response = await request.get(`/api/websites/${id}/events?${query}`, {
          headers: authHeaders(auth),
        });
        expect(response.status()).toBe(200);
        return JSON.stringify(await response.json());
      })
      .toContain('feature_used');
    const sessions = await request.get(`/api/websites/${id}/sessions?${query}`, {
      headers: authHeaders(auth),
    });
    expect(sessions.status()).toBe(200);
    const sessionRows = await sessions.json();
    expect(sessionRows.data).toHaveLength(1);
    const session = await request.get(`/api/websites/${id}/sessions/${sessionRows.data[0].id}`, {
      headers: authHeaders(auth),
    });
    expect(session.status()).toBe(200);
    expect((await session.json()).distinctIds).toContain('forami-local-subject');
    const stats = await request.get(`/api/websites/${id}/stats?${query}`, {
      headers: authHeaders(auth),
    });
    expect(stats.status()).toBe(200);
    expect((await stats.json()).pageviews).toBeGreaterThanOrEqual(1);
    expect(errors).toEqual([]);
    await loginPage(page, request);
    await page.goto(`/websites/${id}`);
    await expect(page).toHaveTitle(/Formami/);
    await expect(page.getByText('Formami local smoke', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Views', { exact: true }).first()).toBeVisible();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/forami-dashboard.png', fullPage: true });
  } finally {
    const removed = await request.delete(`/api/websites/${id}`, { headers: authHeaders(auth) });
    expect(removed.status()).toBe(200);
  }
});
