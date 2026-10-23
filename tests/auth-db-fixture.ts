import assert from 'node:assert/strict';
import { mock } from 'node:test';

mock.module('next/headers', {
  namedExports: { cookies: async () => ({ get: () => undefined }) },
});
const { actor } = await import('../src/lib/auth');
const { POST } = await import('../src/app/api/auth/login/route');
const { GET: workspace } = await import('../src/app/api/workspace/route');
const { GET: customers } = await import('../src/app/api/customers/route');
const { GET: invoice } = await import('../src/app/api/invoices/[id]/route');
const { GET: history } = await import('../src/app/api/customers/[id]/history/route');
const { GET: staff } = await import('../src/app/api/staff/[id]/route');
const { GET: payroll } = await import('../src/app/api/payroll/route');
const { GET: invoiceExport } = await import('../src/app/api/invoices/[id]/export/route');
const { GET: commissionExport } = await import('../src/app/api/payroll/export/route');
const { GET: products } = await import('../src/app/api/products/route');
const { GET: notifications, POST: changeNotifications } = await import('../src/app/api/notifications/route');
const request = (payload: unknown, origin = 'http://localhost:3100') => new Request('http://localhost:3100/api/auth/login', {
  method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(payload),
});

// Missing DB configuration must not mask unauthenticated or invalid requests.
await assert.rejects(actor(), (e: any) => e.status === 401);
assert.equal((await notifications()).status, 401);
assert.equal((await changeNotifications(request({ action: 'subscribe' }))).status, 401);
assert.equal((await changeNotifications(request({ action: 'read' }, 'https://foreign.test'))).status, 403);
assert.equal((await workspace(new Request('http://localhost:3100/api/workspace?section=audit&spaId=foreign'))).status, 401);
assert.equal((await customers(new Request('http://localhost:3100/api/customers?spaId=foreign'))).status, 401);
const params = Promise.resolve({ id: 'a'.repeat(24) });
assert.equal((await invoiceExport(new Request('http://localhost:3100/api/invoices/test/export'), { params })).status, 401);
assert.equal((await commissionExport(new Request('http://localhost:3100/api/payroll/export?month=2026-10'))).status, 401);
assert.equal((await invoice(new Request('http://localhost:3100/api/invoices/test'), { params })).status, 401);
assert.equal((await history(new Request('http://localhost:3100/api/customers/test/history'), { params })).status, 401);
assert.equal((await staff(new Request('http://localhost:3100/api/staff/test'), { params })).status, 401);
assert.equal((await payroll(new Request('http://localhost:3100/api/payroll?month=2026-10'))).status, 401);
assert.equal((await products(new Request('http://localhost:3100/api/products'))).status, 401);
assert.equal((await POST(request({ email: 'invalid', password: '' }))).status, 400);
assert.equal((await POST(request({ email: 'test@example.invalid', password: 'invalid' }, 'http://other.invalid'))).status, 403);
const unavailable = await POST(request({ email: 'test@example.invalid', password: 'invalid' }));
assert.equal(unavailable.status, 503);
assert.equal((await unavailable.json()).code, 'DB_CONFIG_MISSING');
