import { actor } from '@/lib/auth';
import { payrollQuery, readPayroll } from '@/lib/payroll-read';
import { failure } from '@/lib/http';
import { ensure } from '@/lib/rules';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const user = await actor();
    ensure(['OWNER', 'STAFF'].includes(user.role), 'Bạn không có quyền truy cập.', 403);
    const query = payrollQuery(new URL(request.url).searchParams);
    return Response.json(await readPayroll(user, query), { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) { return failure(error); }
}
