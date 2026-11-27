// A new path avoids the historic immutable cache key. Authorization is exactly
// the same as the legacy internal route; versioning never grants access.
export { GET } from '@/app/api/product-images/[id]/route';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
