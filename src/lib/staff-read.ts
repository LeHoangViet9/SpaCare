import { Appointment, Customer, TreatmentUse, User } from './models';
import { ensure } from './rules';
import type { Actor } from './auth';
export async function readStaffProfile(user: Actor, id: string) {
  ensure(user.role === 'OWNER', 'Chỉ chủ spa xem hồ sơ nhân viên.', 403);
  ensure(/^[a-f\d]{24}$/i.test(id), 'ID không hợp lệ.');
  const scope = { spaId: user.spaId };
  const staff = await User.findOne({ ...scope, _id: id, role: { $in: ['OWNER', 'STAFF'] } }).select('name email role cashier active createdAt').lean();
  ensure(staff, 'Không tìm thấy nhân viên.', 404);
  const [appointments, completed, sessions, customers] = await Promise.all([
    Appointment.countDocuments({ ...scope, staffId: id }), Appointment.countDocuments({ ...scope, staffId: id, status: 'COMPLETED' }),
    TreatmentUse.countDocuments({ ...scope, $or: [{ staffId: id }, { staffId: { $exists: false }, actorId: id }] }), Customer.countDocuments({ ...scope, consultantId: id }),
  ]);
  return { staff, summary: { appointments, completed, sessions, customers } };
}
