import { actor } from '@/lib/auth';
import { readInvoice } from '@/lib/invoice-read';
import { failure } from '@/lib/http';
import { ensure } from '@/lib/rules';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await actor();
    ensure(['OWNER', 'STAFF'].includes(user.role), 'Bạn không có quyền truy cập.', 403);
    const page = z.coerce.number().int().min(1).max(1000000).parse(new URL(request.url).searchParams.get('signaturePage') || 1);
    return Response.json(await readInvoice(user, (await params).id, page), { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) { return failure(error); }
}
