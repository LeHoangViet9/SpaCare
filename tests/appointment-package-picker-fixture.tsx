import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {FormModal} from '../src/components/workspace';
const html=renderToStaticMarkup(<FormModal spec={{title:'Đặt lịch',action:'appointment',fields:[{key:'serviceId',label:'Dịch vụ',options:[['s','Gội đầu']]},{key:'treatmentId',label:'Liệu trình',optional:true,options:[['p','Gói triệt của khách'],['other','Gói khách khác']],optionScopes:{p:{customerId:'c',serviceId:'triệt'},other:{customerId:'another',serviceId:'s'}}}],defaults:{customerId:'c'}}} catalogs={{}} busy={false} error="" onClose={()=>{}} onSubmit={()=>{}}/>);
assert.ok(html.includes('Gói triệt của khách'));
assert.ok(!html.includes('Gói khách khác'));
assert.ok(html.includes('appointment-service-choices'));
assert.ok(html.includes('name="serviceId"'));
