import { expect, test } from 'vitest';
import { getCompatibleHeader } from './compat';
import { getApiCorsHeaders } from './cors';

test('legacy headers are fallbacks, not overrides of new credentials', () => {
  const headers = new Headers({ 'x-umami-cache': 'old' });
  expect(getCompatibleHeader(headers, 'x-formami-cache')).toBe('old');
  headers.set('x-formami-cache', 'new');
  expect(getCompatibleHeader(headers, 'x-formami-cache')).toBe('new');
  headers.set('x-formami-cache', '');
  expect(getCompatibleHeader(headers, 'x-formami-cache')).toBe('');
});

test('cross-origin collectors allow both deployed tracker header sets', () => {
  const allowed = getApiCorsHeaders()['Access-Control-Allow-Headers'].split(', ');
  for (const prefix of ['umami', 'formami']) {
    for (const header of ['cache', 'website-id', 'hostname']) {
      expect(allowed).toContain(`x-${prefix}-${header}`);
    }
  }
});
