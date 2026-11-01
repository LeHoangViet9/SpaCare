import { z } from 'zod';

// Do not allow an authenticated caller to turn the sender into an arbitrary HTTP proxy.
export function allowedPushEndpoint(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      (['fcm.googleapis.com', 'android.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'].includes(url.hostname) ||
        url.hostname === 'push.apple.com' || url.hostname.endsWith('.push.apple.com') ||
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

// Converts a URL-safe Base64URL string (with - and _) to a standard Uint8Array
// by replacing characters, computing exact padding, and decoding via atob.
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
