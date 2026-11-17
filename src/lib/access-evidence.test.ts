import { describe, expect, test } from 'vitest';
import {
  accessBatchSchema,
  accessRecord,
  accessSignalFromUserAgent,
  classifyAccess,
} from './access-evidence';

const observation = {
  id: '00000000-0000-4000-8000-000000000001',
  occurredAt: '2026-11-17T00:00:00Z',
  consent: 'granted',
  source: 'server',
  kind: 'fetch',
  contentKey: 'guide',
};

describe('access evidence boundaries', () => {
  test.each([
    ['Mozilla/5.0 (compatible; ChatGPT-User/1.0)', 'agent', 'agent_retrieval', 'ua_declaration'],
    ['GPTBot/1.4', 'automation', 'training_collection', 'ua_declaration'],
    ['OAI-SearchBot/1.4', 'automation', 'search_index', 'ua_declaration'],
    ['Googlebot/2.1', 'automation', 'search_index', 'ua_declaration'],
    ['curl/8.0', 'automation', 'unknown', 'heuristic'],
    ['Mozilla/5.0 Chrome/131.0 Safari/537.36', 'unknown', 'unknown', 'unknown'],
    ['', 'unknown', 'unknown', 'unknown'],
    ['MyChatGPT-User/1.0', 'unknown', 'unknown', 'unknown'],
    ['GPTBot/1.0 ChatGPT-User/1.0', 'unknown', 'unknown', 'unknown'],
  ])('classifies claims without authenticating %s', (ua, actor, purpose, evidence) => {
    expect(classifyAccess(accessSignalFromUserAgent(ua))).toMatchObject({
      actor,
      purpose,
      evidence,
      identityVerified: false,
      actualTrainingUse: 'unknown',
    });
  });
  test('user interaction is a declaration, including when automation simulates it', () => {
    expect(classifyAccess('user_action')).toMatchObject({
      actor: 'human',
      purpose: 'reading',
      evidence: 'reporter_declaration',
      confidence: 'low',
    });
  });
  test.each([
    { consent: 'denied' },
    { consent: 'unknown' },
    { kind: 'conversion' },
    { contentKey: '/user/123?token=secret' },
    { contentKey: 'a@example.com' },
    { userAgent: 'raw UA' },
    { prompt: 'private' },
    { url: '/private' },
    { confidence: 'verified' },
  ])('rejects prohibited or contradictory fields %j', extra => {
    expect(
      accessBatchSchema.safeParse({ observations: [{ ...observation, ...extra }] }).success,
    ).toBe(false);
  });
  test('stores only classification and controlled evidence; never raw UA or consent', () => {
    const { observations } = accessBatchSchema.parse({
      observations: [{ ...observation, signal: 'gptbot' }],
    });
    const record = accessRecord('website', observations[0]);
    expect(record).toMatchObject({
      websiteId: 'website',
      actor: 'automation',
      purpose: 'training_collection',
    });
    expect(record).not.toHaveProperty('consent');
    expect(record).not.toHaveProperty('userAgent');
  });
  test('bounds batches and accepts backend-confirmed conversion reports separately', () => {
    expect(
      accessBatchSchema.safeParse({ observations: Array(101).fill(observation) }).success,
    ).toBe(false);
    expect(
      accessBatchSchema.safeParse({
        observations: [{ ...observation, kind: 'conversion', source: 'backend' }],
      }).success,
    ).toBe(true);
  });
});
