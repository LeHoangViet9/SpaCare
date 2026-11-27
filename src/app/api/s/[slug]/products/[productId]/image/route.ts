import { connect } from '@/lib/db';
import { failure } from '@/lib/http';
import { readPublicProductImage } from '@/lib/product-image-read';
import { withProductImageCacheHeaders } from '@/lib/product-image-cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string; productId: string }> }) {
  try {
    const { slug, productId } = await params;
    await connect();
    // Public authorization always uses slug + published product, even if a
    // staff session cookie happens to accompany this request.
    return await readPublicProductImage(slug, productId);
  } catch (error) {
    return withProductImageCacheHeaders(failure(error));
  }
}
