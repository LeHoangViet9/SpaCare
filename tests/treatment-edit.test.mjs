import test from 'node:test';
import assert from 'node:assert/strict';
import { customerTreatmentInput, treatmentEditRights, treatmentUsed, assertTreatmentTemplateCompatible } from '../src/lib/treatment-edit.ts';
import { saleablePackageTemplates } from '../src/lib/package-catalog.ts';
import { cashierCatalog } from '../src/lib/cashier-catalog.ts';
import { nextSessionNumber, treatmentUseRemaining } from '../src/lib/treatment-rules.ts';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
test('customer package actions share the edit form and hide edits from staff/cashiers', () => {
  execFileSync(process.execPath, ['--import','tsx','--experimental-test-module-mocks',fileURLToPath(new URL('./treatment-edit-ui-fixture.tsx', import.meta.url))], {stdio:'pipe',timeout:15000});
});
const input = { id:'a'.repeat(24), serviceId:'b'.repeat(24), expectedUpdatedAt:'2026-11-06T00:00:00.000Z', expectedUseCount:0, name:' Gói mới ', totalSessions:12, notes:'Ghi chú', reason:'Điều chỉnh theo thỏa thuận' };
test('edit requires a reason, valid calendar dates and rejects financial/type fields', () => {
  assert.equal(customerTreatmentInput.parse(input).name,'Gói mới');
  for(const change of [{reason:' '},{startsOn:'2026-02-30'},{startsOn:'2026-11-06',expiresOn:'2026-11-05'},{total:100},{packageType:'TIME'},{expectedUpdatedAt:''},{expectedUseCount:undefined}])
    assert.equal(customerTreatmentInput.safeParse({...input,...change}).success,false);
});
test('edit preview and use guard trust historical TreatmentUse count when counters disagree', () => {
  const plan={totalSessions:5,remaining:4,status:'ACTIVE'};
  assert.equal(treatmentUsed(plan,3),3);
  assert.equal(treatmentEditRights(plan,{totalSessions:8},3).remaining,5);
  assert.equal(treatmentUseRemaining({...plan,remaining:5},6),0);
});
test('used sessions survive increases, reductions and completed-package reopening', () => {
  const plan={totalSessions:10,remaining:3,status:'ACTIVE'};
  const edited=treatmentEditRights(plan,{totalSessions:12},7);
  assert.equal(edited.remaining,5);
  assert.equal(nextSessionNumber({...plan,...edited}),8);
  assert.throws(()=>treatmentEditRights(plan,{totalSessions:6}),/7/);
  const confirmed=treatmentEditRights(plan,{totalSessions:6,confirmUsedFloor:true});
  assert.equal(confirmed.totalSessions,7);assert.equal(confirmed.remaining,0);assert.equal(confirmed.status,'COMPLETED');
  assert.equal(treatmentEditRights(plan,{totalSessions:7}).status,'COMPLETED');
  assert.equal(treatmentEditRights({...plan,status:'PAUSED'},{totalSessions:7}).status,'PAUSED');
  assert.equal(treatmentEditRights({totalSessions:10,remaining:0,status:'COMPLETED'},{totalSessions:12}).status,'ACTIVE');
  assert.equal(treatmentUsed(plan,8),8);
  assert.throws(()=>treatmentEditRights({...plan,status:'CANCELLED'},{totalSessions:12}),/hủy/);
});
test('opening rights count only usage since transfer and keep numbering', () => {
  const plan={openingBalance:true,openingRemaining:5,remaining:3,usedSessions:2,status:'ACTIVE'};
  const rights=treatmentEditRights(plan,{totalSessions:8},2);
  assert.equal(rights.remaining,6);assert.equal(rights.usedSessions,2);
  assert.equal(nextSessionNumber({...plan,...rights}),3);
  assert.throws(()=>treatmentEditRights(plan,{totalSessions:1}),/2/);
});
test('time plans keep usage and require explicit duration and validity; no type conversion', () => {
  const plan={packageType:'TIME',usedSessions:20,status:'PAUSED'};
  const d={durationMonths:36,startsOn:'2026-11-06',expiresOn:'2029-11-06'};
  assert.deepEqual(treatmentEditRights(plan,d,21),{durationMonths:36,usedSessions:21});
  assert.throws(()=>treatmentEditRights(plan,{...d,totalSessions:30}));
  assert.throws(()=>treatmentEditRights(plan,{durationMonths:36}));
  assert.throws(()=>treatmentEditRights({status:'ACTIVE'},{...d,totalSessions:30}));
});

test('edit and package sale use the same typed catalog, never classify by name',()=>{
  const services=[{_id:'one',name:'Chăm sóc da',active:true},{_id:'single',name:'Gói dịch vụ lẻ',active:true},{_id:'stopped',active:false}];
  const packageTemplates=[{_id:'valid',name:'Chăm sóc 10 lần',serviceId:'one',totalSessions:10,active:true},{_id:'off',serviceId:'one',active:false},{_id:'off-service',serviceId:'stopped',active:true},{_id:'orphan',serviceId:'missing',active:true}];
  const data={services,packageTemplates,products:[{_id:'product',name:'Gói mỹ phẩm',active:true}],treatments:[]};
  assert.deepEqual(saleablePackageTemplates(packageTemplates,services),cashierCatalog(data,'package','',''));
  assert.deepEqual(saleablePackageTemplates(packageTemplates,services).map(row=>row._id),['valid']);
});

test('new catalog selection cannot contradict used service, quota or package type',()=>{
  const plan={serviceId:'service',templateId:'old',totalSessions:10,remaining:3};
  assert.doesNotThrow(()=>assertTreatmentTemplateCompatible(plan,{_id:'new',serviceId:'service',totalSessions:12},7));
  assert.throws(()=>assertTreatmentTemplateCompatible(plan,{_id:'new',serviceId:'service',totalSessions:6},7),/7 buổi/);
  assert.throws(()=>assertTreatmentTemplateCompatible(plan,{_id:'new',serviceId:'other',totalSessions:12},7),/dịch vụ khác/);
  assert.throws(()=>assertTreatmentTemplateCompatible(plan,{_id:'new',serviceId:'service',packageType:'TIME'},7),/thời hạn/);
  assert.doesNotThrow(()=>assertTreatmentTemplateCompatible({...plan,remaining:10},{_id:'new',serviceId:'other',totalSessions:12},0));
  assert.doesNotThrow(()=>assertTreatmentTemplateCompatible(plan,{_id:'old',serviceId:'service',totalSessions:6},7));
});

test('catalog package corrections preserve visits, signatures and money, validate source and roll back audit failures (model doubles)',()=>{
  execFileSync(process.execPath,['--import','tsx',fileURLToPath(new URL('./treatment-package-fixture.ts',import.meta.url))],{stdio:'pipe',timeout:15000});
});
