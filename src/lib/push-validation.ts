import { z } from 'zod';

// Do not allow an authenticated caller to turn the sender into an arbitrary HTTP proxy.
export function allowedPushEndpoint(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      (['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'].includes(url.hostname) ||
        url.hostname.endsWith('.notify.windows.com'));
  } catch { return false; }
}
export const pushInput = z.object({
  endpoint: z.string().max(4096).refine(allowedPushEndpoint),
  keys: z.object({
    p256dh: z.string().regex(/^[A-Za-z0-9_-]{87}$/),
    auth: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
  }),
});
