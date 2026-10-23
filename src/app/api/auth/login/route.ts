import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { loginInput } from '@/lib/login-identity';
import { connect } from '@/lib/db';
import { LoginAttempt, Session, User } from '@/lib/models';
import { checkOrigin, hash, hashPassword, verifyPassword } from '@/lib/auth';
import { ensure } from '@/lib/rules';
import { failure } from '@/lib/http';
const dummyHash = hashPassword('dummy-password-for-timing-check');
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { identity, password } = loginInput.parse(await request.json());
    await connect();
    // Server-owned time bucket; no spoofable forwarded IP is trusted for throttling.
    const key = hash(`${identity.kind}:${identity.value}:${Math.floor(Date.now() / 900_000)}`);
    const attempt = await LoginAttempt.findOneAndUpdate({ key }, { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(Date.now() + 1800_000) } }, { upsert: true, new: true });
    ensure(attempt.count <= 10, 'Thử đăng nhập quá nhiều. Vui lòng chờ tối đa 15 phút.', 429);
    const user = await User.findOne({ [identity.kind]: identity.value, active: true }).select('+passwordHash');
    const valid = verifyPassword(password, user?.passwordHash || dummyHash);
    ensure(user && valid, 'Số điện thoại/email hoặc mật khẩu không đúng.', 401);
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 8 * 3600_000);
    await Session.create({ spaId: user.spaId, userId: user._id, tokenHash: hash(token), expiresAt });
    (await cookies()).set('spacare_session', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', expires: expiresAt, path: '/' });
    return Response.json({ ok: true, role: user.role, name: user.name });
  } catch (e) { return failure(e); }
}
