import assert from 'node:assert/strict';
import { mock } from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const id = 'a'.repeat(24), serviceId = 'b'.repeat(24), customerId = 'c'.repeat(24);
const plan = {_id:id,customerId,serviceId,invoiceId:'d'.repeat(24),name:'Gói đã sử dụng',status:'COMPLETED',totalSessions:10,remaining:0,recordedUseCount:10,updatedAt:'2026-11-06T00:00:00.000Z'};
const services = [{_id:serviceId,name:'Chăm sóc da',active:true}];
const fixture: Record<string, any> = {user:{id,role:'OWNER',cashier:true,name:'Chủ spa'},today:'2026-11-06',pages:{treatments:{rows:[plan],page:1,pageSize:10,total:1}},treatments:[plan],services,customers:[{_id:customerId,name:'Khách thử',phone:'0900000000'}],staff:[],invoices:[{_id:plan.invoiceId,paid:1000000,total:1000000,status:'PAID'}],appointments:[],deposits:[],allocations:[],cash:[],days:[],uses:[],audit:[],products:[],productGroups:[],packageTemplates:[],serviceGroups:[],totals:{}};
let index = 0;
fixture._requestKey = new URLSearchParams({section:'packages',search:'',page:'1',allocationPage:'1',pageSize:'10',status:'',employee:'',method:'',direction:'',category:'',customer:'',from:'',to:'',order:'desc'}).toString();
let editing: typeof plan | null = null;
mock.module('react', {namedExports:{...React,useState:(initial:unknown) => {
  const slot=index++;
  return [slot===0 ? fixture : slot===4 ? false : slot===8 ? editing : initial,()=>{}];
}}});
mock.module('next/navigation', {namedExports:{useRouter:()=>({push(){},refresh(){}}),usePathname:()=>'/workspace/packages',useSearchParams:()=>new URLSearchParams()}});
const {default:Workspace} = await import('../src/components/workspace');
const render = () => { index=0; return renderToStaticMarkup(React.createElement(Workspace)); };
let html=render();
assert.ok(html.includes('row-action-menu'));
assert.ok(html.includes('>Sửa gói</button>'), 'OWNER can edit a completed, fully paid plan from the actions menu');
editing=plan;
html=render();
assert.ok(html.includes('aria-label="Sửa gói của khách"'));
assert.ok(html.includes('Xem trước thay đổi'), 'List dialog uses the shared edit form');
assert.ok(html.includes('value="Gói đã sử dụng"'));
assert.ok(html.includes('Đã dùng: 10 buổi'), 'Preview shows the server-loaded use count');
assert.ok(!html.includes('class="row-action-options"><div class="modal-backdrop"'), 'Dialog must stay outside the closing row menu');
for(const cashier of [false,true]){
  fixture.user={...fixture.user,role:'STAFF',cashier};
  html=render();
  assert.ok(!html.includes('>Sửa gói</button>'));
  assert.ok(!html.includes('aria-label="Sửa gói của khách"'));
}
