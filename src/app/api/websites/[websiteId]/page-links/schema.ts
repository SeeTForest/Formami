import { z } from 'zod';

export const pageLinksQuerySchema = z.strictObject({
  pagePath: z.string().min(1).max(2048).optional().meta({
    description:
      'Optional tracked page path, e.g. /docs. Resolved only against the website pageOrigins or domain allowlist; no URL is fetched.',
  }),
});

export const pageLinksResponseSchema = z.object({
  websiteId: z.uuid(),
  requiresLogin: z.literal(true),
  queryApplied: z.literal(false).meta({
    description:
      'Dashboard links are navigation entry points. They do not preserve API time ranges, filters, or report configuration.',
  }),
  pages: z.array(
    z.object({
      id: z.string(),
      path: z.string().meta({
        description:
          'Origin-relative dashboard path, including BASE_PATH. Resolve against your trusted Formami origin.',
      }),
    }),
  ),
  trackedPage: z
    .object({
      path: z.string(),
      urls: z.array(z.url()),
      reason: z.string().nullable().meta({
        description:
          'Null for one resolved URL; ambiguousDomain indicates multiple candidates; other values explain why no safe URL could be constructed. Reachability is not checked.',
      }),
    })
    .nullable(),
});
