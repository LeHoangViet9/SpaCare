import { actor } from '@/lib/auth';
import { readCustomerHistory } from '@/lib/customer-history';
import { failure } from '@/lib/http';
import { ensure } from '@/lib/rules';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await actor();
    ensure(['OWNER', 'STAFF'].includes(user.role), 'Bạn không có quyền truy cập.', 403);
    const { id } = await params;
    const query = new URL(request.url).searchParams;
    const kind = z.enum(['invoices', 'appointments', 'treatments']).parse(query.get('kind') || 'invoices');
    const requested = z.coerce.number().int().min(1).max(1000000).parse(query.get('page') || 1);
    return Response.json(await readCustomerHistory(user, id, kind, requested), { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) { return failure(error); }
}
