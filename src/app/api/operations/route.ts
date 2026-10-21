import { actor, checkOrigin } from '@/lib/auth';
import { operate } from '@/lib/operations';
import { failure } from '@/lib/http';
import { ensure } from '@/lib/rules';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await actor();
    const raw = await request.text();
    ensure(raw.length <= 65536, 'Yêu cầu quá lớn.', 413);
    let body;
    try { body = JSON.parse(raw); } catch { return Response.json({ error: 'JSON không hợp lệ.' }, { status: 400 }); }
    return Response.json(await operate(user, body.action, body.data, request.headers.get('Idempotency-Key') || ''));
  } catch (e) { return failure(e); }
}
