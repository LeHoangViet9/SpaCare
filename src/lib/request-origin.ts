type Environment = Record<string, string | undefined>;

function configuredOrigin(value: string | undefined): string | undefined {
  if (!value) return;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash) return;
    return url.origin;
  } catch { return; }
}

function deploymentOrigin(host: string | undefined): string | undefined {
  if (!host || !/^[a-z0-9.-]+$/i.test(host)) return;
  const origin = configuredOrigin('https://' + host);
  return origin === 'https://' + host.toLowerCase() ? origin : undefined;
}

// Only server configuration defines trust. Host, forwarded headers and request
// URLs cannot add origins; NODE_ENV=production does not distinguish Preview.
export function isTrustedRequestOrigin(origin: string | null, env: Environment = process.env): boolean {
  if (!origin || configuredOrigin(origin) !== origin) return false;
  if (env.VERCEL_ENV === 'preview' || env.VERCEL_TARGET_ENV === 'preview') {
    if (env.VERCEL !== '1' || env.VERCEL_ENV !== 'preview' ||
      (env.VERCEL_TARGET_ENV && env.VERCEL_TARGET_ENV !== 'preview')) return false;
    const production = deploymentOrigin(env.VERCEL_PROJECT_PRODUCTION_URL);
    return [env.VERCEL_URL, env.VERCEL_BRANCH_URL]
      .map(deploymentOrigin)
      .some(candidate => candidate !== undefined && candidate !== production && candidate === origin);
  }
  return origin === configuredOrigin(env.APP_ORIGIN);
}
