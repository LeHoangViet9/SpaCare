import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { connect } from '@/lib/db';
import { Customer, Session, Spa, User } from '@/lib/models';
import { checkOrigin, hash, hashPassword } from '@/lib/auth';
import { ensure } from '@/lib/rules';
import { failure } from '@/lib/http';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const body = await request.json();
    const schema = z.object({
      name: z.string().trim().min(2, 'Họ tên cần tối thiểu 2 ký tự.').max(100),
      phone: z.string().trim().min(8, 'Số điện thoại không hợp lệ.').max(20),
      email: z.string().email('Email không hợp lệ.').max(254).toLowerCase().trim(),
      password: z.string().min(6, 'Mật khẩu cần tối thiểu 6 ký tự.').max(128),
    });
    const { name, phone, email, password } = schema.parse(body);

    await connect();
    const spa = await Spa.findOne();
    ensure(spa, 'Hệ thống chưa được thiết lập.', 503);

    const existingUser = await User.findOne({ email });
    ensure(!existingUser, 'Email này đã được sử dụng. Vui lòng đăng nhập.', 409);

    let customer = await Customer.findOne({ spaId: spa._id, phone });
    if (!customer) {
      const created = await Customer.create([{
        spaId: spa._id,
        name,
        phone,
        notes: 'Khách hàng đăng ký trực tuyến',
      }]);
      customer = created[0];
    }

    const createdUsers = await User.create([{
      spaId: spa._id,
      name,
      email,
      passwordHash: hashPassword(password),
      role: 'CUSTOMER',
      customerId: customer._id,
      active: true,
    }]);
    const user = createdUsers[0];

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 8 * 3600_000);
    await Session.create({ spaId: spa._id, userId: user._id, tokenHash: hash(token), expiresAt });
    (await cookies()).set('spacare_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      expires: expiresAt,
      path: '/',
    });

    return Response.json({ ok: true, role: 'CUSTOMER', name: user.name });
  } catch (error) {
    return failure(error);
  }
}
