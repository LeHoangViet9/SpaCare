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
