import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
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
