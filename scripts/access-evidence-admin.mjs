import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';

process.umask(0o077);
const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: Object.fromEntries(
    ['config', 'website', 'content-keys', 'policy', 'secret-file', 'retention-days']
      .map(key => [key, { type: 'string' }])
      .concat([['apply', { type: 'boolean' }]]),
  ),
});
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const keyPattern = /^[a-z][a-z0-9_-]{0,63}$/;
const versionPattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;
const required = name => {
  if (!values[name]) throw new Error(`Missing required option: ${name}`);
  return values[name];
};
function readConfig(path) {
  if (!existsSync(path)) return { version: 1, websites: {} };
  if (statSync(path).size > 2 * 1024 * 1024) throw new Error('Configuration too large');
  const config = JSON.parse(readFileSync(path, 'utf8'));
  if (config.version !== 1 || !config.websites || Array.isArray(config.websites))
    throw new Error('Invalid configuration');
  if (
    Object.keys(config).some(key => !['version', 'websites'].includes(key)) ||
    Object.keys(config.websites).length > 128
  )
    throw new Error('Invalid configuration');
  for (const [id, w] of Object.entries(config.websites)) {
    if (
      !w ||
      typeof w !== 'object' ||
      Object.keys(w).some(
        key =>
          ![
            'contentKeys',
            'collectionPolicyVersion',
            'collectorKeyHashes',
            'retentionDays',
          ].includes(key),
      )
    )
      throw new Error('Invalid website configuration');
    w.retentionDays ??= 400;
    if (
      !uuid.test(id) ||
      !Array.isArray(w.contentKeys) ||
      w.contentKeys.length > 20000 ||
      !w.contentKeys.every(k => typeof k === 'string' && keyPattern.test(k)) ||
      typeof w.collectionPolicyVersion !== 'string' ||
      !versionPattern.test(w.collectionPolicyVersion) ||
      !Array.isArray(w.collectorKeyHashes) ||
      w.collectorKeyHashes.length > 4 ||
      !w.collectorKeyHashes.every(h => typeof h === 'string' && /^[a-f0-9]{64}$/.test(h)) ||
      !Number.isInteger(w.retentionDays) ||
      w.retentionDays < 8 ||
      w.retentionDays > 730
    )
      throw new Error('Invalid website configuration');
  }
  return config;
}
async function main() {
  if (positionals.length !== 1) throw new Error('Exactly one action is required');
  const path = resolve(required('config'));
  const config = readConfig(path);
  if (positionals[0] === 'provision') {
    const id = required('website');
    const secretPath = resolve(required('secret-file'));
    if (!uuid.test(id) || secretPath === path || existsSync(secretPath))
      throw new Error('Invalid website or existing secret destination');
    const contentKeys = JSON.parse(readFileSync(required('content-keys'), 'utf8'));
    const policy = required('policy');
    const retentionDays = Number(
      values['retention-days'] ?? config.websites[id]?.retentionDays ?? 400,
    );
    if (
      !Array.isArray(contentKeys) ||
      contentKeys.length > 20000 ||
      !contentKeys.every(k => typeof k === 'string' && keyPattern.test(k)) ||
      !versionPattern.test(policy) ||
      !Number.isInteger(retentionDays) ||
      retentionDays < 8 ||
      retentionDays > 730
    )
      throw new Error('Invalid provisioning input');
    const previous = config.websites[id]?.collectorKeyHashes ?? [];
    if (previous.length >= 4) throw new Error('Remove a retired key hash before rotating again');
    const key = `fae_${randomBytes(32).toString('hex')}`;
    config.websites[id] = {
      contentKeys: [...new Set(contentKeys)].sort(),
      collectionPolicyVersion: policy,
      collectorKeyHashes: [...previous, createHash('sha256').update(key).digest('hex')],
      retentionDays,
    };
    const serialized = `${JSON.stringify(config, null, 2)}\n`;
    if (
      Buffer.byteLength(serialized) > 2 * 1024 * 1024 ||
      Object.keys(config.websites).length > 128
    )
      throw new Error('Configuration too large');
    mkdirSync(dirname(secretPath), { recursive: true, mode: 0o700 });
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    writeFileSync(secretPath, `${key}\n`, { flag: 'wx', mode: 0o600 });
    const temporary = `${path}.${randomUUID()}.tmp`;
    writeFileSync(temporary, serialized, { flag: 'wx', mode: 0o600 });
    renameSync(temporary, path);
    console.log(
      JSON.stringify({
        provisioned: true,
        websiteId: id,
        contentKeys: config.websites[id].contentKeys.length,
        secretWritten: true,
      }),
    );
  } else if (positionals[0] === 'prune') {
    if (!existsSync(path) || !process.env.DATABASE_URL)
      throw new Error('Existing configuration and DATABASE_URL required');
    if (values.website && !config.websites[values.website])
      throw new Error('Website not configured');
    const { PrismaClient } = await import('../generated/prisma/client.js');
    const { PrismaPg } = await import('@prisma/adapter-pg');
    const client = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    try {
      for (const [websiteId, w] of Object.entries(config.websites)) {
        if (values.website && values.website !== websiteId) continue;
        const before = new Date(Date.now() - w.retentionDays * 86400000);
        const where = {
          websiteId,
          occurredAt: { lt: before },
          collectionPolicyVersion: { not: null },
        };
        const { eligible, deleted } = await client.$transaction(
          async tx => {
            await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '10s'");
            const eligible = await tx.accessObservation.count({ where });
            const deleted =
              values.apply && eligible
                ? await tx.$executeRawUnsafe(
                    'DELETE FROM access_observation WHERE website_id=$1::uuid AND id IN (SELECT id FROM access_observation WHERE website_id=$1::uuid AND occurred_at<$2 AND collection_policy_version IS NOT NULL ORDER BY occurred_at,id LIMIT 5000)',
                    websiteId,
                    before,
                  )
                : 0;
            return { eligible, deleted };
          },
          { timeout: 15000 },
        );
        console.log(
          JSON.stringify({
            websiteId,
            retentionDays: w.retentionDays,
            eligible,
            deleted,
            dryRun: !values.apply,
            batchLimit: 5000,
          }),
        );
      }
    } finally {
      await client.$disconnect();
    }
  } else throw new Error('Use provision or prune');
}
main().catch(() => {
  console.error(
    'Access evidence administration failed; inspect local inputs and permissions. No credentials are logged.',
  );
  process.exitCode = 1;
});
