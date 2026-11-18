import { z } from 'zod';
import { accessBatchSchema } from '@/lib/access-evidence';
import { defineOperation } from '@/openapi/operation';
import { apiErrorSchema, jsonResponse } from '@/openapi/schemas';
import { websiteIdPathSchema } from '../../response-schema';
import { accessQuerySchema } from './schema';

const groupSchema = z.object({
  kind: z.string(),
  actor: z.string().optional(),
  purpose: z.string().optional(),
  evidence: z.string().optional(),
  confidence: z.string().optional(),
  source: z.string().optional(),
  signal: z.string().optional(),
  provider: z.string().optional(),
  contentKey: z.string().optional(),
  outcome: z.string().optional(),
  ruleVersion: z.string().optional(),
  representation: z.string().nullable().optional(),
  httpMethod: z.string().nullable().optional(),
  statusCode: z.number().nullable().optional(),
  contentVersion: z.string().nullable().optional(),
  collectorVersion: z.string().nullable().optional(),
  collectionPolicyVersion: z.string().nullable().optional(),
  synthetic: z.boolean().nullable().optional(),
  verificationRunId: z.uuid().nullable().optional(),
  day: z.string().optional(),
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
        'Counts observations, not people. UA and reporter claims remain unverified. Totals cover all matching rows, independently of pagination. detail groups by all evidence dimensions; content groups by kind/contentKey/representation; day groups by kind/UTC day. Stable key ordering, maximum 500 groups per page. Reuse pagination.snapshotAt, fixed startAt/endAt and filters for subsequent offsets. The receive cutoff reduces concurrent additions but is not a cross-request database snapshot; reconcile totals and retry a closed window after concurrent ingestion or retention. Overview filters are not applied.',
      tags: ['Websites'],
      requestParams: { path: websiteIdPathSchema, query: accessQuerySchema },
      responses: {
        '200': jsonResponse(
          z.object({
            totals: z.record(z.string(), z.number()),
            groups: z.array(groupSchema),
            truncated: z.boolean(),
            pagination: z.object({
              limit: z.number(),
              offset: z.number(),
              totalGroups: z.number(),
              nextOffset: z.number().nullable(),
              snapshotAt: z.number(),
            }),
            groupBy: z.enum(['detail', 'content', 'day']),
            timezone: z.literal('UTC'),
            identityVerified: z.literal(false),
            actualTrainingUse: z.literal('unknown'),
          }),
        ),
        '400': jsonResponse(apiErrorSchema),
        '401': jsonResponse(apiErrorSchema),
        '403': jsonResponse(apiErrorSchema),
        '503': jsonResponse(apiErrorSchema),
      },
    },
  }),
  defineOperation({
    method: 'post',
    path: '/api/websites/{websiteId}/access-evidence',
    audience: 'public',
    auth: 'bearer-or-access-key',
    operation: {
      operationId: 'saveAccessEvidence',
      summary: 'Report server-side access observations with write permission',
      description:
        'Server-side credentials only. Legacy reports require website update permission and granted consent. Policy-based server/CDN fetches use configured collectionPolicyVersion, not fabricated user consent, and require the HTTP/content/version/synthetic fields. An x-formami-access-key is accepted only for policy-based fetches for its configured website; it cannot query or access other APIs. FORMAMI_ACCESS_CONFIG_FILE provides per-website content allowlists/policies/key hashes; the old global allowlist is supported only when no file is configured. No raw URLs, UA, prompts, IP or identity. Maximum 100 observations / 64 KiB; past 7 days and 5 minutes future. Stable UUIDs deduplicate within website without overwrite. synthetic=true requires verificationRunId. Conversion reports still require backend source and user authorization.',
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
