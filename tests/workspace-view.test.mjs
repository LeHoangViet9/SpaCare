import test from 'node:test';
import assert from 'node:assert/strict';
import { workspaceHref } from '../src/lib/workspace-view.ts';
import { staffBookingsToday } from '../src/lib/rules.ts';

test('BUG-UI-001: linked-record filter survives URL reconstruction and reload', () => {
  for (const section of ['invoices', 'appointments']) {
    const id = '67abcdef0123456789abcdef';
    const url = new URL(workspaceHref(section, id), 'http://localhost');
    assert.equal(url.pathname, '/workspace/' + section);
    assert.equal(new URL(url.href).searchParams.get('search'), id);
    assert.equal(workspaceHref(section), '/workspace/' + section);
  }
  const input = 'Khách & gói #1 + tiếng Việt?';
  assert.equal(new URL(workspaceHref('customers', input), 'http://localhost').searchParams.get('search'), input);
  assert.equal(workspaceHref('overview'), '/workspace');
});

test('BUG-UI-002: STAFF counts only own CONFIRMED visits within the Vietnam day', () => {
  const visit = (startAt, status = 'CONFIRMED', staffId = 'me') => ({ startAt, status, staffId });
  const rows = [
    visit('2026-10-20T16:59:59.999Z'), // 23:59:59 previous Vietnam day
    visit('2026-10-20T17:00:00.000Z'), // 00:00 Vietnam, previous UTC day
    visit('2026-10-20T17:00:00.001Z'),
    visit('2026-10-21T00:00:00.000Z'),
    visit('2026-10-21T16:59:59.999Z'),
    visit('2026-10-21T17:00:00.000Z'), // next Vietnam day
    visit('2026-10-21T17:00:00.001Z'),
    ...['COMPLETED', 'POSTPONED', 'CANCELLED'].map(status => visit('2026-10-21T02:00:00Z', status)),
    visit('2026-10-21T03:00:00Z', 'CONFIRMED', 'other'),
  ];
  assert.equal(staffBookingsToday(rows, '2026-10-21', 'me'), 4);
  assert.equal(staffBookingsToday(rows, '2026-10-20', 'me'), 1);
  assert.equal(staffBookingsToday(rows, '2026-10-22', 'me'), 2);
  assert.equal(staffBookingsToday([], '2026-10-21', 'me'), 0);
});
