import { z } from 'zod';
import {
  accessActors,
  accessContentKeySchema,
  accessKinds,
  accessOutcomes,
  accessProviders,
  accessPurposes,
  accessRepresentations,
  accessSignals,
  accessSources,
  accessVersionSchema,
} from '@/lib/access-evidence';
export const accessQuerySchema = z
  .strictObject({
    startAt: z.coerce.number().int().nonnegative().max(8640000000000000),
    endAt: z.coerce.number().int().nonnegative().max(8640000000000000),
    actor: z.enum(accessActors).optional(),
    purpose: z.enum(accessPurposes).optional(),
    kind: z.enum(accessKinds).optional(),
    contentKey: accessContentKeySchema.optional(),
    representation: z.enum(accessRepresentations).optional(),
    source: z.enum(accessSources).optional(),
    signal: z.enum(accessSignals).optional(),
    provider: z.enum(accessProviders).optional(),
    outcome: z.enum(accessOutcomes).optional(),
    httpMethod: z.enum(['GET', 'HEAD']).optional(),
    statusCode: z.coerce.number().int().min(100).max(599).optional(),
    contentVersion: accessVersionSchema.optional(),
    collectorVersion: accessVersionSchema.max(32).optional(),
    collectionPolicyVersion: accessVersionSchema.optional(),
    synthetic: z
      .enum(['true', 'false'])
      .transform(value => value === 'true')
      .optional(),
    verificationRunId: z.uuid().optional(),
    groupBy: z.enum(['detail', 'content', 'day']).optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
    offset: z.coerce.number().int().min(0).max(1000000).optional(),
    snapshotAt: z.coerce.number().int().nonnegative().max(8640000000000000).optional(),
  })
  .refine(value => value.endAt >= value.startAt && value.endAt - value.startAt <= 366 * 86400000);
