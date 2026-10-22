import test from 'node:test';
import assert from 'node:assert/strict';
import { tsImport } from 'tsx/esm/api';
import { workspaceQuery } from '../src/lib/workspace-query.ts';
const { readWorkspace } = await tsImport('../src/lib/workspace-read.ts', import.meta.url);
const { readStaffProfile } = await tsImport('../src/lib/staff-read.ts', import.meta.url);

test('restricted workspace sections reject unauthorized actors before database access', async () => {
  const employee = { id: 'a'.repeat(24), spaId: 'b'.repeat(24), name: 'Test', role: 'STAFF', cashier: false };
  for (const section of ['services', 'staff', 'audit', 'days', 'reports', 'cashier', 'package_catalog']) {
    await assert.rejects(readWorkspace(employee, workspaceQuery(new URLSearchParams({ section }))), error => error.status === 403);
  }
  for (const section of ['services', 'staff', 'audit', 'package_catalog']) {
    await assert.rejects(readWorkspace({ ...employee, cashier: true }, workspaceQuery(new URLSearchParams({ section }))), error => error.status === 403);
  }
});
test('staff profile denies staff and cashier before database reads', async () => {
  for (const cashier of [false, true]) await assert.rejects(readStaffProfile({ id: 'a'.repeat(24), spaId: 'b'.repeat(24), name: 'Test', role: 'STAFF', cashier }, 'c'.repeat(24)), error => error.status === 403);
});
