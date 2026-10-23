import test from 'node:test';
import assert from 'node:assert/strict';
import { packageTemplateInput } from '../src/lib/package-input.ts';
import { packageExpiry, packageSnapshot, treatmentAvailable, useToken, packageLabel } from '../src/lib/treatment-rules.ts';
const base = {name:'Triệt', serviceId:'a'.repeat(24), price:2000000};
test('package type requires exactly one entitlement, legacy session inputs remain valid', () => {
  assert.equal(packageTemplateInput.parse({...base,totalSessions:10}).packageType, 'SESSIONS');
  assert.equal(packageTemplateInput.parse({...base,packageType:'TIME',durationMonths:36}).durationMonths,36);
  for (const fields of [{packageType:'TIME'}, {packageType:'TIME',durationMonths:0}, {packageType:'TIME',durationMonths:1.5}, {packageType:'TIME',durationMonths:121}, {packageType:'TIME',durationMonths:24,totalSessions:10}, {durationMonths:24}, {}]) assert.equal(packageTemplateInput.safeParse({...base,...fields}).success,false);
});
test('calendar months clamp leap dates and reject nonexistent start dates', () => {
  assert.equal(packageExpiry('2024-02-29',24),'2026-02-28');
  assert.equal(packageExpiry('2026-01-31',1),'2026-02-28');
  assert.equal(packageExpiry('2026-10-23',36),'2029-10-23');
  for (const date of ['', '2026-02-30','2026-13-01']) assert.throws(()=>packageExpiry(date,24));
});
test('time packages have no session quota, honor inclusive validity and still version signed uses', () => {
  const p = {...packageSnapshot({packageType:'TIME',durationMonths:24},'2026-10-23'),status:'ACTIVE'};
  assert.equal(p.remaining,undefined); assert.equal(p.totalSessions,undefined);
  assert.equal(treatmentAvailable(p,'2026-10-22'),false);
  assert.equal(treatmentAvailable(p,'2026-10-23'),true);
  assert.equal(treatmentAvailable({...p,usedSessions:5000},'2028-10-23'),true);
  assert.equal(treatmentAvailable(p,'2028-10-24'),false);
  assert.equal(treatmentAvailable({...p,status:'PAUSED'},'2026-10-23'),false);
  assert.equal(useToken(p),0); assert.equal(useToken({...p,usedSessions:3}),3);
  assert.match(packageLabel(p), /Không giới hạn/);
  assert.equal(treatmentAvailable({status:'ACTIVE',remaining:1},'2026-10-23'),true);
  assert.equal(treatmentAvailable({status:'ACTIVE',remaining:0},'2026-10-23'),false);
});
