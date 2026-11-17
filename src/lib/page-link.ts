export type PageLinkResult = { url: string; reason?: never } | { url?: never; reason: string };

export function validPageOrigins(value: string | null | undefined) {
  if (!value) return true; // Empty means use the existing Website.domain.
  return value.split(',').every(origin => {
    const result = getPageLink(origin, '/');
    return !!result.url;
  });
}

export function getPageLinkOptions(origins: string | null | undefined, path: string) {
  const target = getPageLink(origins, path);
  if (target.url) return [target.url];
  if (target.reason !== 'ambiguousDomain') return [];
  return [
    ...new Set(
      origins
        .split(',')
        .map(origin => getPageLink(origin, path).url)
        .filter(Boolean),
    ),
  ];
}

/** Website.domain is the administrator-managed allowlist; observed hostnames aren't trusted. */
export function getPageLink(domain: string | null | undefined, path: string): PageLinkResult {
  if (!domain?.trim()) return { reason: 'missingDomain' };
  const origins: URL[] = [];
  try {
    for (const item of domain.split(',').map(value => value.trim())) {
      if (!item || item.startsWith('//') || /[\\\s]/.test(item)) return { reason: 'invalidDomain' };
      const base = new URL(/^https?:\/\//i.test(item) ? item : `https://${item}`);
      if (
        !['https:', 'http:'].includes(base.protocol) ||
        base.username ||
        base.password ||
        base.pathname !== '/' ||
        base.search ||
        base.hash
      )
        return { reason: 'invalidDomain' };
      origins.push(base);
    }
    if (
      !path ||
      Array.from(path).some(
        char => char === '\\' || char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
      ) ||
      path.startsWith('//')
    ) {
      return { reason: 'invalidPage' };
    }
    const absolute = /^https?:\/\//i.test(path);
    if (!absolute && !path.startsWith('/')) return { reason: 'invalidPage' };
    if (!absolute && origins.length !== 1) return { reason: 'ambiguousDomain' };
    const target = new URL(path.replaceAll(' ', '%20'), origins[0]);
    if (
      target.username ||
      target.password ||
      !origins.some(base => base.origin === target.origin)
    ) {
      return { reason: 'untrustedPage' };
    }
    return { url: target.href };
  } catch {
    return { reason: 'invalidPage' };
  }
}
