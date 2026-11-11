import React from 'react';
import {createRoot} from 'react-dom/client';
import Cashier from '../src/components/cashier';
const customer={_id:'c'.repeat(24),name:'Customer fixture',phone:'0900000000'};
const staff={_id:'a'.repeat(24),name:'Staff fixture',active:true,role:'OWNER'};
const service={_id:'b'.repeat(24),name:'Service fixture',category:'Fixture',price:100000,commission:15000,active:true};
const data={user:staff,today:'2026-11-03',staff:[staff],services:[service],products:[{_id:'d'.repeat(24),name:'Product fixture',price:80000,stock:5,active:true,unit:'chai'}],packageTemplates:[{_id:'e'.repeat(24),serviceId:service._id,name:'Package fixture',price:900000,totalSessions:10,packageType:'SESSIONS',active:true}],treatments:[{_id:'f'.repeat(24),customerId:customer._id,serviceId:service._id,name:'Purchased fixture',status:'ACTIVE',packageType:'SESSIONS',remaining:3,totalSessions:3}]};
window.fetch=(async(input:any)=>{
 if(String(input).startsWith('/api/discount-programs'))return Response.json({program:null});
 if(String(input).startsWith('/api/cash-cards'))return Response.json({cards:[],total:0,page:1});
 if(String(input).startsWith('/api/customers'))return Response.json({customers:[customer],total:1,page:1});
 throw Error('External requests blocked');
}) as typeof fetch;
(window as any).__pricingSubmissions=[];
createRoot(document.getElementById('root')!).render(<Cashier data={data} busy={false} initialMode="service" initialCustomer={customer} onSubmit={(action,values)=>{(window as any).__pricingSubmissions.push({action,values});}} onInvoices={()=>{}} onNewCustomer={()=>{}}/>);
