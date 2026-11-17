import { existsSync } from 'node:fs';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { GET } from './route';
import { pageLinksResponseSchema } from './schema';

const mocks = vi.hoisted(() => ({
  auth: { user: { id: 'user' } } as any,
  canView: vi.fn(),
  website: vi.fn(),
}));
vi.mock('@/lib/request', () => ({
  parseRequest: async (request: Request, schema: any) => {
    const result = schema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    return {
      auth: mocks.auth,
      query: result.data,
      error: !mocks.auth
        ? () => new Response(null, { status: 401 })
        : !result.success
          ? () => new Response(null, { status: 400 })
          : null,
    };
  },
}));
vi.mock('@/permissions', () => ({ canViewWebsite: mocks.canView }));
vi.mock('@/queries/prisma/website', () => ({ getWebsite: mocks.website }));

const websiteId = '00000000-0000-4000-8000-000000000001';
const get = (query = '', id = websiteId) =>
  GET(new Request(`https://untrusted-host.invalid/api/websites/${id}/page-links${query}`), {
    params: Promise.resolve({ websiteId: id }),
  });
beforeEach(() => {
  mocks.auth = { user: { id: 'user' } };
  mocks.canView.mockReset().mockResolvedValue(true);
  mocks.website.mockReset().mockResolvedValue({ id: websiteId, domain: 'example.com' });
});
afterEach(() => vi.unstubAllEnvs());

test('returns documented links to existing pages without trusting the Host header', async () => {
  const response = await get();
  const body = pageLinksResponseSchema.parse(await response.json());
  expect(response.status).toBe(200);
  expect(body.requiresLogin).toBe(true);
  expect(body.queryApplied).toBe(false);
  expect(body.trackedPage).toBeNull();
  for (const { id, path } of body.pages) {
    expect(path).toBe(`/websites/${websiteId}${id === 'overview' ? '' : `/${id}`}`);
    const root = 'src/app/(main)/websites/[websiteId]';
    expect(
      existsSync(`${root}${id === 'overview' ? '' : `/${id}`}/page.tsx`) ||
        existsSync(`${root}/(reports)/${id}/page.tsx`),
    ).toBe(true);
  }
});
test('preserves BASE_PATH and resolves tracked URLs from configured origins', async () => {
  vi.stubEnv('BASE_PATH', '/analytics/');
  mocks.website.mockResolvedValue({ domain: 'old.example', pageOrigins: 'https://docs.example' });
  const body = await (await get('?pagePath=%2Fguide')).json();
  expect(body.pages[0].path).toBe(`/analytics/websites/${websiteId}`);
  expect(body.trackedPage).toEqual({
    path: '/guide',
    urls: ['https://docs.example/guide'],
    reason: null,
  });
});
test('returns candidates for ambiguous domains and no untrusted URL', async () => {
  mocks.website.mockResolvedValue({ domain: 'example.com,docs.example.com' });
  expect((await (await get('?pagePath=%2Fguide')).json()).trackedPage).toEqual({
    path: '/guide',
    urls: ['https://example.com/guide', 'https://docs.example.com/guide'],
    reason: 'ambiguousDomain',
  });
  const body = await (await get('?pagePath=https%3A%2F%2Fevil.example%2F')).json();
  expect(body.trackedPage.urls).toEqual([]);
  expect(body.trackedPage.reason).toBe('untrustedPage');
});
test.each(['anonymous', 'share', 'other-user'])(
  'denies %s before loading website metadata',
  async mode => {
    if (mode === 'anonymous') mocks.auth = null;
    if (mode === 'share') mocks.auth = { shareToken: { websiteId } };
    if (mode === 'other-user') mocks.canView.mockResolvedValue(false);
    expect((await get()).status).toBe(mode === 'anonymous' ? 401 : 403);
    expect(mocks.website).not.toHaveBeenCalled();
  },
);
test('returns 404 for missing or deleted websites, including admin requests', async () => {
  mocks.website.mockResolvedValue(null);
  expect((await get()).status).toBe(404);
  mocks.website.mockResolvedValue({ deletedAt: new Date() });
  expect((await get()).status).toBe(404);
});
test('rejects invalid IDs and unsupported filters instead of pretending to apply them', async () => {
  expect((await get('', 'invalid')).status).toBe(400);
  expect((await get('?startAt=1&endAt=2')).status).toBe(400);
  expect((await get('?pagePath=')).status).toBe(400);
});
