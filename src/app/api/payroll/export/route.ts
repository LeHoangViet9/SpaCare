import { actor } from '@/lib/auth';
import { commissionExport } from '@/lib/export-read';
import { payrollQuery } from '@/lib/payroll-read';
import { failure } from '@/lib/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const user = await actor();
    const query = payrollQuery(new URL(request.url).searchParams);
    return Response.json(await commissionExport(user, query.month, query.employee), { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) { return failure(error); }
}
