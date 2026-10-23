import React from 'react';
import {createRoot} from 'react-dom/client';
import Workspace from '../src/components/workspace';
import MoneyInput from '../src/components/money-input';
import ValidatedForm from '../src/components/validated-form';
import {parseMoney} from '../src/lib/currency';
const id='a'.repeat(24), customer='b'.repeat(24),service='c'.repeat(24);
const fixture:any={user:{id,name:'Chủ spa kiểm thử',role:'OWNER',cashier:true},today:'2026-10-23',totals:{treatments:1,remaining:8,bookings:0,debt:0,credit:0,inflow:0},pages:{},staff:[{_id:id,name:'Nhân viên A',role:'OWNER',active:true}],customers:[{_id:customer,name:'Nguyễn Ánh',phone:'0900000000'}],services:[{_id:service,name:'Chăm sóc da',active:true,price:100000,duration:60}],products:[],productGroups:[],packageTemplates:[],appointments:[],invoices:[],deposits:[],allocations:[],cash:[],days:[],uses:[],audit:[],treatments:[{_id:'d'.repeat(24),customerId:customer,serviceId:service,name:'Gói chăm sóc da',status:'ACTIVE',remaining:8,totalSessions:10}]};
const replace=history.replaceState.bind(history);history.replaceState=(...args)=>{replace(...args);window.dispatchEvent(new Event('urlchange'));};
window.fetch=async(input:any)=>{await new Promise(resolve=>setTimeout(resolve,35));return new Response(JSON.stringify(String(input).includes('/api/workspace')?fixture:{customers:fixture.customers,total:1,page:1}),{status:200,headers:{'Content-Type':'application/json'}});};
function Harness(){const [saved,setSaved]=React.useState('');return <><Workspace/><aside id="money-test" style={{margin:20,padding:20,background:'white'}}><h2>Kiểm thử tiền</h2><ValidatedForm onSubmit={e=>{e.preventDefault();setSaved(String(parseMoney(String(new FormData(e.currentTarget).get('amount')))));}}><label>Số tiền<MoneyInput name="amount" required/></label><label>Ghi chú<textarea name="note"/></label><button>Lưu tiền kiểm thử</button></ValidatedForm><output id="saved-money">{saved}</output><p>Dữ liệu minh họa trong bộ nhớ, không kết nối database.</p></aside></>;}
createRoot(document.getElementById('root')!).render(<Harness/>);
