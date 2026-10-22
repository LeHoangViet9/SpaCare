import { actor } from '@/lib/auth';
import { productQuery } from '@/lib/product-rules';
import { readProducts } from '@/lib/product-read';
import { failure } from '@/lib/http';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const user = await actor();
    return Response.json(await readProducts(user, productQuery(new URL(request.url).searchParams)), { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) { return failure(error); }
}
