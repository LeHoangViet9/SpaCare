import { timingSafeEqual } from 'node:crypto';
import { connect } from '@/lib/db';
import { queueClosingReminders } from '@/lib/notification-events';
import { dispatchNotifications } from '@/lib/notifications';
import { assertWritesAllowed } from '@/lib/write-freeze';
export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get('authorization') || '';
  const expected = `Bearer ${secret}`;
  if (!secret || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected)))
    return Response.json({ error: 'Không có quyền.' }, { status: 401 });
  try {
    assertWritesAllowed();
    await connect();
    await queueClosingReminders();
    await dispatchNotifications();
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'Chưa gửi được nhắc chốt sổ.' }, { status: 503 }); }
}
