import { actor } from '@/lib/auth';
import { readStaffProfile } from '@/lib/staff-read';
import { failure } from '@/lib/http';
import { ensure } from '@/lib/rules';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await actor();
    ensure(['OWNER', 'STAFF'].includes(user.role), 'Bạn không có quyền truy cập.', 403);
    const { id } = await params;
    return Response.json(await readStaffProfile(user, id), { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) { return failure(error); }
}
