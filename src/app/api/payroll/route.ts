import { actor } from '@/lib/auth';
import { payrollQuery, readPayroll } from '@/lib/payroll-read';
import { failure } from '@/lib/http';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const user = await actor();
    const query = payrollQuery(new URL(request.url).searchParams);
    return Response.json(await readPayroll(user, query), { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) { return failure(error); }
}
