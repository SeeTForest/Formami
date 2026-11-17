import { getPageLink, getPageLinkOptions } from '@/lib/page-link';
import { parseRequest } from '@/lib/request';
import { badRequest, forbidden, json, notFound } from '@/lib/response';
import { canViewWebsite } from '@/permissions';
import { getWebsite } from '@/queries/prisma/website';
import { websiteIdPathSchema } from '../../response-schema';
import { pageLinksQuerySchema } from './schema';

const sections = [
  'overview',
  'realtime',
  'events',
  'sessions',
  'compare',
  'breakdown',
  'funnels',
  'journeys',
  'retention',
  'goals',
  'utm',
  'revenue',
  'attribution',
  'performance',
  'heatmaps',
  'errors',
  'replays',
  'segments',
  'cohorts',
] as const;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const { auth, query, error } = await parseRequest(request, pageLinksQuerySchema);
  if (error) return error();
  const path = websiteIdPathSchema.safeParse(await params);
  if (!path.success) return badRequest();
  const { websiteId } = path.data;
  // These are authenticated dashboard links, not public share URLs.
  if (!auth.user || !(await canViewWebsite(auth, websiteId))) return forbidden();
  const website = await getWebsite(websiteId);
  if (!website || website.deletedAt) return notFound();
  const basePath = (process.env.BASE_PATH || '').replace(/\/+$/, '');
  const root = `${basePath}/websites/${websiteId}`;
  const origins = website.pageOrigins || website.domain;

  return json({
    websiteId,
    requiresLogin: true,
    queryApplied: false,
    pages: sections.map(id => ({ id, path: id === 'overview' ? root : `${root}/${id}` })),
    trackedPage: query.pagePath
      ? {
          path: query.pagePath,
          urls: getPageLinkOptions(origins, query.pagePath),
          reason: getPageLink(origins, query.pagePath).reason ?? null,
        }
      : null,
  });
}
