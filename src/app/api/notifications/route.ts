import { actor, checkOrigin } from '@/lib/auth';
import { Notification, PushDevice } from '@/lib/models';
import { ensure } from '@/lib/rules';
import { failure } from '@/lib/http';
import { pushInput } from '@/lib/push-validation';
import { dispatchNotifications, pushConfig } from '@/lib/notifications';
import { after } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';
async function owner() {
  const user = await actor();
  ensure(user.role === 'OWNER', 'Chỉ chủ spa được nhận thông báo này.', 403);
  return { spaId: user.spaId, userId: user.id };
}
export async function GET() {
  try {
    const scope = await owner();
    const items = await Notification.find(scope).sort({ createdAt: -1 }).limit(30)
      .select('title body url readAt createdAt').lean();
    const unread = await Notification.countDocuments({ ...scope, readAt: null });
    after(async () => { try { await dispatchNotifications(scope); } catch { console.error('Notification dispatch deferred'); } });
    return Response.json({ items, unread, publicKey: pushConfig()?.publicKey || null },
      { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const scope = await owner();
    const body = await request.json();
    if (body.action === 'readAll') {
      await Notification.updateMany({ ...scope, readAt: null }, { readAt: new Date() });
    } else if (body.action === 'read') {
      ensure(typeof body.id === 'string' && /^[a-f\d]{24}$/i.test(body.id), 'Thông báo không hợp lệ.');
      await Notification.updateOne({ ...scope, _id: body.id, readAt: null }, { readAt: new Date() });
    } else if (body.action === 'subscribe') {
      ensure(pushConfig(), 'Chưa cấu hình thông báo đẩy trên máy chủ.', 503);
      const subscription = pushInput.parse(body.subscription);
      // A shared browser changes ownership only after explicit permission from its signed-in owner.
      await PushDevice.findOneAndUpdate({ endpoint: subscription.endpoint },
        { $set: { ...scope, ...subscription } }, { upsert: true, runValidators: true });
    } else if (body.action === 'unsubscribe') {
      ensure(typeof body.endpoint === 'string', 'Thiết bị không hợp lệ.');
      await PushDevice.deleteOne({ ...scope, endpoint: body.endpoint });
    } else ensure(false, 'Thao tác không hợp lệ.');
    return Response.json({ ok: true });
  } catch (error) { return failure(error); }
}
