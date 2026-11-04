import React from 'react';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import EmployeeAttendance from '../src/components/employee-attendance';
const data={people:[{_id:'owner',name:'Owner must not appear',role:'OWNER'},{_id:'staff',name:'Nguyễn Thị Mai',role:'STAFF'}],leaveSummary:[{staffId:'staff',permitted:1,unpermitted:0,paid:1,unpaid:0}],workSummary:[{_id:'staff',days:23}],leaves:[{_id:'leave',staffId:'staff',staffName:'Nguyễn Thị Mai',day:'2026-10-20',type:'PERMITTED',period:'FULL',status:'PENDING'}],leaveTotal:1,workdays:[{_id:'work',staffId:'staff',day:'2026-10-21',period:'FULL'}],workTotal:1};
const html=renderToStaticMarkup(<EmployeeAttendance data={data} owner={true} userId="owner" employee="" today="2026-10-23" loading={false} onOpen={()=>{}} onLeavePage={()=>{}} onWorkPage={()=>{}} />);
assert.equal((html.match(/<table/g)||[]).length,2); assert.equal((html.match(/<article/g)||[]).length,1); assert.doesNotMatch(html,/Owner must not appear/);
assert.match(html,/Danh sách nghỉ phép/); assert.doesNotMatch(html,/Ngày công thực tế đã ghi|Ghi ngày công|Công đã ghi/); assert.match(html,/Tổng hợp nghỉ/); assert.match(html,/Số ngày nghỉ/); assert.match(html,/>Duyệt</);
if(process.argv.includes('--preview')) console.log(JSON.stringify('<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+['ui.css','globals.css','public.css'].map(f=>readFileSync('src/app/'+f,'utf8')).join('\n')+'</style><body><main class="app" style="padding:16px;display:block">'+html+'</main></body></html>'));

const single=renderToStaticMarkup(<EmployeeAttendance data={{...data,leaves:[
 {...data.leaves[0],startDay:'2026-10-20',endDay:'2026-10-22',period:'AM',note:'Nghỉ việc gia đình'},
 {...data.leaves[0],_id:'approved',status:'APPROVED',paid:true},
 {...data.leaves[0],_id:'rejected',status:'REJECTED'},
 {...data.leaves[0],_id:'legacy',status:undefined},
]}} owner={false} userId="staff" employee="staff" today="2026-10-23" loading={false} onOpen={()=>{}} onLeavePage={()=>{}} onWorkPage={()=>{}} />);
assert.doesNotMatch(single,/Nguyễn Thị Mai|>Nhân viên</);
const cards=single.split('class="leave-mobile leave-request-list"')[1].split('</ul>')[0];
assert.equal((cards.match(/<article/g)||[]).length,4);
assert.equal((cards.match(/>Sửa</g)||[]).length,1);
assert.doesNotMatch(cards,/>Duyệt<|>Từ chối<\/button>/);
assert.match(cards,/20\/10\/2026/);assert.match(cards,/22\/10\/2026/);assert.match(cards,/1,5 ngày/);
assert.match(cards,/Có hưởng lương/);assert.match(cards,/Không hưởng lương/);assert.match(cards,/Nghỉ việc gia đình/);assert.match(cards,/Đã ghi/);
const empty=renderToStaticMarkup(<EmployeeAttendance data={{...data,leaves:[],leaveTotal:0}} owner={true} userId="owner" employee="staff" today="2026-10-23" loading={false} onOpen={()=>{}} onLeavePage={()=>{}} onWorkPage={()=>{}} />);
assert.match(empty,/Chưa có đơn nghỉ trong tháng này/);assert.match(empty,/Ghi nghỉ phép/);assert.doesNotMatch(empty,/Xoay ngang điện thoại|<article/);
