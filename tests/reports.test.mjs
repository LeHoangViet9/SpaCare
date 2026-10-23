import test from 'node:test';
import assert from 'node:assert/strict';
import { tsImport } from 'tsx/esm/api';
const { reportDateRange, readReport } = await tsImport('../src/lib/report-read.ts', import.meta.url);
test('report days use inclusive Vietnam dates with exclusive upper bound', () => {
 const r = reportDateRange('2026-12-31', '2026-12-31');
 assert.equal(r.$gte.toISOString(), '2026-12-30T17:00:00.000Z');
 assert.equal(r.$lt.toISOString(), '2026-12-31T17:00:00.000Z');
 assert.deepEqual(reportDateRange('', ''), {});
});
test('reports deny customer and staff without cashier permission before database access', async () => {
 for (const user of [{role:'CUSTOMER',cashier:true}, {role:'STAFF',cashier:false}]) {
  await assert.rejects(readReport(user, {}), e => e.status === 403);
 }
});
