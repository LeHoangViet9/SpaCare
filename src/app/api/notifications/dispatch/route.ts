import { queueAppointmentReminders } from '@/lib/notification-events';
import { timingSafeEqual } from 'node:crypto';
import { connect } from '@/lib/db';
import { dispatchNotifications } from '@/lib/notifications';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get('authorization') || '';
  const expected = `Bearer ${secret}`;
  if (!secret || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected)))
    return Response.json({ error: 'Không có quyền.' }, { status: 401 });
  try { await connect(); await queueAppointmentReminders(); await dispatchNotifications(); return Response.json({ ok: true }); }
  catch { return Response.json({ error: 'Chưa gửi được thông báo.' }, { status: 503 }); }
}
