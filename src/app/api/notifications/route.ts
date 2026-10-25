import { queueAppointmentReminders } from '@/lib/notification-events';
import { actor, checkOrigin } from '@/lib/auth';
import { ActivityNotification, Notification, PushDevice } from '@/lib/models';
import { ensure } from '@/lib/rules';
import { failure } from '@/lib/http';
import { pushInput } from '@/lib/push-validation';
import { dispatchNotifications, pushConfig } from '@/lib/notifications';
import { after } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';
async function recipient() {
  const user = await actor();
  ensure(['OWNER', 'STAFF'].includes(user.role), 'Không có quyền xem thông báo.', 403);
  return { scope: { spaId: user.spaId, userId: user.id }, role: user.role, models: [Notification, ActivityNotification] };
}
export async function GET() {
  try {
    const { scope, role, models } = await recipient();
    const results = await Promise.all(models.map(async model => {
      const filter = { ...scope, ...(role === 'STAFF' && model === ActivityNotification ? { kind: 'APPOINTMENT_REMINDER' } : {}) };
      const [items, unread] = await Promise.all([
        model.find(filter).sort({ createdAt: -1 }).limit(30).select('title body url readAt createdAt').lean(),
        model.countDocuments({ ...filter, readAt: null }),
      ]);
      return { items, unread };
    }));
    const items = results.flatMap(result => result.items).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 30);
    const unread = results.reduce((sum, result) => sum + result.unread, 0);
    after(async () => { try { await queueAppointmentReminders(new Date(), scope.spaId); await dispatchNotifications(scope); } catch { console.error('Notification dispatch deferred'); } });
    return Response.json({ items, unread, publicKey: pushConfig()?.publicKey || null }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { scope, role, models } = await recipient();
    const body = await request.json();
    if (body.action === 'readAll') {
      for (const model of models) await model.updateMany({ ...scope, ...(role === 'STAFF' && model === ActivityNotification ? { kind: 'APPOINTMENT_REMINDER' } : {}), readAt: null }, { readAt: new Date() });
    } else if (body.action === 'read') {
      ensure(typeof body.id === 'string' && /^[a-f\d]{24}$/i.test(body.id), 'Thông báo không hợp lệ.');
      for (const model of models) await model.updateOne({ ...scope, ...(role === 'STAFF' && model === ActivityNotification ? { kind: 'APPOINTMENT_REMINDER' } : {}), _id: body.id, readAt: null }, { readAt: new Date() });
    } else if (body.action === 'subscribe') {
      ensure(pushConfig(), 'Chưa cấu hình thông báo đẩy trên máy chủ.', 503);
      const subscription = pushInput.parse(body.subscription);
      await PushDevice.findOneAndUpdate({ endpoint: subscription.endpoint }, { $set: { ...scope, ...subscription } }, { upsert: true, runValidators: true });
    } else if (body.action === 'unsubscribe') {
      ensure(typeof body.endpoint === 'string', 'Thiết bị không hợp lệ.');
      await PushDevice.deleteOne({ ...scope, endpoint: body.endpoint });
    } else ensure(false, 'Thao tác không hợp lệ.');
    return Response.json({ ok: true });
  } catch (error) { return failure(error); }
}
