import assert from 'node:assert/strict';
import { mock } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import mongoose from 'mongoose';
import { Spa, Service, Product, User, Control, Customer, Appointment, Audit, Idempotency, Notification } from '../src/lib/models';
import { randomUUID } from 'node:crypto';
import { spaDay } from '../src/lib/rules';

let currentSlug = 'spa-a';
mock.module('next/headers', { namedExports: { cookies: async () => ({ get: () => undefined }) } });
mock.module('next/server', { namedExports: { after: () => {} } });
mock.module('next/navigation', { namedExports: {
  usePathname: () => '/s/' + currentSlug,
  notFound: () => { throw Object.assign(new Error('NOT_FOUND'), { status: 404 }); },
} });
mock.module('next/link', { defaultExport: ({ href, children, ...props }: any) => React.createElement('a', { ...props, href }, children) });
(mongoose.connection as any).readyState = 1;
process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/spacare_test';
(mongoose as any).connect = () => assert.fail('No database connection allowed');
const id = (digit: string) => digit.repeat(24);
const spas = [
  { _id: id('1'), slug: 'spa-a', name: 'Synthetic Spa A', active: true, publicEnabled: true },
  { _id: id('2'), slug: 'spa-b', name: 'Synthetic Spa B', active: true, publicEnabled: true },
  { _id: id('3'), slug: 'hidden', active: true, publicEnabled: false },
  { _id: id('4'), slug: 'inactive', active: false, publicEnabled: true },
  { _id: id('9'), slug: 'legacy' } as any,
];
const services = spas.slice(0, 2).map((spa, index) => ({ _id: id(index ? 'b' : 'a'), spaId: spa._id, name: `Only Service ${index ? 'B' : 'A'}`, price: 100000, active: true }));
const products = spas.slice(0, 2).flatMap((spa, index) => Array.from({ length: 13 }, (_, n) => ({ _id: `${index}-${n}`, spaId: spa._id, name: `Only Product ${index ? 'B' : 'A'} ${n}`, price: 200000, active: true, stock: 2 })));
Object.assign(products[0], { imageUrl: '/api/product-images/' + id('c') });
Object.assign(products[1], { imageUrl: 'https://example.test/api/product-images/' + id('d') });
let state: Record<string, any[]> = { Customer: [], Appointment: [], Audit: [], Idempotency: [], Notification: [] };
const matches = (row: any, filter: any): boolean => Object.entries(filter).every(([key, value]: any) => {
  if (value?.$regex !== undefined) return new RegExp(value.$regex, value.$options).test(row[key]);
  return String(row[key]) === String(value);
});
function query(read: () => any) {
  let skip = 0, limit = Infinity;
  const q: any = { select: () => q, sort: () => q, session: () => q,
    skip: (n: number) => { skip = n; return q; }, limit: (n: number) => { limit = n; return q; },
    lean: async () => { const data = read(); return Array.isArray(data) ? data.slice(skip, skip + limit) : data; },
    then: (resolve: any, reject: any) => q.lean().then(resolve, reject) };
  return q;
}
let catalogReads = 0;
for (const [model, rows] of [[Spa, spas], [Service, services], [Product, products]] as const) {
  (model as any).find = (filter: any) => { if (model !== Spa) catalogReads++; return query(() => rows.filter(row => matches(row, filter))); };
  (model as any).findOne = (filter: any) => query(() => rows.find(row => matches(row, filter)) || null);
  (model as any).countDocuments = async (filter: any) => rows.filter(row => matches(row, filter)).length;
}
const pages = await Promise.all([
  import('../src/app/s/[slug]/page'), import('../src/app/s/[slug]/services/page'),
  import('../src/app/s/[slug]/products/page'), import('../src/app/s/[slug]/booking/page'),
]);
for (const slug of ['spa-a', 'spa-b']) {
  currentSlug = slug;
  const own = slug === 'spa-a' ? 'A' : 'B', other = own === 'A' ? 'B' : 'A';
  for (const page of pages) {
    const html = renderToStaticMarkup(await page.default({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) }));
    assert.ok(!html.includes(`Only Service ${other}`) && !html.includes(`Only Product ${other}`));
    assert.match(html, new RegExp(`Only (?:Service|Product) ${own}`));
    assert.ok(!/(?:href|action)="\/(?:services|products|booking)(?:[/?"])/.test(html), 'public links and form actions retain slug');
  }
}
const detail = (await import('../src/app/s/[slug]/services/[id]/page')).default;
const imagePage = renderToStaticMarkup(await pages[2].default({ params: Promise.resolve({ slug: 'spa-a' }), searchParams: Promise.resolve({}) }));
assert.ok(imagePage.includes('src="/api/s/spa-a/products/0-0/image"'));
assert.ok(!imagePage.includes('/api/product-images/') && !imagePage.includes('https://example.test'), 'public HTML never publishes raw or absolute stored image URLs');
await assert.rejects(detail({ params: Promise.resolve({ slug: 'spa-a', id: services[1]._id }) }), /NOT_FOUND/);
assert.match(renderToStaticMarkup(await detail({ params: Promise.resolve({ slug: 'spa-a', id: services[0]._id }) })), /Only Service A/);
for (const slug of ['missing', 'hidden', 'inactive', 'legacy', 'Bad Slug', '../spa-a']) {
  const before = catalogReads;
  for (const page of pages) await assert.rejects(page.default({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) }), /NOT_FOUND/);
  assert.equal(catalogReads, before, 'invalid/unpublished spa must not read catalogs');
}
for (const query of [{ q: 'Only Product B' }, { page: '2' }, { q: '.*' }]) {
  const html = renderToStaticMarkup(await pages[2].default({ params: Promise.resolve({ slug: 'spa-a' }), searchParams: Promise.resolve(query) }));
  assert.ok(!html.includes('<h2>Only Product B'));
}
const searched = renderToStaticMarkup(await pages[1].default({ params: Promise.resolve({ slug: 'spa-a' }), searchParams: Promise.resolve({ q: 'Only Service B' }) }));
assert.ok(!searched.includes('shared-service-card'));
// Detect ambiguous slugs even before a production index has been provisioned.
spas.push({ ...spas[0], _id: id('5') });
await assert.rejects(pages[0].default({ params: Promise.resolve({ slug: 'spa-a' }) }), /NOT_FOUND/);
spas.pop();
for (const path of ['services', 'products', 'booking', 'services/[id]']) {
  const legacy = await import(`../src/app/${path}/page`);
  assert.throws(() => legacy.default(), /NOT_FOUND/);
}

const { reservePublicBooking } = await import('../src/lib/public-booking');
const session = { withTransaction: async (fn: any) => {
  const before = structuredClone(state);
  try { return await fn(); } catch (error) { state = before; throw error; }
}, endSession: async () => {} };
(mongoose as any).startSession = async () => session;
(Control as any).findOneAndUpdate = (filter: any) => query(() => spas.some(spa => spa._id === filter.spaId) ? { revision: 1 } : null);
const people = spas.slice(0, 2).map(spa => ({ _id: id(spa.slug === 'spa-a' ? '6' : '7'), spaId: spa._id, active: true, role: 'OWNER' }));
(User as any).find = (filter: any) => query(() => people.filter(person => person.spaId === filter.spaId));
(User as any).findOne = (filter: any) => query(() => people.find(person => matches(person, filter)) || null);
for (const model of [Customer, Appointment, Audit, Idempotency, Notification]) {
  (model as any).findOne = (filter: any) => query(() => state[model.modelName].find(row => matches(row, filter)) || null);
  (model as any).create = async (rows: any[]) => {
    const result = rows.map(row => ({ ...row, _id: id('8') + '-' + randomUUID() }));
    state[model.modelName].push(...result); return result;
  };
}
const input = { serviceId: services[0]._id, name: 'Synthetic guest', phone: '0900000000', startAt: spaDay(new Date(Date.now() + 86400000)) + 'T14:30:00+07:00' };
const rejectedWithoutWrites = async (slug: string, data = input, actor: any = null) => {
  const before = structuredClone(state);
  await assert.rejects(reservePublicBooking(data, actor, randomUUID(), slug), (error: any) => [403, 404].includes(error.status));
  assert.deepEqual(state, before);
};
for (const slug of ['missing', 'hidden', 'inactive', 'Bad Slug']) await rejectedWithoutWrites(slug);
await rejectedWithoutWrites('spa-a', { ...input, serviceId: services[1]._id });
await rejectedWithoutWrites('spa-a', { ...input, serviceId: undefined, serviceIds: services.map(s => s._id) } as any);
services[0].active = false; await rejectedWithoutWrites('spa-a'); services[0].active = true;
await rejectedWithoutWrites('spa-a', input, { id: people[1]._id, spaId: people[1].spaId, role: 'OWNER' });
const key = randomUUID();
const a = await reservePublicBooking({ ...input, spaId: spas[1]._id }, null, key, 'spa-a');
assert.deepEqual(await reservePublicBooking(input, null, key, 'spa-a'), a);
await reservePublicBooking({ ...input, serviceId: services[1]._id }, null, key, 'spa-b');
for (const rows of Object.values(state)) assert.equal(rows.length, 2, 'retry must not duplicate either tenant records');
assert.equal(state.Appointment[0].spaId, spas[0]._id); assert.equal(state.Appointment[1].spaId, spas[1]._id);
assert.equal(state.Customer[0].spaId, spas[0]._id); assert.equal(state.Customer[1].spaId, spas[1]._id);
spas[0].publicEnabled = false;
await rejectedWithoutWrites('spa-a');
await assert.rejects(reservePublicBooking(input, null, key, 'spa-a'), (e: any) => e.status === 404, 'disabled spa blocks even a replay');
const legacyPost = await import('../src/app/api/booking/route');
assert.equal((await legacyPost.POST()).status, 404);
spas[0].publicEnabled = true;
process.env.APP_ORIGIN = 'http://localhost:3000';
const scopedPost = (await import('../src/app/api/s/[slug]/booking/route')).POST;
const request = (body: unknown, origin = process.env.APP_ORIGIN) => new Request('http://localhost:3000/api/s/spa-a/booking', {
  method: 'POST', headers: { origin: origin!, 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID() }, body: JSON.stringify(body),
});
const beforeRequest = structuredClone(state);
assert.equal((await scopedPost(request({ ...input, spaId: spas[1]._id, serviceId: services[1]._id }), { params: Promise.resolve({ slug: 'spa-a' }) })).status, 404);
assert.equal((await scopedPost(request(input), { params: Promise.resolve({ slug: 'missing' }) })).status, 404);
assert.equal((await scopedPost(request(input, 'http://other.invalid'), { params: Promise.resolve({ slug: 'spa-a' }) })).status, 403);
assert.deepEqual(state, beforeRequest);
assert.equal((await scopedPost(request({ ...input, spaId: spas[1]._id }), { params: Promise.resolve({ slug: 'spa-a' }) })).status, 200);
assert.equal(state.Appointment.at(-1)!.spaId, spas[0]._id, 'route slug overrides browser spaId');
console.log('Public A/B pages, links, missing slugs, booking scope, replay and disabled-spa checks passed without a database.');
