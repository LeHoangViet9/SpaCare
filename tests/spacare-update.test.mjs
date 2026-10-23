import test from 'node:test';
import assert from 'node:assert/strict';
import {formatCurrency,parseMoney} from '../src/lib/currency.ts';
import {packageCommissionDelta} from '../src/lib/sale-commission.ts';
import {leaveInputs,summarizeLeave,leavesOverlap,attendanceSalary} from '../src/lib/leave-rules.ts';
test('Vietnam money groups thousands while persisted values remain integer VND',()=>{
 for(const [raw,num] of [['1.000',1000],['10.000',10000],['1.000.000',1000000],['2.500.000',2500000],['1000',1000]]) {
  assert.equal(parseMoney(raw),num); assert.equal(formatCurrency(num),num.toLocaleString('vi-VN')+' đ');
 }
 for(const raw of ['1.00','1,5','-10','NaN','1.000.000.000.001','1e6'])assert.throws(()=>parseMoney(raw));
});
test('package commission recognizes 5 percent only on eligible money, split payments and retry deltas',()=>{
 assert.deepEqual(packageCommissionDelta(2000000,0,2000000,0),{target:100000,delta:100000});
 let accrued=0;for(const paid of [500000,1200000,2000000]){const r=packageCommissionDelta(paid,0,2000000,accrued);accrued+=r.delta;}
 assert.equal(accrued,100000);assert.equal(packageCommissionDelta(2000000,0,2000000,accrued).delta,0);
 assert.equal(packageCommissionDelta(500000,0,2000000,0).delta,25000);
 assert.equal(packageCommissionDelta(0,0,0,0).delta,0);
 assert.equal(packageCommissionDelta(1800000,0,1800000,0).delta,90000);
 assert.equal(packageCommissionDelta(2000000,500000,2000000,100000).delta,-25000);
 assert.equal(packageCommissionDelta(1000000,0,2000000,100000).delta,-50000);
 assert.throws(()=>packageCommissionDelta(1,2,10,0));
 let rounded=0;for(const paid of [1,11,19,20,39,40])rounded+=packageCommissionDelta(paid,0,40,rounded).delta;
 assert.equal(rounded,2);
});
test('approved leave ranges and half days are clipped per month and distinct from paid leave',()=>{
 const rows=[{startDay:'2026-09-30',endDay:'2026-10-02',type:'PERMITTED',status:'APPROVED',period:'AM',paid:false},
 {day:'2026-10-03',type:'UNPERMITTED',status:'APPROVED',period:'FULL',paid:false},
 {day:'2026-10-04',type:'PERMITTED',status:'PENDING',paid:true},
 {day:'2026-10-05',type:'PERMITTED',status:'REJECTED',paid:true},
 {day:'2026-10-06',type:'PERMITTED',status:'APPROVED',paid:true}];
 assert.deepEqual(summarizeLeave(rows,'2026-10'),{permitted:2,unpermitted:1,paid:1,unpaid:2});
 assert.equal(leavesOverlap(rows[0],{day:'2026-10-01',type:'WORK',period:'AM'}),true);
 assert.equal(leavesOverlap(rows[0],{day:'2026-10-01',type:'WORK',period:'PM'}),false);
 assert.equal(leavesOverlap(rows[0],{day:'2026-10-01',type:'WORK',period:'FULL'}),true);
 for(const day of ['2026-02-30','2026-13-01'])assert.equal(leaveInputs.recordStaffLeave.safeParse({staffId:'a'.repeat(24),startDay:day,endDay:day,type:'PERMITTED'}).success,false);
});
test('daily salary requires confirmed attendance, paid permission is capped and unpaid absences reduce base once',()=>{
 const policy={standardDays:26,paidLeaveDays:1,mode:'DAILY'},leave={permitted:2,unpermitted:1,paid:2,unpaid:1};
 assert.throws(()=>attendanceSalary(5200000,policy,null,leave),/ngày công/);
 assert.deepEqual(attendanceSalary(5200000,policy,23,leave),{earnedBase:4800000,leaveDeduction:400000});
 assert.deepEqual(attendanceSalary(5200000,{...policy,mode:'NONE'},null,leave),{earnedBase:5200000,leaveDeduction:0});
 assert.deepEqual(attendanceSalary(5200000,undefined,null,leave),{earnedBase:5200000,leaveDeduction:0});
});
