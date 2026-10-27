// Exact deployment approved by the user. No suffix or wildcard matching.
export const PREVIEW_ORIGIN = 'https://spacare-7smadvclt-hviet15.vercel.app';
export function allowedConnectTarget(authority) {
  return typeof authority === 'string' &&
    authority.toLowerCase() === 'spacare-7smadvclt-hviet15.vercel.app:443';
}
