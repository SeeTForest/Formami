import { z } from 'zod';

export const ACCESS_RULE_VERSION = '2026-11-17.1';
export const accessSignals = [
  'unknown',
  'browser',
  'user_action',
  'automation',
  'chatgpt_user',
  'oai_searchbot',
  'gptbot',
  'googlebot',
] as const;
export const accessKinds = ['fetch', 'citation', 'referral', 'conversion'] as const;
export const accessRepresentations = [
  'html',
  'markdown',
  'json',
  'context',
  'discovery',
  'other',
] as const;
export const accessSources = ['server', 'cdn', 'mcp', 'backend', 'manual'] as const;
export const accessProviders = ['openai', 'google', 'other', 'unknown'] as const;
export const accessOutcomes = ['success', 'failure', 'unknown'] as const;
export const accessVersionSchema = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/);
export const accessContentKeySchema = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/);
export const accessActors = ['human', 'agent', 'automation', 'unknown'] as const;
export const accessPurposes = [
  'reading',
  'agent_retrieval',
  'search_index',
  'training_collection',
  'unknown',
] as const;

/** Run at the product's server/edge. Never retain or forward the original UA. */
export function accessSignalFromUserAgent(userAgent = ''): (typeof accessSignals)[number] {
  const ua = userAgent.slice(0, 512);
  const tokens = [
    ['chatgpt_user', /(?:^|[\s;(])ChatGPT-User(?:\/|[\s;)]|$)/i],
    ['oai_searchbot', /(?:^|[\s;(])OAI-SearchBot(?:\/|[\s;)]|$)/i],
    ['gptbot', /(?:^|[\s;(])GPTBot(?:\/|[\s;)]|$)/i],
    ['googlebot', /(?:^|[\s;(])Googlebot(?:\/|[\s;)]|$)/i],
  ] as const;
  const matches = tokens.filter(([, pattern]) => pattern.test(ua));
  if (matches.length > 1) return 'unknown';
  if (matches.length === 1) return matches[0][0];
  if (/bot|crawler|spider|headless|curl\/|python-requests\/|wget\//i.test(ua)) return 'automation';
  if (/Mozilla\/.*(?:Chrome\/|Firefox\/|Safari\/)/i.test(ua)) return 'browser';
  return 'unknown';
}

export function classifyAccess(signal: (typeof accessSignals)[number]) {
  const base = {
    ruleVersion: ACCESS_RULE_VERSION,
    confidence: 'low',
    identityVerified: false,
    actualTrainingUse: 'unknown',
  } as const;
  switch (signal) {
    case 'chatgpt_user':
      return { ...base, actor: 'agent', purpose: 'agent_retrieval', evidence: 'ua_declaration' };
    case 'oai_searchbot':
    case 'googlebot':
      return { ...base, actor: 'automation', purpose: 'search_index', evidence: 'ua_declaration' };
    case 'gptbot':
      return {
        ...base,
        actor: 'automation',
        purpose: 'training_collection',
        evidence: 'ua_declaration',
      };
    case 'automation':
      return { ...base, actor: 'automation', purpose: 'unknown', evidence: 'heuristic' };
    case 'user_action':
      return { ...base, actor: 'human', purpose: 'reading', evidence: 'reporter_declaration' };
    // A browser UA is also used by browser automation. It is not proof of a human or reading.
    default:
      return {
        ...base,
        actor: 'unknown',
        purpose: 'unknown',
        evidence: 'unknown',
        confidence: 'unknown',
      };
  }
}

export const accessObservationSchema = z
  .strictObject({
    id: z.uuid(),
    occurredAt: z.iso.datetime(),
    consent: z.literal('granted').optional(),
    collectionPolicyVersion: accessVersionSchema.optional(),
    source: z.enum(accessSources),
    kind: z.enum(accessKinds),
    // Product-owned public content/category key, never a raw path, title, user ID, or prompt.
    contentKey: accessContentKeySchema,
    signal: z.enum(accessSignals).default('unknown'),
    provider: z.enum(accessProviders).default('unknown'),
    outcome: z.enum(accessOutcomes).default('unknown'),
    representation: z.enum(accessRepresentations).optional(),
    httpMethod: z.enum(['GET', 'HEAD']).optional(),
    statusCode: z.number().int().min(100).max(599).optional(),
    contentVersion: accessVersionSchema.optional(),
    collectorVersion: accessVersionSchema.max(32).optional(),
    synthetic: z.boolean().optional(),
    verificationRunId: z.uuid().optional(),
  })
  .superRefine((value, context) => {
    if (value.collectionPolicyVersion) {
      if (
        value.consent !== undefined ||
        !['server', 'cdn'].includes(value.source) ||
        value.kind !== 'fetch'
      ) {
        context.addIssue({
          code: 'custom',
          message:
            'Server collection policy applies only to server/CDN fetches, separately from consent.',
        });
      }
      for (const key of [
        'representation',
        'httpMethod',
        'statusCode',
        'contentVersion',
        'collectorVersion',
        'synthetic',
      ] as const) {
        if (value[key] === undefined)
          context.addIssue({
            code: 'custom',
            path: [key],
            message: 'Required for policy-based observations.',
          });
      }
    } else if (value.consent !== 'granted') {
      context.addIssue({
        code: 'custom',
        message: 'Granted consent or an approved server collection policy is required.',
      });
    }
    if (
      value.synthetic === true ? !value.verificationRunId : value.verificationRunId !== undefined
    ) {
      context.addIssue({
        code: 'custom',
        path: ['verificationRunId'],
        message: 'A verification UUID is required exactly when synthetic is true.',
      });
    }
  })
  .refine(value => value.kind !== 'conversion' || value.source === 'backend', {
    message: 'Conversions must be reported by the product backend.',
  });

export const accessBatchSchema = z.strictObject({
  observations: z.array(accessObservationSchema).min(1).max(100),
});
export type AccessObservation = z.infer<typeof accessObservationSchema>;

export function accessRecord(websiteId: string, observation: AccessObservation) {
  const { consent: _consent, ...data } = observation;
  const {
    identityVerified: _identity,
    actualTrainingUse: _training,
    ...classification
  } = classifyAccess(data.signal);
  return { ...data, websiteId, occurredAt: new Date(data.occurredAt), ...classification };
}
