import { actor } from '@/lib/auth';
import { customerQuery } from '@/lib/customer-query';
import { findCustomerPage } from '@/lib/customer-search';
import { failure } from '@/lib/http';
import { ensure } from '@/lib/rules';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await actor();
    ensure(['OWNER', 'STAFF'].includes(user.role), 'Bạn không có quyền truy cập.', 403);
    const query = customerQuery(new URL(request.url).searchParams);
    return Response.json(await findCustomerPage(user.spaId, query, user), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return failure(error); }
}
