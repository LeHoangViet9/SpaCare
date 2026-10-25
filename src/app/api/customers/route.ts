import { actor } from '@/lib/auth';
import { customerQuery } from '@/lib/customer-query';
import { findCustomerPage } from '@/lib/customer-search';
import { failure } from '@/lib/http';
import { ensure } from '@/lib/rules';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const started = performance.now();
  try {
    const user = await actor();
    const authenticated = performance.now();
    ensure(['OWNER', 'STAFF'].includes(user.role), 'Bạn không có quyền truy cập.', 403);
    const query = customerQuery(new URL(request.url).searchParams);
    const payload = await findCustomerPage(user.spaId, query, user);
    const finished = performance.now();
    return Response.json(payload, { headers: {
      'Cache-Control': 'no-store',
      'Server-Timing': `auth;dur=${(authenticated - started).toFixed(1)}, data;dur=${(finished - authenticated).toFixed(1)}`,
    } });
  } catch (error) { return failure(error); }
}
