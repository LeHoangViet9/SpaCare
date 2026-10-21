import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../src/lib/password.ts';
test('mật khẩu được salt riêng và kiểm tra đúng/sai', () => {
  const a = hashPassword('test-password-123');
  const b = hashPassword('test-password-123');
  assert.notEqual(a, b);
  assert.equal(verifyPassword('test-password-123', a), true);
  assert.equal(verifyPassword('wrong-password', a), false);
  assert.equal(verifyPassword('test-password-123', 'invalid'), false);
});
