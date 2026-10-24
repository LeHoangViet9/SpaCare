import { z } from 'zod';
import { staffPhone } from './login-identity';

export class SeedOwnerError extends Error {}

export function seedOwnerConfig(env: Record<string, string | undefined>) {
  const phone = env.SEED_OWNER_PHONE?.trim();
  const email = env.SEED_OWNER_EMAIL?.trim();
  const password = env.SEED_OWNER_PASSWORD || '';
  if (password.length < 12 || password.length > 128)
    throw new SeedOwnerError('SEED_OWNER_PASSWORD phải có 12–128 ký tự.');
  if (!phone && !email) throw new SeedOwnerError('Cần SEED_OWNER_PHONE hoặc SEED_OWNER_EMAIL cũ.');
  const parsedPhone = phone ? staffPhone.safeParse(phone) : undefined;
  const parsedEmail = email ? z.email().safeParse(email.toLowerCase()) : undefined;
  if (parsedPhone && !parsedPhone.success) throw new SeedOwnerError('SEED_OWNER_PHONE không hợp lệ.');
  if (parsedEmail && !parsedEmail.success) throw new SeedOwnerError('SEED_OWNER_EMAIL không hợp lệ.');
  return {
    name: env.SEED_OWNER_NAME?.trim() || 'Chủ spa',
    spaName: env.SEED_SPA_NAME?.trim() || 'SpaCare',
    ...(parsedPhone?.success ? { phone: parsedPhone.data } : {}),
    ...(parsedEmail?.success ? { email: parsedEmail.data } : {}),
    password,
  };
}

// Bootstrap never resets credentials or attaches an identity to an existing user.
export function checkSeedOwnerMatches(
  config: ReturnType<typeof seedOwnerConfig>,
  matches: Array<{ role: string; active?: boolean; phone?: string; email?: string }>,
) {
  if (matches.length !== 1) throw new SeedOwnerError('Thông tin seed trùng nhiều tài khoản. Không thay đổi tài khoản.');
  const user = matches[0];
  if (user.role !== 'OWNER' || user.active !== true ||
    (config.phone && config.phone !== user.phone) || (config.email && config.email !== user.email))
    throw new SeedOwnerError('Thông tin seed không khớp chủ spa đang hoạt động. Không thay đổi tài khoản.');
}
