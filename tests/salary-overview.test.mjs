import test from 'node:test';
import assert from 'node:assert/strict';
import {salaryOverviewRows} from '../src/lib/salary-overview.ts';
test('one salary row per staff includes uncreated staff without inventing salary totals',()=>{
 const rows=salaryOverviewRows([{_id:'a',name:'Staff',baseSalary:5000000}],[],[{_id:{staffId:'a',category:'SERVICE'},amount:20000},{_id:{staffId:'a',category:'PACKAGE_SALE'},amount:50000}],[{_id:'a',days:20}],[{staffId:'a',permitted:1}], '2026-10');
 assert.equal(rows.length,1); assert.equal(rows[0].status,'NOT_CREATED');assert.equal(rows[0].total,null);assert.equal(rows[0].earnedBase,undefined);
 assert.equal(rows[0].serviceCommissionTotal,20000); assert.equal(rows[0].saleCommissionTotal,50000); assert.equal(rows[0].currentWorkdays,20);
});
test('live attendance and new commissions never overwrite an approved salary snapshot',()=>{
 const saved={_id:'p',staffId:'a',status:'PAID',total:5300000,workdays:22,commissionTotal:300000,leaveStats:{permitted:0}};
 const [row]=salaryOverviewRows([{_id:'a',name:'Staff'}],[saved],[{_id:{staffId:'a',category:'SERVICE'},amount:999999}],[{_id:'a',days:24}],[{staffId:'a',permitted:2}],'2026-10');
 assert.equal(row.total,5300000);assert.equal(row.workdays,22);assert.equal(row.commissionTotal,300000);assert.equal(row.leaveStats.permitted,0);
 assert.equal(row.currentWorkdays,24);assert.equal(row.currentLeaveStats.permitted,2);assert.equal(saved.currentWorkdays,undefined);
});

test('draft displays latest service and package amounts and detects equal-total ledger replacement',()=>{
 const people=[{_id:'a',name:'Staff'}];
 const saved={staffId:'a',status:'DRAFT',commissionIds:['old'],serviceCommissionTotal:125000,saleCommissionTotal:0,commissionTotal:125000,total:5125000};
 const pending=[{_id:{staffId:'a',category:'SERVICE'},amount:215000,ids:['service']},{_id:{staffId:'a',category:'PACKAGE_SALE'},amount:87500,ids:['sale']}];
 const [row]=salaryOverviewRows(people,[saved],pending,[],[],'2026-11');
 assert.equal(row.needsRecalculation,true);assert.equal(row.latestCommissionTotal,302500);assert.equal(row.commissionTotal,125000);assert.equal(saved.needsRecalculation,undefined);
 const refreshed={...saved,commissionIds:['service'],saleCommissionIds:['sale'],serviceCommissionTotal:215000,saleCommissionTotal:87500,commissionTotal:302500};
 assert.equal(salaryOverviewRows(people,[refreshed],pending,[],[],'2026-11')[0].needsRecalculation,false);
 assert.equal(salaryOverviewRows(people,[{...refreshed,commissionIds:['replacement']}],pending,[],[],'2026-11')[0].needsRecalculation,true);
 for(const status of ['APPROVED','PAID']) {
  const [locked]=salaryOverviewRows(people,[{...saved,status}],pending,[],[],'2026-11');
  assert.equal(locked.commissionTotal,125000);assert.equal(locked.total,5125000);assert.equal(locked.needsRecalculation,false);
 }
});
