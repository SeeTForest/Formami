import type { PrismaClient } from '@/generated/prisma/client';
import { type AccessObservation, accessRecord } from '@/lib/access-evidence';
import prisma from '@/lib/prisma';

export function saveAccessEvidence(websiteId: string, observations: AccessObservation[]) {
  return prisma.client.accessObservation.createMany({
    data: observations.map(observation => accessRecord(websiteId, observation)),
    skipDuplicates: true,
  });
}

export async function getAccessEvidence(
  websiteId: string,
  startAt: number,
  endAt: number,
  filters: { actor?: string; purpose?: string; kind?: string; contentKey?: string } = {},
) {
  const website = await prisma.client.website.findUnique({
    where: { id: websiteId },
    select: { resetAt: true },
  });
  const where = {
    websiteId,
    occurredAt: {
      gte: new Date(Math.max(startAt, +(website?.resetAt || 0))),
      lte: new Date(endAt),
    },
    ...filters,
  };
  const client = prisma.client as PrismaClient;
  const [totals, groups] = await Promise.all([
    client.accessObservation.groupBy({ by: ['kind'], where, _count: { _all: true } }),
    client.accessObservation.groupBy({
      by: [
        'kind',
        'actor',
        'purpose',
        'evidence',
        'confidence',
        'source',
        'provider',
        'contentKey',
        'outcome',
        'ruleVersion',
      ],
      where,
      _count: { _all: true },
      orderBy: [{ _count: { id: 'desc' } }, { contentKey: 'asc' }],
      take: 501,
    }),
  ]);
  return {
    totals: Object.fromEntries(totals.map(row => [row.kind, row._count._all])),
    groups: groups.slice(0, 500).map(({ _count, ...row }) => ({ ...row, count: _count._all })),
    truncated: groups.length > 500,
    identityVerified: false,
    actualTrainingUse: 'unknown',
  };
}
