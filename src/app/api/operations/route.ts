import { queueAppointmentReminders } from '@/lib/notification-events';
import { after } from 'next/server';
import { dispatchNotifications } from '@/lib/notifications';
import { log, requestId, type LogContext } from '@/lib/logger';
import { actor, checkOrigin } from '@/lib/auth';
import { operate } from '@/lib/operations';
import { failure } from '@/lib/http';
import { ensure } from '@/lib/rules';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) {
  const started = Date.now();
  const context: LogContext = { requestId: requestId() };
  try {
    checkOrigin(request);
    const user = await actor();
    ensure(['OWNER', 'STAFF'].includes(user.role), 'Bạn không có quyền thực hiện thao tác quản trị.', 403);
    context.actorId = user.id;
    context.spaId = user.spaId;
    const raw = await request.text();
    ensure(raw.length <= 65536, 'Yêu cầu quá lớn.', 413);
    let body;
    try { body = JSON.parse(raw); } catch { ensure(false, 'JSON không hợp lệ.', 400); }
    // Only record a validated action name; never log the submitted body or idempotency key.
    const result = await operate(user, body?.action, body?.data, request.headers.get('Idempotency-Key') || '');
    if (['appointment', 'rescheduleAppointment', 'invoice', 'serviceInvoice', 'sellPackage', 'sellProduct', 'completeAppointment', 'completeTreatmentAppointment', 'use'].includes(body.action)) {
      after(async () => { try { await queueAppointmentReminders(new Date(), user.spaId); await dispatchNotifications({ spaId: user.spaId }); } catch { console.error('Notification dispatch deferred'); } });
    }
    context.action = body.action;
    log('info', 'operation.completed', { ...context, status: 200, durationMs: Date.now() - started });
    return Response.json(result, { headers: { 'X-Request-Id': context.requestId! } });
  } catch (e) { return failure(e, { ...context, durationMs: Date.now() - started }); }
}
