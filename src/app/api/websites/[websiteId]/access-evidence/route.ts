import type { z } from 'zod';
import { accessBatchSchema } from '@/lib/access-evidence';
import { parseRequest } from '@/lib/request';
import { badRequest, forbidden, json, payloadTooLarge } from '@/lib/response';
import { canUpdateWebsite, canViewWebsiteSection } from '@/permissions';
import { getAccessEvidence, saveAccessEvidence } from '@/queries/prisma/accessEvidence';
import { accessQuerySchema } from './schema';

type Context = { params: Promise<{ websiteId: string }> };

export async function GET(request: Request, { params }: Context) {
  const { auth, query, error } = await parseRequest(request, accessQuerySchema);
  if (error) return error();
  const { websiteId } = await params;
  if (!(await canViewWebsiteSection(auth, websiteId, ['overview']))) return forbidden();
  const { startAt, endAt, ...filters } = query;
  return json(await getAccessEvidence(websiteId, startAt, endAt, filters));
}

export async function POST(request: Request, { params }: Context) {
  // Authenticate before reading the body. Never expose this credential to the browser tracker.
  const { auth, error } = await parseRequest(
    new Request(request.url, { headers: request.headers }),
  );
  if (error) return error();
  const { websiteId } = await params;
  if (!auth.user || auth.shareToken || !(await canUpdateWebsite(auth, websiteId)))
    return forbidden();
  const reader = request.body?.getReader();
  if (!reader) return badRequest();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let observations: z.infer<typeof accessBatchSchema>['observations'];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65536) {
        await reader.cancel();
        return payloadTooLarge();
      }
      chunks.push(value);
    }
    const result = accessBatchSchema.safeParse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    if (!result.success) return badRequest();
    const allowedContent = new Set(
      (process.env.FORMAMI_ACCESS_CONTENT_KEYS || '')
        .split(',')
        .map(key => key.trim())
        .filter(Boolean),
    );
    if (result.data.observations.some(row => !allowedContent.has(row.contentKey)))
      return badRequest();
    const now = Date.now();
    if (
      result.data.observations.some(
        row =>
          +new Date(row.occurredAt) < now - 7 * 86400000 ||
          +new Date(row.occurredAt) > now + 300000,
      )
    )
      return badRequest();
    observations = result.data.observations;
  } catch {
    // Do not return request content or database diagnostics.
    return badRequest();
  } finally {
    reader.releaseLock();
  }
  try {
    const { count } = await saveAccessEvidence(websiteId, observations);
    return json({ accepted: count, duplicates: observations.length - count });
  } catch {
    return Response.json(
      { error: { message: 'Observation storage unavailable', status: 503 } },
      { status: 503 },
    );
  }
}
