import { beforeAll, describe, expect, test } from 'vitest';
import clickhouse from './clickhouse';
import { countrySQL, reportingCountryRows } from './country-policy';

let prisma: typeof import('./prisma').default;
beforeAll(async () => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@127.0.0.1:55435/forami';
  prisma = (await import('./prisma')).default;
});

describe('reporting country', () => {
  test.each(['eq', 'neq'])(
    'aliases legacy %s filters, including repeated and cohort filters',
    operator => {
      for (const db of [prisma, clickhouse]) {
        const result = db.parseFilters({
          country: `${operator}.CN,TW`,
          country1: 'eq.TW',
          cohort_country: 'eq.TW',
        });
        expect(result.queryParams).toMatchObject({
          country: ['CN', 'CN'],
          country1: ['CN'],
          cohort_country: ['CN'],
        });
        expect(result.filterQuery).toContain("then 'CN'");
        expect(result.cohortQuery).toContain("then 'CN'");
      }
    },
  );
  test('keeps unknown and region identifiers, and does not rewrite custom properties', () => {
    const input = [
      { country: 'TW', region: 'TW-TPE', properties: { country: 'TW' } },
      { country: null },
    ];
    expect(reportingCountryRows(input)).toEqual([
      { country: 'CN', region: 'TW-TPE', properties: { country: 'TW' } },
      { country: null },
    ]);
    expect(input[0].country).toBe('TW');
    expect(countrySQL()).toBe("case when country = 'TW' then 'CN' else country end");
  });
});
