import type { z } from 'zod';
import type { accessQuerySchema } from '@/app/api/websites/[websiteId]/access-evidence/schema';
import type { PrismaClient } from '@/generated/prisma/client';
import { type AccessObservation, accessRecord } from '@/lib/access-evidence';
import prisma from '@/lib/prisma';

export function saveAccessEvidence(websiteId: string, observations: AccessObservation[]) {
  return prisma.client.accessObservation.createMany({
    data: observations.map(observation => accessRecord(websiteId, observation)),
    skipDuplicates: true,
  });
}

const dimensions = {
  kind: 'kind',
  actor: 'actor',
  purpose: 'purpose',
  evidence: 'evidence',
  confidence: 'confidence',
  source: 'source',
  signal: 'signal',
  provider: 'provider',
  contentKey: 'content_key',
  outcome: 'outcome',
  ruleVersion: 'rule_version',
  representation: 'representation',
  httpMethod: 'http_method',
  statusCode: 'status_code',
  contentVersion: 'content_version',
  collectorVersion: 'collector_version',
  collectionPolicyVersion: 'collection_policy_version',
  synthetic: 'synthetic',
  verificationRunId: 'verification_run_id',
  day: "to_char(occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')",
} as const;
type Dimension = keyof typeof dimensions;
type Query = Omit<z.infer<typeof accessQuerySchema>, 'startAt' | 'endAt'>;

/** All identifiers come from dimensions; caller values are always bound parameters. */
export function accessEvidenceQuery(
  websiteId: string,
  startAt: number,
  endAt: number,
  options: Query = {},
) {
  const {
    limit = 500,
    offset = 0,
    groupBy = 'detail',
    snapshotAt: requestedSnapshot,
    ...filters
  } = options;
  const snapshotAt = Math.min(requestedSnapshot ?? Date.now(), Date.now());
  const values: unknown[] = [websiteId, new Date(startAt), new Date(endAt), new Date(snapshotAt)];
  const where = [
    'website_id = $1::uuid',
    'occurred_at >= GREATEST($2::timestamptz, COALESCE((SELECT reset_at FROM website WHERE website_id = $1::uuid), $2::timestamptz))',
    'occurred_at <= $3::timestamptz',
    'received_at <= $4::timestamptz',
  ];
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined) continue;
    if (!Object.hasOwn(dimensions, key) || key === 'day')
      throw new Error('Unsupported access dimension');
    values.push(value);
    where.push(
      `${dimensions[key as Dimension]} = $${values.length}${key === 'verificationRunId' ? '::uuid' : ''}`,
    );
  }
  const keys: Dimension[] =
    groupBy === 'content'
      ? ['kind', 'contentKey', 'representation']
      : groupBy === 'day'
        ? ['kind', 'day']
        : (Object.keys(dimensions).filter(key => key !== 'day') as Dimension[]);
  const select = keys.map(key => `${dimensions[key]} AS "${key}"`).join(', ');
  const group = keys.map(key => dimensions[key]).join(', ');
  const order = keys.map(key => `"${key}" ASC NULLS FIRST`).join(', ');
  values.push(limit, offset);
  return {
    values,
    limit,
    offset,
    snapshotAt,
    groupBy,
    sql: `WITH base AS (SELECT * FROM access_observation WHERE ${where.join(' AND ')}),
      grouped AS (SELECT ${select}, count(*)::integer AS count FROM base GROUP BY ${group}),
      page AS (SELECT * FROM grouped ORDER BY ${order} LIMIT $${values.length - 1} OFFSET $${values.length}),
      totals AS (SELECT kind, count(*)::integer AS count FROM base GROUP BY kind)
      SELECT COALESCE((SELECT jsonb_agg(to_jsonb(page) ORDER BY ${order}) FROM page), '[]'::jsonb) AS groups,
        (SELECT count(*)::integer FROM grouped) AS "totalGroups",
        COALESCE((SELECT jsonb_object_agg(kind, count) FROM totals), '{}'::jsonb) AS totals`,
  };
}

export async function getAccessEvidence(
  websiteId: string,
  startAt: number,
  endAt: number,
  options: Query = {},
) {
  const query = accessEvidenceQuery(websiteId, startAt, endAt, options);
  const client = prisma.client as PrismaClient;
  const result = await client.$transaction(
    async tx => {
      await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '10s'");
      const rows = await tx.$queryRawUnsafe<
        { groups: Record<string, unknown>[]; totalGroups: number; totals: Record<string, number> }[]
      >(query.sql, ...query.values);
      return rows[0];
    },
    { timeout: 15000 },
  );
  const next = query.offset + result.groups.length;
  const nextOffset = next < result.totalGroups ? next : null;
  return {
    totals: result.totals,
    groups: result.groups,
    truncated: nextOffset !== null,
    pagination: {
      limit: query.limit,
      offset: query.offset,
      totalGroups: result.totalGroups,
      nextOffset,
      snapshotAt: query.snapshotAt,
    },
    groupBy: query.groupBy,
    timezone: 'UTC',
    identityVerified: false,
    actualTrainingUse: 'unknown',
  };
}
