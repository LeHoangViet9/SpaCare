import React from 'react';
import {createRoot} from 'react-dom/client';
import Workspace from '../src/components/workspace';
const id='a'.repeat(24),customer='b'.repeat(24),service='c'.repeat(24);
const invoice={_id:'d'.repeat(24),code:'HD000001',customerId:customer,serviceId:service,description:'Service A + Service B',total:350000,paid:100000,kind:'SERVICE',createdAt:'2026-10-25T09:00:00+07:00',creatorName:'Owner'};
const fixture={user:{id,name:'Owner',role:'OWNER',cashier:true},today:'2026-10-25',totals:{bookings:0,debt:250000,credit:0,inflow:0},pages:{invoices:{rows:[invoice],total:1,page:1,pageSize:10}},staff:[{_id:id,name:'Owner',role:'OWNER',active:true}],customers:[{_id:customer,name:'Customer',phone:'0912345678'}],services:[{_id:service,name:'Service A',price:350000,active:true}],products:[],productGroups:[],serviceGroups:[],packageTemplates:[],appointments:[],invoices:[invoice],deposits:[],allocations:[],cash:[],days:[],uses:[],audit:[],treatments:[]};
window.fetch=(async(input:any)=>{if(String(input).startsWith('/api/workspace'))return Response.json(fixture);if(String(input).startsWith('/api/notifications'))return Response.json({items:[],unread:0,publicKey:null});throw new Error('External request blocked');}) as typeof fetch;
history.replaceState(null,'','/workspace/invoices');
createRoot(document.getElementById('root')!).render(<Workspace/>);
