import assert from 'node:assert/strict';
import { mock } from 'node:test';
import mongoose from 'mongoose';
import { Customer, User, Session, Appointment, Invoice, Treatment, Service } from '../src/lib/models';
let current: any = { id: 'a'.repeat(24), spaId: 'b'.repeat(24), name: 'Victim same name', role: 'CUSTOMER', cashier: false, customerId: 'c'.repeat(24) };
mock.module('../src/lib/auth', { namedExports: {
  actor: async () => { if (!current) throw new Error('unauthenticated'); return current; },
  checkOrigin: (request: Request) => { if (request.headers.get('origin') !== 'http://localhost:3100') throw Object.assign(new Error('origin'), { status: 403 }); },
} });
mock.module('next/navigation', { namedExports: { redirect: (path: string) => { throw new Error('REDIRECT:' + path); } } });
mock.module('../src/components/public-header', { defaultExport: () => null });
mock.module('../src/components/public-footer', { defaultExport: () => null });
// Any profile lookup, mutation or database connection is a security regression here.
(mongoose as any).connect = () => assert.fail('Unexpected database connection');
for (const model of [Customer, User, Session, Appointment, Invoice, Treatment, Service]) {
  for (const method of ['find', 'findOne', 'create', 'updateOne', 'findOneAndUpdate']) (model as any)[method] = () => assert.fail('Unexpected profile access or write');
}
const { POST } = await import('../src/app/api/auth/register/route');
const { default: page } = await import('../src/app/customer/page');
const { default: registerPage } = await import('../src/app/register/page');
for (const body of [{name:'Victim',phone:'0912345678',email:'attacker@example.test',password:'test-password',customerId:'c'.repeat(24)}, {name:'Brand new',phone:'0999999999'}, null]) {
  const response = await POST(new Request('http://localhost:3100/api/auth/register', { method:'POST',headers:{origin:'http://localhost:3100','content-type':'application/json'},body:JSON.stringify(body) }));
  assert.equal(response.status,403);
  assert.equal(response.headers.get('set-cookie'),null);
}
const { GET: cashCards } = await import('../src/app/api/cash-cards/route');
const { GET: workspace } = await import('../src/app/api/workspace/route');
const { GET: customers } = await import('../src/app/api/customers/route');
const { GET: payroll } = await import('../src/app/api/payroll/route');
const { GET: invoice } = await import('../src/app/api/invoices/[id]/route');
for (const handler of [workspace, customers, payroll, cashCards]) assert.equal((await handler(new Request('http://localhost:3100/api/workspace'))).status, 403);
assert.equal((await invoice(new Request('http://localhost:3100/api/invoices/test'), {params:Promise.resolve({id:'c'.repeat(24)})})).status,403);
for (const customerId of ['c'.repeat(24), undefined]) {
  current = {...current, role:'CUSTOMER',customerId};
  const result = JSON.stringify(await page());
  assert.ok(result.includes('Tài khoản khách hàng'));
  assert.ok(!result.includes('c'.repeat(24)), 'Legacy customerId must not reach client components');
}
for (const role of ['OWNER','STAFF']) {
  current = {...current,role};
  await assert.rejects(page(), /REDIRECT:\/workspace/);
}
current = null;
await assert.rejects(page(), /REDIRECT:\/login/);
assert.ok(!JSON.stringify(registerPage(), (key, value) => key === 'type' ? undefined : value).includes('password'));
