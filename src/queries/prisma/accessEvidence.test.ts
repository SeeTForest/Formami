import { expect, test, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({ default: { client: {} } }));

import { accessEvidenceQuery } from './accessEvidence';

test('binds all values and orders by the full group identity rather than changing counts', () => {
  const value = "secret' OR 1=1 --";
  const q = accessEvidenceQuery('website', 0, 1000, {
    contentKey: value,
    synthetic: false,
    limit: 100,
    offset: 500,
    snapshotAt: 1000,
  });
  expect(q.sql).not.toContain(value);
  expect(q.values).toContain(value);
  expect(q.values).toContain(false);
  expect(q.sql).toContain('received_at <= $4::timestamptz');
  expect(q.sql).toContain('"verificationRunId" ASC NULLS FIRST');
  expect(q.sql).not.toContain('count DESC');
  expect(q.snapshotAt).toBe(1000);
});
test('supports bounded UTC day and content aggregation without mixing representations', () => {
  const day = accessEvidenceQuery('website', 0, 1000, { groupBy: 'day' });
  expect(day.sql).toContain("occurred_at AT TIME ZONE 'UTC'");
  const content = accessEvidenceQuery('website', 0, 1000, { groupBy: 'content' });
  expect(content.sql).toContain('GROUP BY kind, content_key, representation');
  expect(() => accessEvidenceQuery('website', 0, 1000, { constructor: 'evil' } as any)).toThrow();
});
