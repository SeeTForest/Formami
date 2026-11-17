import { z } from 'zod';
import { accessBatchSchema } from '@/lib/access-evidence';
import { defineOperation } from '@/openapi/operation';
import { apiErrorSchema, jsonResponse } from '@/openapi/schemas';
import { websiteIdPathSchema } from '../../response-schema';
import { accessQuerySchema } from './schema';

const groupSchema = z.object({
  kind: z.string(),
  actor: z.string(),
  purpose: z.string(),
  evidence: z.string(),
  confidence: z.string(),
  source: z.string(),
  provider: z.string(),
  contentKey: z.string(),
  outcome: z.string(),
  ruleVersion: z.string(),
  count: z.number(),
});
export const operations = [
  defineOperation({
    method: 'get',
    path: '/api/websites/{websiteId}/access-evidence',
    audience: 'public',
    auth: 'bearer-or-share',
    operation: {
      operationId: 'getAccessEvidence',
      summary: 'Query separate access and content-use observations',
      description:
        'Counts observations, not people. UA and reporter claims are unverified. Fetch, citation, referral and conversion totals are independent; no automatic attribution or training-use inference. Overview filters are not applied. At most 500 groups; totals are complete.',
      tags: ['Websites'],
      requestParams: { path: websiteIdPathSchema, query: accessQuerySchema },
      responses: {
        '200': jsonResponse(
          z.object({
            totals: z.record(z.string(), z.number()),
            groups: z.array(groupSchema),
            truncated: z.boolean(),
            identityVerified: z.literal(false),
            actualTrainingUse: z.literal('unknown'),
          }),
        ),
        '400': jsonResponse(apiErrorSchema),
        '401': jsonResponse(apiErrorSchema),
        '403': jsonResponse(apiErrorSchema),
      },
    },
  }),
  defineOperation({
    method: 'post',
    path: '/api/websites/{websiteId}/access-evidence',
    audience: 'public',
    auth: 'bearer',
    operation: {
      operationId: 'saveAccessEvidence',
      summary: 'Report server-side access observations with write permission',
      description:
        'Server-side credentials only; requires website update permission, granted consent and FORMAMI_ACCESS_CONTENT_KEYS allowlist. No raw URLs, UA, prompts, IP or identity. Maximum 100 observations / 64 KiB, timestamps within past 7 days and 5 minutes future. Stable IDs deduplicate retries within a website; conflicting duplicates are not overwritten. Conversion reports require backend source.',
      tags: ['Websites'],
      requestParams: { path: websiteIdPathSchema },
      requestBody: {
        required: true,
        content: { 'application/json': { schema: accessBatchSchema } },
      },
      responses: {
        '200': jsonResponse(z.object({ accepted: z.number(), duplicates: z.number() })),
        '400': jsonResponse(apiErrorSchema),
        '401': jsonResponse(apiErrorSchema),
        '403': jsonResponse(apiErrorSchema),
        '413': jsonResponse(apiErrorSchema),
        '503': jsonResponse(apiErrorSchema),
      },
    },
  }),
] as const;
