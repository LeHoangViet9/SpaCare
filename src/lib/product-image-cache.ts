export const PRODUCT_IMAGE_CACHE_CONTROL = 'private, no-store, max-age=0';

// Apply on successful streams AND errors. Keep the browser and supported CDN
// policies explicit; a deployment must not override them with forced caching.
export function withProductImageCacheHeaders(response: Response): Response {
  response.headers.set('Cache-Control', PRODUCT_IMAGE_CACHE_CONTROL);
  response.headers.set('CDN-Cache-Control', 'no-store');
  response.headers.set('Vercel-CDN-Cache-Control', 'no-store');
  return response;
}
