import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { hashPassword } from '../src/lib/password';
import { User, LoginAttempt, Session } from '../src/lib/models';

let cookieCount = 0;
mock.module('next/headers', { namedExports: { cookies: async () => ({ set: () => { cookieCount++; } }) } });
mock.module('../src/lib/db.ts', { namedExports: { connect: async () => {}, DatabaseUnavailableError: class extends Error {} } });
const { POST } = await import('../src/app/api/auth/login/route');
let filter: any, throttle: any, found = true, sessionCount = 0;
(User as any).findOne = (query: any) => { filter = query; return { select: async () => found ? {
  _id: 'staff', spaId: 'spa', role: 'STAFF', name: 'Staff', passwordHash: hashPassword('valid-password'),
} : null }; };
(LoginAttempt as any).findOneAndUpdate = async (query: any) => { throttle = query.key; return { count: 1 }; };
(Session as any).create = async (session: any) => { sessionCount++; assert.equal(session.userId, 'staff'); assert.equal(session.spaId, 'spa'); assert.equal(session.tokenHash.length, 64); };
const login = (identifier: string, password = 'valid-password') => POST(new Request('http://localhost:3100/api/auth/login', {
  method: 'POST', headers: { origin: 'http://localhost:3100', 'content-type': 'application/json' }, body: JSON.stringify({ identifier, password }),
}));
assert.equal((await login('+84 329 357 116')).status, 200);
assert.deepEqual(filter, { phone: '0329357116', active: true });
const normalizedThrottle = throttle;
assert.equal((await login('0329357116')).status, 200);
assert.equal(throttle, normalizedThrottle, 'Formatting variants share the same throttle bucket');
assert.equal((await login('OWNER@EXAMPLE.TEST')).status, 200);
assert.deepEqual(filter, { email: 'owner@example.test', active: true });
assert.equal((await login('0329357116', 'wrong-password')).status, 401);
found = false;
assert.equal((await login('0329357116')).status, 401);
assert.equal(sessionCount, 3); assert.equal(cookieCount, 3);
