import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {TreatmentConfirmations} from '../src/components/treatment-selection';
import {FormModal} from '../src/components/workspace';
const html=renderToStaticMarkup(<FormModal spec={{title:'Đặt lịch',action:'appointment',fields:[{key:'serviceId',label:'Dịch vụ',options:[['s','Gội đầu']]},{key:'treatmentId',label:'Liệu trình',optional:true,options:[['p','Gói triệt của khách'],['other','Gói khách khác']],optionScopes:{p:{customerId:'c',serviceId:'triệt'},other:{customerId:'another',serviceId:'s'}}}],defaults:{customerId:'c'}}} catalogs={{services:[{_id:'s',name:'Gội đầu',active:true,category:'Gội'},{_id:'triệt',name:'Triệt',active:true,category:'Triệt lông'}],treatments:[{_id:'p',customerId:'c',serviceId:'triệt',name:'Gói triệt của khách',remaining:3,status:'ACTIVE'},{_id:'p2',customerId:'c',serviceId:'s',name:'Gói gội của khách',remaining:4,status:'ACTIVE'},{_id:'other',customerId:'another',serviceId:'s',name:'Gói khách khác',remaining:4,status:'ACTIVE'}]}} busy={false} error="" onClose={()=>{}} onSubmit={()=>{}}/>);
assert.ok(html.includes('Gói triệt của khách'));
assert.ok(!html.includes('Gói khách khác'));
assert.ok(html.includes('appointment-service-choices'));
assert.ok(html.includes('name="serviceId"'));

assert.ok(html.includes('Gói gội của khách'));
assert.ok(html.includes('Nhóm dịch vụ'));
assert.ok(html.includes('Tìm dịch vụ'));
assert.ok(html.includes('name="treatmentIds"'));

const confirmationHtml=renderToStaticMarkup(<TreatmentConfirmations treatments={[{_id:'a',name:'Gội',remaining:2},{_id:'b',name:'Triệt',remaining:4}]}/>);
assert.equal((confirmationHtml.match(/class="signature-pad"/g)||[]).length,1,'one signature pad per invoice');
assert.ok(confirmationHtml.includes('không bắt buộc'));
assert.ok(confirmationHtml.includes('name="signature" value=""'));
assert.ok(confirmationHtml.includes('Gội'));assert.ok(confirmationHtml.includes('Triệt'));
const unsignedModal=renderToStaticMarkup(<FormModal spec={{title:'Ghi buổi',action:'use',fields:[],defaults:{treatmentId:'a',remainingBefore:2},signatureContext:{customer:'Khách',packageName:'Gội',remaining:2,sessionNumber:1,staff:'Staff'}}} catalogs={{}} busy={false} error="" onClose={()=>{}} onSubmit={()=>{}}/>);
assert.ok(!unsignedModal.includes('class="primary" disabled'),'empty signature does not disable saving');

assert.ok(html.includes('name="serviceIds"'));
assert.ok(html.indexOf('Tìm dịch vụ') < html.indexOf('Liệu trình khách đã mua'));
assert.ok(html.indexOf('Dịch vụ lẻ · chọn một hoặc nhiều') < html.indexOf('Liệu trình khách đã mua'));
