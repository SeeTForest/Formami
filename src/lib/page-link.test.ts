import { describe, expect, test } from 'vitest';
import { getPageLink, getPageLinkOptions, validPageOrigins } from './page-link';

describe('product page links', () => {
  test('offers explicit choices for ambiguous multi-domain paths', () => {
    expect(getPageLinkOptions('example.com,http://localhost:3030', '/')).toEqual([
      'https://example.com/',
      'http://localhost:3030/',
    ]);
    expect(getPageLinkOptions('example.com,javascript:alert(1)', '/')).toEqual([]);
    expect(validPageOrigins('example.com,http://localhost:3030')).toBe(true);
    expect(validPageOrigins('example.com,')).toBe(false);
  });
  test.each([
    ['example.com', '/', 'https://example.com/'],
    ['localhost:3030', '/a b?q=a b', 'https://localhost:3030/a%20b?q=a%20b'],
    [
      'http://localhost:3030',
      '/中文?q=hello%20world',
      'http://localhost:3030/%E4%B8%AD%E6%96%87?q=hello%20world',
    ],
    ['https://例子.测试', '/文章', 'https://xn--fsqu00a.xn--0zwm56d/%E6%96%87%E7%AB%A0'],
    [
      'example.com,https://docs.example.com',
      'https://docs.example.com/guide?a=1',
      'https://docs.example.com/guide?a=1',
    ],
  ])('resolves %s + %s', (domain, path, url) => expect(getPageLink(domain, path)).toEqual({ url }));
  test.each([
    [null, '/'],
    ['', '/'],
    ['example.com', ''],
    ['example.com,docs.example.com', '/'],
    ['example.com', '//evil.test/path'],
    ['example.com', '/\\evil.test'],
    ['example.com', 'javascript:alert(1)'],
    ['example.com', 'data:text/html,test'],
    ['example.com', 'https://example.com.evil.test/'],
    ['example.com', 'https://example.com@evil.test/'],
    ['example.com', 'https://user:pass@example.com/'],
    ['example.com', 'http://example.com/'],
    ['javascript:alert(1)', '/'],
    ['https://example.com/path', '/'],
    ['https://example.com?x=1', '/'],
    ['example.com', '/\n/evil.test'],
    ['example.com', 'https://example.com:444/'],
  ])('does not offer unsafe or ambiguous target %s + %s', (domain, path) => {
    expect(getPageLink(domain, path)).toHaveProperty('reason');
    expect(getPageLink(domain, path).url).toBeUndefined();
  });
});
