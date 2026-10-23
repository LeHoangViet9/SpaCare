import { z } from 'zod';
export const staffPhone = z.string().trim().transform(value => value.replace(/[\s().-]/g, '').replace(/^\+84/, '0'))
  .pipe(z.string().regex(/^0\d{9,10}$/, 'Số điện thoại không hợp lệ.'));
export const loginIdentity = z.string().trim().max(254).transform((value, context) => {
  if (value.includes('@')) {
    const result = z.email().safeParse(value.toLowerCase());
    if (result.success) return { kind: 'email' as const, value: result.data };
  } else {
    const result = staffPhone.safeParse(value);
    if (result.success) return { kind: 'phone' as const, value: result.data };
  }
  context.addIssue({ code: 'custom', message: 'Nhập số điện thoại hoặc email hợp lệ.' });
  return z.NEVER;
});
export const loginInput = z.object({
  identifier: z.string().optional(), email: z.string().optional(), phone: z.string().optional(),
  password: z.string().min(1).max(128),
}).transform((value, context) => {
  const result = loginIdentity.safeParse(value.identifier ?? value.phone ?? value.email ?? '');
  if (!result.success) { context.addIssue({ code: 'custom', path: ['identifier'], message: 'Nhập số điện thoại hoặc email hợp lệ.' }); return z.NEVER; }
  return { identity: result.data, password: value.password };
});
