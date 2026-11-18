import { createHash } from 'node:crypto';
import { mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import {
  accessWebsiteConfig,
  loadAccessConfig,
  matchesCollectorKey,
} from './access-evidence-config';

const website = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const key = `fae_${'1'.repeat(64)}`;
let directory: string;
let path: string;
const write = (data: unknown) => writeFileSync(path, JSON.stringify(data));
const config = () => ({
  version: 1,
  websites: {
    [website]: {
      contentKeys: ['guide'],
      collectionPolicyVersion: 'policy-v1',
      collectorKeyHashes: [createHash('sha256').update(key).digest('hex')],
      retentionDays: 400,
    },
  },
});
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'formami-access-'));
  path = join(directory, 'config.json');
  vi.stubEnv('FORMAMI_ACCESS_CONFIG_FILE', path);
  vi.stubEnv('FORMAMI_ACCESS_CONTENT_KEYS', 'legacy');
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(directory, { recursive: true, force: true });
});
test('isolates content and collector credentials by website', () => {
  write(config());
  expect(accessWebsiteConfig(website).contentKeys.has('guide')).toBe(true);
  expect(accessWebsiteConfig(other).contentKeys.size).toBe(0);
  expect(matchesCollectorKey(key, accessWebsiteConfig(website).collectorKeyHashes)).toBe(true);
  expect(matchesCollectorKey(key, accessWebsiteConfig(other).collectorKeyHashes)).toBe(false);
  expect(
    matchesCollectorKey(`fae_${'2'.repeat(64)}`, accessWebsiteConfig(website).collectorKeyHashes),
  ).toBe(false);
  expect(matchesCollectorKey('arbitrary', accessWebsiteConfig(website).collectorKeyHashes)).toBe(
    false,
  );
});
test('reloads atomic rotation and does not use stale or legacy config after a failure', () => {
  write(config());
  loadAccessConfig();
  const next = config();
  next.websites[website].collectorKeyHashes = [];
  next.websites[website].contentKeys = ['next'];
  writeFileSync(`${path}.new`, JSON.stringify(next));
  renameSync(`${path}.new`, path);
  expect(accessWebsiteConfig(website).contentKeys.has('next')).toBe(true);
  expect(matchesCollectorKey(key, accessWebsiteConfig(website).collectorKeyHashes)).toBe(false);
  writeFileSync(path, '{invalid');
  expect(() => accessWebsiteConfig(website)).toThrow();
  rmSync(path);
  expect(() => accessWebsiteConfig(website)).toThrow();
});
test.each([{ version: 2 }, { extra: 'disallowed' }, { websites: { invalid: {} } }])(
  'rejects invalid configuration %j',
  extra => {
    write({ ...config(), ...extra });
    expect(() => loadAccessConfig()).toThrow();
  },
);
test('bounds configuration file size and preserves legacy only when no file is configured', () => {
  writeFileSync(path, ' '.repeat(2 * 1024 * 1024 + 1));
  expect(() => loadAccessConfig()).toThrow();
  vi.stubEnv('FORMAMI_ACCESS_CONFIG_FILE', '');
  expect([...accessWebsiteConfig(website).contentKeys]).toEqual(['legacy']);
  expect(accessWebsiteConfig(website).collectorKeyHashes).toEqual([]);
});
