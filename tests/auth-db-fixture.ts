import assert from 'node:assert/strict';
import { mock } from 'node:test';

mock.module('next/headers', {
  namedExports: { cookies: async () => ({ get: () => undefined }) },
});
const { actor } = await import('../src/lib/auth');
const { POST } = await import('../src/app/api/auth/login/route');
const request = (payload: unknown, origin = 'http://localhost:3100') => new Request('http://localhost:3100/api/auth/login', {
  method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(payload),
});

// Missing DB configuration must not mask unauthenticated or invalid requests.
await assert.rejects(actor(), (e: any) => e.status === 401);
assert.equal((await POST(request({ email: 'invalid', password: '' }))).status, 400);
assert.equal((await POST(request({ email: 'test@example.invalid', password: 'invalid' }, 'http://other.invalid'))).status, 403);
const unavailable = await POST(request({ email: 'test@example.invalid', password: 'invalid' }));
assert.equal(unavailable.status, 503);
assert.equal((await unavailable.json()).code, 'DB_CONFIG_MISSING');
