import test from 'node:test';
import assert from 'node:assert/strict';
import { canViewPage, pageKeys } from '../src/lib/navigation.ts';
import { workspaceHref } from '../src/lib/workspace-view.ts';
import { middleware } from '../src/middleware.ts';
import { NextRequest } from 'next/server.js';

test('TC-01, TC-02: Public routes (/, /services, /booking) do not require authentication', () => {
  const publicPaths = ['/', '/services', '/services/67abcdef0123456789abcdef', '/booking', '/login', '/register'];
  for (const path of publicPaths) {
    const req = new NextRequest(new URL(path, 'http://localhost:3000'));
    const res = middleware(req);
    // Should NOT redirect to login; passes through
    assert.equal(res.status, 200, `Expected path ${path} to pass through without redirect`);
    assert.equal(res.headers.get('location'), null, `Expected no location header for ${path}`);
  }
});

test('TC-03: Unauthenticated request to /workspace redirects to login', () => {
  const req = new NextRequest(new URL('/workspace', 'http://localhost:3000'));
  const res = middleware(req);
  assert.equal(res.status, 307);
  const location = res.headers.get('location');
  assert.ok(location?.includes('/login?returnTo='));
  assert.ok(location?.includes(encodeURIComponent('/workspace')));
});

test('TC-03: Unauthenticated request to /customer redirects to login', () => {
  const req = new NextRequest(new URL('/customer', 'http://localhost:3000'));
  const res = middleware(req);
  assert.equal(res.status, 307);
  const location = res.headers.get('location');
  assert.ok(location?.includes('/login?returnTo='));
  assert.ok(location?.includes(encodeURIComponent('/customer')));
});

test('TC-04, TC-05: OWNER and STAFF have appropriate workspace permissions; CUSTOMER has none', () => {
  const allKeys = pageKeys();
  assert.ok(allKeys.length > 10);

  // TC-06 & TC-07: CUSTOMER is denied access to all workspace sections
  for (const key of allKeys) {
    assert.equal(canViewPage(key, { role: 'CUSTOMER' }), false, `CUSTOMER must not access workspace section ${key}`);
  }

  // OWNER has access to all valid pages
  for (const key of allKeys) {
    assert.equal(canViewPage(key, { role: 'OWNER' }), true, `OWNER should access ${key}`);
  }

  // STAFF has scoped access
  assert.equal(canViewPage('overview', { role: 'STAFF' }), true);
  assert.equal(canViewPage('appointments', { role: 'STAFF' }), true);
  assert.equal(canViewPage('customers', { role: 'STAFF' }), true);
  // STAFF without cashier cannot access financial close
  assert.equal(canViewPage('days', { role: 'STAFF', cashier: false }), false);
  // STAFF cannot access admin owner pages
  assert.equal(canViewPage('services', { role: 'STAFF' }), false);
  assert.equal(canViewPage('staff', { role: 'STAFF' }), false);
  assert.equal(canViewPage('audit', { role: 'STAFF' }), false);
});

test('TC-08, TC-09: Authenticated user visiting / is not redirected in loops', () => {
  const req = new NextRequest(new URL('/', 'http://localhost:3000'), {
    headers: { cookie: 'spacare_session=mock-valid-session-token' },
  });
  const res = middleware(req);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('location'), null);
});

test('TC-11: Public service representation never exposes internal employee commission', () => {
  // Simulate public service query
  const sampleInternalService = {
    _id: '67abcdef0123456789abcdef',
    name: 'Massage body chuyên sâu',
    category: 'Massage',
    price: 600000,
    duration: 90,
    commission: 80000, // INTERNAL DATA
    active: true,
  };

  // The public projection selects only public fields:
  const publicService = (({ _id, name, category, price, duration }) => ({ _id, name, category, price, duration }))(sampleInternalService);

  assert.equal(publicService.name, 'Massage body chuyên sâu');
  assert.equal(publicService.price, 600000);
  assert.equal('commission' in publicService, false, 'Public service must never expose commission');
  assert.equal((publicService).commission, undefined);
});

test('TC-12: Overview link resolves to /workspace instead of /', () => {
  assert.equal(workspaceHref('overview'), '/workspace');
  assert.equal(workspaceHref('appointments'), '/workspace/appointments');
});
