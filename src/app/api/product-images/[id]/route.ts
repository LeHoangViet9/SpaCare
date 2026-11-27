import { actor } from '@/lib/auth';
import { failure } from '@/lib/http';
import { readInternalProductImage } from '@/lib/product-image-read';
import { withProductImageCacheHeaders } from '@/lib/product-image-cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return await readInternalProductImage(await actor(), id);
  } catch (error) {
    return withProductImageCacheHeaders(failure(error));
  }
}
