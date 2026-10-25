import { CUSTOMER_ACCESS_NOTICE } from './customer-access';
import mongoose from 'mongoose';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Actor } from './auth';
import { Appointment, Audit, Control, Customer, Idempotency, Service, User, Notification } from './models';
import { ensure, withinArrivalHours } from './rules';

export const publicBookingInput = z.object({
  serviceId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  serviceIds: z.array(z.string().regex(/^[a-f\d]{24}$/i).transform(id => id.toLowerCase())).min(1).max(30).refine(ids => new Set(ids).size === ids.length, 'Không chọn trùng dịch vụ.').optional(),
  startAt: z.string().datetime({ offset: true }),
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().transform(value => value.replace(/[\s().-]/g, '').replace(/^\+84/, '0'))
    .pipe(z.string().regex(/^0\d{9,10}$/, 'Số điện thoại không hợp lệ.')),
  notes: z.string().trim().max(500).default(''),
}).refine(input => !!input.serviceId !== !!input.serviceIds, 'Chọn từ 1 đến 30 dịch vụ.');

export async function reservePublicBooking(raw: unknown, actor: Actor | null, key: string) {
  ensure(actor?.role !== 'CUSTOMER', CUSTOMER_ACCESS_NOTICE, 403);
  const input = publicBookingInput.parse(raw);
  ensure(z.string().uuid().safeParse(key).success, 'Mã yêu cầu đặt lịch không hợp lệ.');
  const fingerprint = createHash('sha256').update(JSON.stringify({ input, actorId: actor?.id || null })).digest('hex');
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const serviceIds = input.serviceIds || [input.serviceId!];
      const service = await Service.findOne({ _id: serviceIds[0], active: true }).session(session);
      ensure(service, 'Dịch vụ không tồn tại hoặc đã ngừng cung cấp.', 404);
      const scope = { spaId: service.spaId };
      // Serialize with internal appointment changes using the same guard.
      const guard = await Control.findOneAndUpdate(scope, { $inc: { revision: 1 } }, { session, returnDocument: 'after' });
      ensure(guard, 'Spa chưa sẵn sàng nhận lịch trực tuyến.', 503);
      const currentUser = actor ? await User.findOne({ ...scope, _id: actor.id, active: true }).session(session) : null;
      if (actor) ensure(currentUser, 'Tài khoản không hoạt động hoặc không thuộc spa này.', 403);
      ensure(currentUser?.role !== 'CUSTOMER', CUSTOMER_ACCESS_NOTICE, 403);
      const previous = await Idempotency.findOne({ ...scope, key }).session(session);
      if (previous) {
        ensure(previous.fingerprint === fingerprint, 'Mã yêu cầu đã dùng cho nội dung khác.', 409);
        return previous.result;
      }
      const requestedServices = [{ serviceId: service._id, name: service.name }];
      for (const id of serviceIds.slice(1)) {
        const next = await Service.findOne({ ...scope, _id: id, active: true }).session(session);
        ensure(next, 'Dịch vụ không thuộc spa hoặc đã ngừng cung cấp.', 404);
        requestedServices.push({ serviceId: next._id, name: next.name });
      }
      const serviceName = requestedServices.map(item => item.name).join(' + ');
      const startAt = new Date(input.startAt);
      ensure(startAt > new Date(), 'Thời gian đặt lịch phải ở tương lai.');
      ensure(withinArrivalHours(startAt), 'Giờ đến phải nằm trong 09:00–22:00.');
      const staff = await User.find({ ...scope, active: true, role: { $in: ['OWNER', 'STAFF'] } }).sort({ _id: 1 }).session(session);
      ensure(staff.length, 'Chưa có nhân viên phục vụ sẵn sàng.', 503);
      // Public arrivals are provisionally assigned to the owner; spa manages the queue.
      const staffId = (staff.find(person => person.role === 'OWNER') || staff[0])._id;

      let customer;
      customer = await Customer.findOne({ ...scope, phone: input.phone }).session(session);
      if (!customer) [customer] = await Customer.create([{ ...scope, name: input.name, phone: input.phone,
        notes: 'Khách hàng đặt lịch trực tuyến' }], { session });
      const [appointment] = await Appointment.create([{ ...scope, customerId: customer._id, serviceId: service._id, requestedServices, bookingSource: 'PUBLIC_WEB',
        staffId, startAt, status: 'CONFIRMED', notes: input.notes || 'Khách đặt qua website công khai' }], { session });
      const result = { ok: true, appointmentId: String(appointment._id), serviceName,
        startAt: startAt.toISOString() };
      await Audit.create([{ ...scope, actorId: currentUser?._id || customer._id, action: 'publicBooking', targetId: appointment._id,
        details: { source: 'PUBLIC_WEB', actorKind: currentUser ? 'USER' : 'GUEST_CUSTOMER', customerId: customer._id, staffId, startAt, requestedServices } }], { session });
      for (const owner of staff) {
        await Notification.create([{ ...scope, userId: owner._id, appointmentId: appointment._id,
          title: 'Lịch đặt online mới',
          body: `${customer.name || input.name} · ${input.phone} · ${serviceName} · ${startAt.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`,
          url: `/workspace/appointments?search=${appointment._id}`,
        }], { session });
      }
      await Idempotency.create([{ ...scope, userId: currentUser?._id || customer._id, key, fingerprint, result }], { session });
      return result;
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
  } finally {
    await session.endSession();
  }
}
