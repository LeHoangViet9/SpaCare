import { sendPush } from './web-push';
import { ActivityNotification, Appointment, Day, Notification, PushDevice, User } from './models';
import { spaDay } from './rules';
import { allowedPushEndpoint } from './push-validation';
import { assertWritesAllowed } from './write-freeze';

export function pushConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  return publicKey && privateKey && subject ? { subject, publicKey, privateKey } : null;
}

export function notificationPayload(row: { _id: unknown; title?: string; body?: string; url?: string }) {
  return { title: Array.from(row.title || 'Thông báo SpaCare').slice(0, 80).join(''),
    body: Array.from(row.body || 'Mở SpaCare để xem chi tiết.').slice(0, 500).join(''),
    url: row.url || '/workspace', tag: `spacare-${row._id}` };
}

// Leased outbox: commit business writes before network I/O; retain transient failures.
export async function dispatchNotifications(scope?: { spaId: string; userId?: string }) {
  assertWritesAllowed();
  const config = pushConfig();
  if (!config) return;
  const deadline = Date.now() + 20_000;
  for (let i = 0; i < 20; i++) {
    if (Date.now() >= deadline) break;
    const claim = { ...scope, pushState: 'PENDING', nextAttemptAt: { $lte: new Date() }, attempts: { $lt: 8 } };
    const update = { $set: { nextAttemptAt: new Date(Date.now() + 120_000) }, $inc: { attempts: 1 } };
    let source = Notification;
    let row = await Notification.findOneAndUpdate(claim, update, { returnDocument: 'after' });
    if (!row) {
      source = ActivityNotification;
      row = await ActivityNotification.findOneAndUpdate(claim, update, { returnDocument: 'after' });
    }
    if (!row) break;
    const recipient = await User.exists({ _id: row.userId, spaId: row.spaId, active: true,
      role: source === Notification || row.kind === 'APPOINTMENT_REMINDER' ? { $in: ['OWNER', 'STAFF'] } : 'OWNER' });
    if (!recipient) { await source.updateOne({ _id: row._id }, { pushState: 'SENT' }); continue; }
    if (row.kind === 'DAY_CLOSE' && (row.day !== spaDay() || await Day.exists({ spaId: row.spaId, day: row.day, status: 'CLOSED' }))) {
      await source.updateOne({ _id: row._id }, { pushState: 'SENT', readAt: new Date() }); continue;
    }
    let ttl = 3600;
    if (row.kind === 'APPOINTMENT_REMINDER') {
      const visit = await Appointment.findOne({ _id: row.appointmentId, spaId: row.spaId, status: 'CONFIRMED' }).select('startAt staffId bookingSource').lean();
      const valid = visit && +new Date(visit.startAt) === +new Date(row.appointmentStartAt) && +new Date(visit.startAt) > Date.now();
      // Internal visits stay private to their assigned staff and owners after reassignment.
      const allowed = valid && (visit.bookingSource === 'PUBLIC_WEB' || String(visit.staffId) === String(row.userId) || await User.exists({ _id: row.userId, spaId: row.spaId, active: true, role: 'OWNER' }));
      if (!allowed) { await source.updateOne({ _id: row._id }, { pushState: 'SENT', readAt: new Date() }); continue; }
      ttl = Math.min(600, Math.max(1, Math.floor((+new Date(visit.startAt) - Date.now()) / 1000)));
    }
    const devices = await PushDevice.find({ spaId: row.spaId, userId: row.userId }).limit(20);
    let retry = false;
    for (const device of devices) {
      if (Date.now() >= deadline) { retry = true; break; }
      if (!allowedPushEndpoint(device.endpoint)) continue;
      try {
        await sendPush({ endpoint: device.endpoint, keys: device.keys }, JSON.stringify(notificationPayload(row)), config, ttl);
      } catch (error) {
        const code = (error as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await PushDevice.deleteOne({ _id: device._id });
        else retry = true;
      }
    }
    if (!retry) await source.updateOne({ _id: row._id }, { pushState: 'SENT' });
  }
}
