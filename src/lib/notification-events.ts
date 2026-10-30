import { invoiceCode } from './invoice-code';
import { appointmentServiceName } from './appointment-services';
import mongoose, { type ClientSession } from 'mongoose';
import { ActivityNotification, Appointment, Control, Customer, Day, Notification, Service, User } from './models';
import { spaDay } from './rules';
import { formatCurrency } from './currency';

export async function queueInvoiceNotifications(invoice: any, session: ClientSession) {
  if (invoice.openingBalance) return;
  const scope = { spaId: invoice.spaId };
  const customer = await Customer.findOne({ ...scope, _id: invoice.customerId }).session(session);
  const owners = await User.find({ ...scope, active: true, role: 'OWNER' }).session(session);
  for (const owner of owners) {
    await ActivityNotification.create([{ ...scope, userId: owner._id, kind: 'INVOICE_CREATED',
      eventKey: `invoice:${invoice._id}`, invoiceId: invoice._id,
      title: 'Hóa đơn mới ' + invoiceCode(invoice),
      body: `${customer?.name || 'Khách hàng'} · ${invoice.description || 'Dịch vụ'} · Tổng ${formatCurrency(invoice.total)} · Người lập: ${invoice.creatorName || 'SpaCare'}`,
      url: `/workspace/invoices?search=${invoice._id}`,
    }], { session });
  }
}

export async function queueAppointmentCreatedNotifications(appointment: any, session: ClientSession) {
  const scope = { spaId: appointment.spaId };
  const recipients = await User.find({
    ...scope,
    active: true,
    $or: [{ role: 'OWNER' }, ...(appointment.staffId ? [{ _id: appointment.staffId, role: 'STAFF' }] : [])],
  }).session(session);
  const services = (appointment.requestedServices || []).map((item: { name?: string }) => item.name).filter(Boolean);
  const startAt = new Date(appointment.startAt);
  const time = startAt.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  for (const recipient of recipients) {
    await Notification.create([{
      ...scope,
      userId: recipient._id,
      appointmentId: appointment._id,
      title: 'Lịch hẹn mới được tạo',
      body: `${services.join(' + ') || 'Dịch vụ đã đặt'} · ${time}`,
      url: `/workspace/appointments?search=${appointment._id}`,
    }], { session });
  }
}

// One reminder per owner/spa/day; shares the financial write guard with closeDay.
export async function queueClosingReminders(now = new Date(), spaId?: string) {
  const day = spaDay(now);
  if (now < new Date(day + 'T22:00:00+07:00')) return 0;
  const owners = await User.find({ ...(spaId ? { spaId } : {}), active: true, role: 'OWNER' }).select('_id spaId').lean();
  const groups = new Map<string, typeof owners>();
  for (const owner of owners) {
    const id = String(owner.spaId);
    groups.set(id, [...groups.get(id) || [], owner]);
  }
  let total = 0;
  for (const [spaId, people] of groups) {
    const count = await mongoose.connection.transaction(async session => {
      const guard = await Control.findOneAndUpdate({ spaId }, { $inc: { revision: 1 } }, { session, returnDocument: 'after' });
      if (!guard) return 0;
      const closed = await Day.findOne({ spaId, day }).session(session);
      if (closed?.status === 'CLOSED') return 0;
      let created = 0;
      for (const person of people) {
        // Revalidate membership inside the transaction, not just from the initial scan.
        const owner = await User.exists({ _id: person._id, spaId, role: 'OWNER', active: true }).session(session);
        if (!owner) continue;
        const filter = { spaId, userId: person._id, eventKey: `day-close:${day}` };
        if (await ActivityNotification.exists(filter).session(session)) continue;
        await ActivityNotification.create([{ ...filter, kind: 'DAY_CLOSE', day,
          title: 'Nhắc kiểm kê tiền và chốt sổ',
          body: `Đã đến 22h. Sổ ngày ${day.split('-').reverse().join('/')} ${closed ? 'chưa được chốt' : 'chưa được mở/chốt'}. Kiểm đếm tiền thực tế, đối chiếu thu chi và chốt sổ trên SpaCare.`,
          url: '/workspace/days',
        }], { session });
        created++;
      }
      return created;
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
    total += count;
  }
  return total;
}


// Scan only the next ten minutes. Versioned keys allow a new reminder after rescheduling.
export async function queueAppointmentReminders(now = new Date(), spaId?: string) {
  const visits = await Appointment.find({ ...(spaId ? { spaId } : {}), status: 'CONFIRMED',
    startAt: { $gt: now, $lte: new Date(now.getTime() + 10 * 60_000) } }).select('_id spaId startAt').lean();
  let total = 0;
  for (const candidate of visits) {
    const created = await mongoose.connection.transaction(async session => {
      const scope = { spaId: candidate.spaId };
      const guard = await Control.findOneAndUpdate(scope, { $inc: { revision: 1 } }, { session, returnDocument: 'after' });
      if (!guard) return 0;
      const visit = await Appointment.findOne({ ...scope, _id: candidate._id, status: 'CONFIRMED',
        startAt: { $gt: now, $lte: new Date(now.getTime() + 10 * 60_000) } }).session(session);
      if (!visit) return 0;
      const people = await User.find({ ...scope, active: true,
        ...(visit.bookingSource === 'PUBLIC_WEB' ? { role: { $in: ['OWNER', 'STAFF'] } } : { $or: [{ role: 'OWNER' }, ...(visit.staffId ? [{ _id: visit.staffId, role: 'STAFF' }] : [])] }),
      }).session(session);
      const customer = await Customer.findOne({ ...scope, _id: visit.customerId }).session(session);
      const service = visit.requestedServices?.length ? null : await Service.findOne({ ...scope, _id: visit.serviceId }).select('name').session(session);
      const services = appointmentServiceName(visit, service?.name || 'Dịch vụ đã đặt');
      const startAt = new Date(visit.startAt);
      const at = startAt.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
      let count = 0;
      for (const person of people) {
        const filter = { ...scope, userId: person._id, eventKey: `appointment:${visit._id}:${startAt.toISOString()}` };
        if (await ActivityNotification.exists(filter).session(session)) continue;
        await ActivityNotification.create([{ ...filter, kind: 'APPOINTMENT_REMINDER', appointmentId: visit._id, appointmentStartAt: startAt,
          title: 'Sắp đến giờ đón khách',
          body: `${customer?.name || 'Khách hàng'}${customer?.phone ? ' - ' + customer.phone : ''} · ${services} · Giờ hẹn ${at}.`,
          url: `/workspace/appointments?search=${visit._id}`,
        }], { session });
        count++;
      }
      return count;
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
    total += created;
  }
  return total;
}
