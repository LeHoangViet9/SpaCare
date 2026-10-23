import { hash } from './password';
export { hash, hashPassword, verifyPassword } from './password';
import { cookies } from 'next/headers';
import { connect } from './db';
import { Session, User } from './models';
import { ensure } from './rules';

export type Actor = {
  id: string;
  spaId: string;
  name: string;
  role: 'OWNER' | 'STAFF' | 'CUSTOMER';
  cashier: boolean;
  customerId?: string;
};

export async function actor(): Promise<Actor> {
  const token = (await cookies()).get('spacare_session')?.value;
  ensure(token, 'Vui lòng đăng nhập.', 401);
  await connect();
  const session = await Session.findOne({
    tokenHash: hash(token),
    expiresAt: { $gt: new Date() },
  });
  ensure(session, 'Phiên đăng nhập đã hết hạn.', 401);
  const user = await User.findOne({
    _id: session.userId,
    spaId: session.spaId,
    active: true,
  });
  ensure(user, 'Tài khoản không hoạt động.', 401);
  return {
    id: String(user._id),
    spaId: String(user.spaId),
    name: user.name,
    role: user.role,
    cashier: !!user.cashier,
    customerId: user.customerId ? String(user.customerId) : undefined,
  };
}

export async function maybeActor(): Promise<Actor | null> {
  try {
    const token = (await cookies()).get('spacare_session')?.value;
    if (!token) return null;
    await connect();
    const session = await Session.findOne({
      tokenHash: hash(token),
      expiresAt: { $gt: new Date() },
    });
    if (!session) return null;
    const user = await User.findOne({
      _id: session.userId,
      spaId: session.spaId,
      active: true,
    });
    if (!user) return null;
    return {
      id: String(user._id),
      spaId: String(user.spaId),
      name: user.name,
      role: user.role,
      cashier: !!user.cashier,
      customerId: user.customerId ? String(user.customerId) : undefined,
    };
  } catch {
    return null;
  }
}

export function checkOrigin(request: Request) {
  const configured = process.env.APP_ORIGIN;
  ensure(
    configured && request.headers.get('origin') === new URL(configured).origin,
    'Nguồn yêu cầu không hợp lệ.',
    403,
  );
}
