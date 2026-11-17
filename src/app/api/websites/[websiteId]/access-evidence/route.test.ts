import { beforeEach, describe, expect, test, vi } from 'vitest';
import { GET, POST } from './route';
import { accessQuerySchema } from './schema';

const mocks = vi.hoisted(() => ({
  auth: { user: { id: 'reporter' } } as any,
  canWrite: true,
  canRead: true,
  save: vi.fn(),
  get: vi.fn(),
}));
vi.mock('@/lib/request', () => ({
  parseRequest: async (request: Request, schema?: any) => {
    const result = schema?.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    return {
      auth: mocks.auth,
      query: result?.data,
      error: !mocks.auth
        ? () => new Response(null, { status: 401 })
        : result && !result.success
          ? () => new Response(null, { status: 400 })
          : undefined,
    };
  },
}));
vi.mock('@/permissions', () => ({
  canUpdateWebsite: async () => mocks.canWrite,
  canViewWebsiteSection: async () => mocks.canRead,
}));
vi.mock('@/queries/prisma/accessEvidence', () => ({
  saveAccessEvidence: mocks.save,
  getAccessEvidence: mocks.get,
}));
const context = { params: Promise.resolve({ websiteId: 'website' }) };
const observation = {
  id: '00000000-0000-4000-8000-000000000001',
  occurredAt: new Date().toISOString(),
  consent: 'granted',
  source: 'server',
  kind: 'fetch',
  contentKey: 'guide',
};
const post = (data: any) =>
  POST(
    new Request('http://localhost/api/websites/website/access-evidence', {
      method: 'POST',
      body: typeof data === 'string' ? data : JSON.stringify(data),
    }),
    context,
  );
beforeEach(() => {
  mocks.auth = { user: { id: 'reporter' } };
  mocks.canWrite = true;
  mocks.canRead = true;
  mocks.save.mockReset().mockResolvedValue({ count: 1 });
  mocks.get.mockReset().mockResolvedValue({ groups: [] });
  vi.stubEnv('FORMAMI_ACCESS_CONTENT_KEYS', 'guide');
});
describe('access evidence API', () => {
  test('deduplicates without overwriting existing evidence', async () => {
    mocks.save.mockResolvedValue({ count: 0 });
    const response = await post({ observations: [observation] });
    expect(await response.json()).toEqual({ accepted: 0, duplicates: 1 });
    expect(mocks.save).toHaveBeenCalledWith('website', expect.any(Array));
  });
  test.each(['anonymous', 'share', 'reader'])('rejects %s ingestion', async mode => {
    if (mode === 'anonymous') mocks.auth = null;
    if (mode === 'share') mocks.auth = { shareToken: { websiteId: 'website' } };
    if (mode === 'reader') mocks.canWrite = false;
    expect((await post({ observations: [observation] })).status).toBe(
      mode === 'anonymous' ? 401 : 403,
    );
    expect(mocks.save).not.toHaveBeenCalled();
  });
  test('requires explicitly allowlisted content keys', async () => {
    vi.stubEnv('FORMAMI_ACCESS_CONTENT_KEYS', '');
    expect((await post({ observations: [observation] })).status).toBe(400);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  test.each([
    { consent: 'withdrawn' },
    { prompt: 'private' },
    { occurredAt: '2020-01-01T00:00:00Z' },
    { occurredAt: '2099-01-01T00:00:00Z' },
  ])('rejects invalid input %j', extra => {
    return post({ observations: [{ ...observation, ...extra }] }).then(response => {
      expect(response.status).toBe(400);
      expect(mocks.save).not.toHaveBeenCalled();
    });
  });
  test('bounds actual body bytes even without Content-Length', async () => {
    expect((await post('x'.repeat(65537))).status).toBe(413);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  test('returns a retryable, sanitized storage error', async () => {
    mocks.save.mockRejectedValue(new Error('private database diagnostic'));
    const response = await post({ observations: [observation] });
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private');
  });
  test('enforces read scope and forwards only supported dimensions', async () => {
    const request = new Request('http://localhost/api?startAt=0&endAt=1000&actor=agent');
    expect((await GET(request, context)).status).toBe(200);
    expect(mocks.get).toHaveBeenCalledWith('website', 0, 1000, { actor: 'agent' });
    mocks.canRead = false;
    expect((await GET(request, context)).status).toBe(403);
    expect(accessQuerySchema.safeParse({ startAt: 1000, endAt: 0 }).success).toBe(false);
    expect(accessQuerySchema.safeParse({ startAt: 0, endAt: 1000, country: 'CN' }).success).toBe(
      false,
    );
  });
});
