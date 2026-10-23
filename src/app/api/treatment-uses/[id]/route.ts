import { actor } from '@/lib/auth';
import { TreatmentUse } from '@/lib/models';
import { failure } from '@/lib/http';
import { ensure } from '@/lib/rules';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await actor();
    ensure(['OWNER', 'STAFF'].includes(user.role), 'Bạn không có quyền truy cập.', 403);
    const { id } = await params;
    ensure(/^[a-f\d]{24}$/i.test(id), 'ID không hợp lệ.');
    const use = await TreatmentUse.findOne({ _id: id, spaId: user.spaId }).select('+signature').lean();
    ensure(use, 'Không tìm thấy buổi liệu trình.', 404);
    ensure(user.role === 'OWNER' || String(use.actorId) === user.id || String(use.staffId) === user.id, 'Chỉ xem chữ ký buổi mình thực hiện.', 403);
    return Response.json({ signature: use.signature || null, snapshot: use.snapshot ? JSON.parse(use.snapshot) : null,
      performedAt: use.performedAt, digest: use.digest }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) { return failure(error); }
}
