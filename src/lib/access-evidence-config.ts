import { createHash, timingSafeEqual } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { z } from 'zod';
import { accessContentKeySchema, accessVersionSchema } from './access-evidence';

export const accessConfigSchema = z.strictObject({
  version: z.literal(1),
  websites: z
    .record(
      z.uuid(),
      z.strictObject({
        contentKeys: z.array(accessContentKeySchema).max(20000),
        collectionPolicyVersion: accessVersionSchema,
        collectorKeyHashes: z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(4),
        retentionDays: z.number().int().min(8).max(730).default(400),
      }),
    )
    .refine(value => Object.keys(value).length <= 128),
});
export type AccessConfig = z.infer<typeof accessConfigSchema>;
let cached: { signature: string; value: AccessConfig } | undefined;

/** No fallback after a configured file becomes invalid or inaccessible. Replace it atomically. */
export function loadAccessConfig(): AccessConfig | null {
  const path = process.env.FORMAMI_ACCESS_CONFIG_FILE;
  if (!path) return null;
  const stat = statSync(path);
  if (!stat.isFile() || stat.size > 2 * 1024 * 1024)
    throw new Error('Invalid access configuration');
  const signature = JSON.stringify([path, stat.ino, stat.size, stat.mtimeMs, stat.ctimeMs]);
  if (cached?.signature === signature) return cached.value;
  const bytes = readFileSync(path);
  if (bytes.length > 2 * 1024 * 1024) throw new Error('Invalid access configuration');
  const value = accessConfigSchema.parse(JSON.parse(bytes.toString('utf8')));
  cached = { signature, value };
  return value;
}

export function accessWebsiteConfig(websiteId: string) {
  const config = loadAccessConfig();
  if (config) {
    const website = config.websites[websiteId];
    return {
      contentKeys: new Set(website?.contentKeys ?? []),
      collectionPolicyVersion: website?.collectionPolicyVersion,
      collectorKeyHashes: website?.collectorKeyHashes ?? [],
    };
  }
  return {
    contentKeys: new Set(
      (process.env.FORMAMI_ACCESS_CONTENT_KEYS ?? '')
        .split(',')
        .map(key => key.trim())
        .filter(Boolean),
    ),
    collectionPolicyVersion: undefined,
    collectorKeyHashes: [] as string[],
  };
}

/** This credential is only recognized by access-evidence POST; it is not an account API key. */
export function matchesCollectorKey(key: string, hashes: string[]) {
  if (!/^fae_[a-f0-9]{64}$/.test(key)) return false;
  const digest = createHash('sha256').update(key).digest();
  return hashes.some(hash => timingSafeEqual(digest, Buffer.from(hash, 'hex')));
}
