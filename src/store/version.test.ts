import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { getItem } from '@/lib/storage';
import { checkVersion, useVersion } from './version';

const updateConfig = vi.hoisted(() => ({ url: 'https://updates.example.com' }));
vi.mock('@/lib/constants', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/constants')>()),
  get UPDATES_URL() {
    return updateConfig.url;
  },
}));

vi.mock('@/lib/storage', () => ({
  getItem: vi.fn(),
}));

const initialState = {
  current: '1.0.0',
  latest: null,
  hasUpdate: false,
  checked: false,
  releaseUrl: null,
};

function mockFetch(response: { ok: boolean; body?: any }) {
  return vi.fn().mockResolvedValue({
    ok: response.ok,
    json: async () => response.body,
  });
}

beforeEach(() => {
  updateConfig.url = 'https://updates.example.com';
  useVersion.setState({ ...initialState }, true);
  vi.mocked(getItem).mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('checkVersion', () => {
  test('does not update state when the request fails', async () => {
    vi.stubGlobal('fetch', mockFetch({ ok: false }));

    await checkVersion();

    const state = useVersion.getState();
    expect(state.checked).toBe(false);
    expect(state.latest).toBeNull();
  });

  test('marks an update available when latest is newer', async () => {
    vi.mocked(getItem).mockReturnValue(null);
    vi.stubGlobal(
      'fetch',
      mockFetch({ ok: true, body: { latest: '2.0.0', url: 'https://release' } }),
    );

    await checkVersion();

    const state = useVersion.getState();
    expect(state.checked).toBe(true);
    expect(state.latest).toBe('2.0.0');
    expect(state.hasUpdate).toBe(true);
    expect(state.releaseUrl).toBe('https://release');
  });

  test('does not flag an update when latest is not newer', async () => {
    vi.mocked(getItem).mockReturnValue(null);
    vi.stubGlobal('fetch', mockFetch({ ok: true, body: { latest: '0.9.0', url: 'x' } }));

    await checkVersion();

    const state = useVersion.getState();
    expect(state.checked).toBe(true);
    expect(state.hasUpdate).toBe(false);
  });

  test('does not flag an update when the latest version was already dismissed', async () => {
    vi.mocked(getItem).mockReturnValue({ version: '2.0.0' });
    vi.stubGlobal('fetch', mockFetch({ ok: true, body: { latest: '2.0.0', url: 'x' } }));

    await checkVersion();

    const state = useVersion.getState();
    expect(state.checked).toBe(true);
    expect(state.hasUpdate).toBe(false);
  });
});

test('does not contact an upstream service without a configured endpoint', async () => {
  updateConfig.url = '';
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  await checkVersion();
  expect(fetch).not.toHaveBeenCalled();
});
