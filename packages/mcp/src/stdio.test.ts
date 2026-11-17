import { describe, expect, test } from 'vitest';
import { resolveClientOptions } from './stdio';

describe('resolveClientOptions', () => {
  test('appends /api to a self-hosted instance URL', () => {
    expect(
      resolveClientOptions({
        FORMAMI_URL: 'https://analytics.example.com/',
        FORMAMI_API_TOKEN: 't',
      }),
    ).toEqual({ baseUrl: 'https://analytics.example.com/api', token: 't', apiKey: undefined });
  });

  test('uses FORMAMI_API_URL verbatim', () => {
    expect(
      resolveClientOptions({
        FORMAMI_API_URL: 'https://analytics.example.com/api',
        FORMAMI_API_KEY: 'k',
      }),
    ).toEqual({ baseUrl: 'https://analytics.example.com/api', token: undefined, apiKey: 'k' });
  });

  test('requires an explicit instance even with an API key', () => {
    expect(() => resolveClientOptions({ FORMAMI_API_KEY: 'k' })).toThrow(/FORMAMI_API_URL/);
  });

  test('requires credentials', () => {
    expect(() => resolveClientOptions({})).toThrow(/FORMAMI_API_TOKEN/);
  });
});
