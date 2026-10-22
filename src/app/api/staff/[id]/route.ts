import { actor } from '@/lib/auth';
import { readStaffProfile } from '@/lib/staff-read';
import { failure } from '@/lib/http';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await actor();
    const { id } = await params;
    return Response.json(await readStaffProfile(user, id), { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) { return failure(error); }
}
