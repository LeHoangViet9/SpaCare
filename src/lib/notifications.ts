import { sendPush } from './web-push';
import { Notification, PushDevice, User } from './models';
import { allowedPushEndpoint } from './push-validation';

export function pushConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  return publicKey && privateKey && subject ? { subject, publicKey, privateKey } : null;
}

// Leased outbox: commit bookings before network I/O; crashed senders can retry after the lease.
// Push is at-least-once; the service worker uses a stable tag to replace duplicates.
export async function dispatchNotifications(scope?: { spaId: string; userId?: string }) {
  const config = pushConfig();
  if (!config) return;
  const deadline = Date.now() + 20_000;
  for (let i = 0; i < 20; i++) {
    if (Date.now() >= deadline) break;
    const now = new Date();
    const row = await Notification.findOneAndUpdate({ ...scope, pushState: 'PENDING',
      nextAttemptAt: { $lte: now }, attempts: { $lt: 8 },
    }, { $set: { nextAttemptAt: new Date(Date.now() + 120_000) }, $inc: { attempts: 1 } }, { returnDocument: 'after' });
    if (!row) break;
    const owner = await User.exists({ _id: row.userId, spaId: row.spaId, active: true, role: 'OWNER' });
    if (!owner) { await Notification.updateOne({ _id: row._id }, { pushState: 'SENT' }); continue; }
    const devices = await PushDevice.find({ spaId: row.spaId, userId: row.userId }).limit(20);
    let retry = false;
    for (const device of devices) {
      if (Date.now() >= deadline) { retry = true; break; }
      if (!allowedPushEndpoint(device.endpoint)) continue;
      try {
        await sendPush({ endpoint: device.endpoint, keys: device.keys }, JSON.stringify({
          title: 'SpaCare có lịch hẹn mới', body: 'Mở SpaCare để xem lịch đặt mới.',
          url: row.url, tag: `booking-${row.appointmentId}`,
        }), config);
      } catch (error) {
        const code = (error as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await PushDevice.deleteOne({ _id: device._id });
        else retry = true;
      }
    }
    if (!retry) await Notification.updateOne({ _id: row._id }, { pushState: 'SENT' });
  }
}
