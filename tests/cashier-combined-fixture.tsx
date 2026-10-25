import React from 'react';
import { createRoot } from 'react-dom/client';
import Cashier from '../src/components/cashier';
const customer={_id:'c'.repeat(24),name:'Customer test',phone:'0900000000'};
const staff={_id:'a'.repeat(24),name:'Staff test',active:true,role:'OWNER'};
const data={user:staff,today:'2026-10-25',staff:[staff],services:[{_id:'b'.repeat(24),name:'Service A',price:100000,commission:10000,active:true},{_id:'d'.repeat(24),name:'Service B',price:200000,commission:20000,active:true}],products:[{_id:'e'.repeat(24),name:'Product extra',price:80000,stock:5,active:true,unit:'ml'}],packageTemplates:[],treatments:[{_id:'f'.repeat(24),customerId:customer._id,serviceId:'b'.repeat(24),name:'Existing treatment',status:'ACTIVE',packageType:'SESSIONS',remaining:3,totalSessions:3}]};
window.fetch=(async(input:any)=>{
 if(String(input).startsWith('/api/cash-cards')) return Response.json({cards:[],total:0,page:1});
 if(String(input).startsWith('/api/customers')) return Response.json({customers:[customer],total:1,page:1});
 throw new Error('External requests blocked in fixture');
}) as typeof fetch;
createRoot(document.getElementById('root')!).render(<Cashier data={data} busy={false} initialMode="session" initialCustomer={customer} onSubmit={(action,values)=>{document.getElementById('saved')!.textContent=JSON.stringify({action,values});}} onInvoices={()=>{}} onNewCustomer={()=>{}}/>);
