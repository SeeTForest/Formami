import { z } from 'zod';
import { accessActors, accessKinds, accessPurposes } from '@/lib/access-evidence';
export const accessQuerySchema = z
  .strictObject({
    startAt: z.coerce.number().int().nonnegative().max(8640000000000000),
    endAt: z.coerce.number().int().nonnegative().max(8640000000000000),
    actor: z.enum(accessActors).optional(),
    purpose: z.enum(accessPurposes).optional(),
    kind: z.enum(accessKinds).optional(),
    contentKey: z
      .string()
      .regex(/^[a-z][a-z0-9_-]{0,63}$/)
      .optional(),
  })
  .refine(value => value.endAt >= value.startAt && value.endAt - value.startAt <= 366 * 86400000);
