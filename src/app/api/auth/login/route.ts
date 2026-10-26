import { log, requestId } from '@/lib/logger';
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
  const id = requestId();
  const started = Date.now();
  let stage = 'loginValidation';
  try {
    checkOrigin(request);
    const { identity, password } = loginInput.parse(await request.json());
    stage = 'loginConnect';
    await connect();
    stage = 'loginThrottle';
    // Server-owned time bucket; no spoofable forwarded IP is trusted for throttling.
    const key = hash(`${identity.kind}:${identity.value}:${Math.floor(Date.now() / 900_000)}`);
    const attempt = await LoginAttempt.findOneAndUpdate({ key }, { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(Date.now() + 1800_000) } }, { upsert: true, returnDocument: 'after' });
    ensure(attempt.count <= 10, 'Thử đăng nhập quá nhiều. Vui lòng chờ tối đa 15 phút.', 429);
    stage = 'loginUser';
    const user = await User.findOne({ [identity.kind]: identity.value, active: true }).select('+passwordHash');
    stage = 'loginPassword';
    const valid = verifyPassword(password, user?.passwordHash || dummyHash);
    ensure(user && valid, 'Số điện thoại/email hoặc mật khẩu không đúng.', 401);
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 8 * 3600_000);
    stage = 'loginSession';
    await Session.create({ spaId: user.spaId, userId: user._id, tokenHash: hash(token), expiresAt });
    stage = 'loginCookie';
    (await cookies()).set('spacare_session', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', expires: expiresAt, path: '/' });
    log('info', 'auth.login.completed', { requestId: id, actorId: String(user._id), spaId: String(user.spaId), status: 200, durationMs: Date.now() - started });
    return Response.json({ ok: true, role: user.role, name: user.name }, { headers: { 'X-Request-Id': id } });
  } catch (e) {
    // Fixed stage and numeric driver code only. Never log raw error messages,
    // stack traces, identity, password, connection strings or session tokens.
    const numericCode = (e as { code?: unknown } | null)?.code;
    if (typeof numericCode === 'number' && Number.isSafeInteger(numericCode) && numericCode >= 0) {
      log('error', 'request.failed', { requestId: id, action: stage, code: 'LOGIN_DRIVER_' + numericCode });
    }
    return failure(e, { requestId: id, action: stage, durationMs: Date.now() - started });
  }
}
