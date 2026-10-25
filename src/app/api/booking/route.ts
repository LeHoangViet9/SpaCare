import { queueAppointmentReminders } from '@/lib/notification-events';
import { connect } from '@/lib/db';
import { checkOrigin, maybeActor } from '@/lib/auth';
import { reservePublicBooking } from '@/lib/public-booking';
import { failure } from '@/lib/http';
import { after } from 'next/server';
import { dispatchNotifications } from '@/lib/notifications';
import { Appointment } from '@/lib/models';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const body = await request.json();
    await connect();
    const actor = await maybeActor();
    const result = await reservePublicBooking(body, actor, request.headers.get('Idempotency-Key') || '');
    after(async () => {
      try {
        const appointment = await Appointment.findById(result.appointmentId).select('spaId');
        if (appointment) { await queueAppointmentReminders(new Date(), String(appointment.spaId)); await dispatchNotifications({ spaId: String(appointment.spaId) }); }
      } catch { console.error('Notification dispatch deferred'); }
    });
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return failure(error);
  }
}
