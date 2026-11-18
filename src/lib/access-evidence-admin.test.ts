import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { accessConfigSchema } from './access-evidence-config';

let directory: string;
const website = '00000000-0000-4000-8000-000000000001';
const script = resolve('scripts/access-evidence-admin.mjs');
const command = (secret: string, extra: string[] = []) => [
  script,
  'provision',
  '--config',
  join(directory, 'config.json'),
  '--website',
  website,
  '--content-keys',
  join(directory, 'keys.json'),
  '--policy',
  'policy-v1',
  '--secret-file',
  join(directory, secret),
  ...extra,
];
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'formami-admin-'));
  writeFileSync(join(directory, 'keys.json'), JSON.stringify(['guide', 'guide', 'site_unmapped']));
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));
test('provisions and rotates without printing credentials or overwriting an existing secret', () => {
  const output = execFileSync(process.execPath, command('secret'), { encoding: 'utf8' });
  const key = readFileSync(join(directory, 'secret'), 'utf8').trim();
  expect(key).toMatch(/^fae_[a-f0-9]{64}$/);
  expect(output).not.toContain(key);
  let config = accessConfigSchema.parse(
    JSON.parse(readFileSync(join(directory, 'config.json'), 'utf8')),
  );
  expect(config.websites[website].contentKeys).toEqual(['guide', 'site_unmapped']);
  expect(config.websites[website].collectorKeyHashes).toEqual([
    createHash('sha256').update(key).digest('hex'),
  ]);
  expect(spawnSync(process.execPath, command('secret')).status).toBe(1);
  expect(readFileSync(join(directory, 'secret'), 'utf8').trim()).toBe(key);
  execFileSync(process.execPath, command('rotated-secret'));
  config = accessConfigSchema.parse(
    JSON.parse(readFileSync(join(directory, 'config.json'), 'utf8')),
  );
  expect(config.websites[website].collectorKeyHashes).toHaveLength(2);
});
test('rejects malformed content keys before writing a secret', () => {
  writeFileSync(join(directory, 'keys.json'), JSON.stringify(['/private?token=value']));
  const result = spawnSync(process.execPath, command('secret'), { encoding: 'utf8' });
  expect(result.status).toBe(1);
  expect(result.stderr).not.toContain('token=value');
});
