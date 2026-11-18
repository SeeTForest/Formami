import type { ApiAuth } from '@/openapi/operation';

export const securitySchemes = {
  accessCollectorKey: {
    type: 'apiKey' as const,
    in: 'header' as const,
    name: 'x-formami-access-key',
    description:
      'Server-only, website-bound credential accepted solely by access-evidence POST. Not an account API key.',
  },
  bearerAuth: {
    type: 'http' as const,
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description:
      'Token returned by POST /api/auth/login, or an API key (`formami_…`) created under Settings → API keys (self-hosted only).',
  },
  shareToken: {
    type: 'apiKey' as const,
    in: 'header' as const,
    name: 'x-formami-share-token',
    description: 'Signed token returned by a share endpoint.',
  },
  shareContext: {
    type: 'apiKey' as const,
    in: 'header' as const,
    name: 'x-formami-share-context',
    description: 'Required context header when authenticating with a share token.',
  },
};

export function getSecurityRequirements(auth: ApiAuth) {
  if (auth === 'none') {
    return [];
  }

  const requirements: Record<string, string[]>[] = [{ bearerAuth: [] }];

  if (auth === 'bearer-or-share') {
    requirements.push({ shareToken: [], shareContext: [] });
  }
  if (auth === 'bearer-or-access-key') requirements.push({ accessCollectorKey: [] });

  return requirements;
}
