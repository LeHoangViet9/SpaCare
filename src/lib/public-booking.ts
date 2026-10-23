import mongoose from 'mongoose';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Actor } from './auth';
import { Appointment, Audit, Control, Customer, Idempotency, Service, User, Notification } from './models';
import { ensure, withinSpaHours } from './rules';

export const publicBookingInput = z.object({
  serviceId: z.string().regex(/^[a-f\d]{24}$/i),
  startAt: z.string().datetime({ offset: true }),
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().transform(value => value.replace(/[\s().-]/g, '').replace(/^\+84/, '0'))
    .pipe(z.string().regex(/^0\d{9,10}$/, 'Số điện thoại không hợp lệ.')),
  notes: z.string().trim().max(500).default(''),
});

export async function reservePublicBooking(raw: unknown, actor: Actor | null, key: string) {
  const input = publicBookingInput.parse(raw);
  ensure(z.string().uuid().safeParse(key).success, 'Mã yêu cầu đặt lịch không hợp lệ.');
  const fingerprint = createHash('sha256').update(JSON.stringify({ input, actorId: actor?.id || null })).digest('hex');
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const service = await Service.findOne({ _id: input.serviceId, active: true }).session(session);
      ensure(service, 'Dịch vụ không tồn tại hoặc đã ngừng cung cấp.', 404);
      const scope = { spaId: service.spaId };
      // Serialize with internal appointment changes using the same guard.
      const guard = await Control.findOneAndUpdate(scope, { $inc: { revision: 1 } }, { session, returnDocument: 'after' });
      ensure(guard, 'Spa chưa sẵn sàng nhận lịch trực tuyến.', 503);
      const currentUser = actor ? await User.findOne({ ...scope, _id: actor.id, active: true }).session(session) : null;
      if (actor) ensure(currentUser, 'Tài khoản không hoạt động hoặc không thuộc spa này.', 403);
      const previous = await Idempotency.findOne({ ...scope, key }).session(session);
      if (previous) {
        ensure(previous.fingerprint === fingerprint, 'Mã yêu cầu đã dùng cho nội dung khác.', 409);
        return previous.result;
      }
      const startAt = new Date(input.startAt);
      const duration = service.duration || 60;
      const endAt = new Date(startAt.getTime() + duration * 60_000);
      ensure(startAt > new Date(), 'Thời gian đặt lịch phải ở tương lai.');
      ensure(withinSpaHours(startAt, endAt), 'Lịch phải nằm trong giờ hoạt động 09:00–22:00.');
      const staff = await User.find({ ...scope, active: true, role: { $in: ['OWNER', 'STAFF'] } }).sort({ _id: 1 }).session(session);
      ensure(staff.length, 'Chưa có nhân viên phục vụ sẵn sàng.', 503);
      let staffId;
      for (const person of staff) {
        const occupied = await Appointment.exists({ ...scope, staffId: person._id, status: 'CONFIRMED',
          startAt: { $lt: endAt }, endAt: { $gt: startAt } }).session(session);
        if (!occupied) { staffId = person._id; break; }
      }
      ensure(staffId, 'Khung giờ này đã có lịch, vui lòng chọn giờ khác.', 409);

      let customer;
      if (currentUser?.role === 'CUSTOMER') {
        ensure(currentUser.customerId, 'Tài khoản chưa liên kết hồ sơ khách hàng.', 403);
        customer = await Customer.findOne({ ...scope, _id: currentUser.customerId }).session(session);
        ensure(customer, 'Không tìm thấy hồ sơ khách hàng.', 403);
      } else {
        customer = await Customer.findOne({ ...scope, phone: input.phone }).session(session);
        if (!customer) [customer] = await Customer.create([{ ...scope, name: input.name, phone: input.phone,
          notes: 'Khách hàng đặt lịch trực tuyến' }], { session });
      }
      const [appointment] = await Appointment.create([{ ...scope, customerId: customer._id, serviceId: service._id,
        staffId, startAt, endAt, status: 'CONFIRMED', notes: input.notes || 'Khách đặt qua website công khai' }], { session });
      const result = { ok: true, appointmentId: String(appointment._id), serviceName: service.name,
        startAt: startAt.toISOString(), duration };
      await Audit.create([{ ...scope, actorId: currentUser?._id || customer._id, action: 'publicBooking', targetId: appointment._id,
        details: { source: 'PUBLIC_WEB', actorKind: currentUser ? 'USER' : 'GUEST_CUSTOMER', customerId: customer._id, staffId, startAt, endAt } }], { session });
      for (const owner of staff.filter(person => person.role === 'OWNER')) {
        await Notification.create([{ ...scope, userId: owner._id, appointmentId: appointment._id,
          title: 'Lịch đặt online mới',
          body: `${customer.name || input.name} · ${service.name} · ${startAt.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`,
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
