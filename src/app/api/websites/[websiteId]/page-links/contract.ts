import { defineOperation } from '@/openapi/operation';
import { apiErrorSchema, jsonResponse } from '@/openapi/schemas';
import { websiteIdPathSchema } from '../../response-schema';
import { pageLinksQuerySchema, pageLinksResponseSchema } from './schema';

export const operations = [
  defineOperation({
    method: 'get',
    path: '/api/websites/{websiteId}/page-links',
    audience: 'public',
    auth: 'bearer',
    operation: {
      operationId: 'getWebsitePageLinks',
      summary: 'Get dashboard navigation links and optional tracked page URLs',
      description:
        'Requires a user session or API key with website access. Share tokens are not accepted. Dashboard paths include BASE_PATH, require browser login, and do not apply query filters or time ranges. Optional tracked page URLs use administrator-managed origins; no network requests or reachability guarantees. Feature availability and report configuration are unchanged.',
      tags: ['Websites'],
      requestParams: { path: websiteIdPathSchema, query: pageLinksQuerySchema },
      responses: {
        '200': jsonResponse(pageLinksResponseSchema),
        '400': jsonResponse(apiErrorSchema),
        '401': jsonResponse(apiErrorSchema),
        '403': jsonResponse(apiErrorSchema),
        '404': jsonResponse(apiErrorSchema),
      },
    },
  }),
] as const;
