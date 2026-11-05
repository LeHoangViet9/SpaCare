import React from 'react';
import {createRoot} from 'react-dom/client';
import Workspace, { FormModal } from '../src/components/workspace';
import MoneyInput from '../src/components/money-input';
import ValidatedForm from '../src/components/validated-form';
import {parseMoney} from '../src/lib/currency';
import InvoiceDetail from '../src/components/invoice-detail';
const id='a'.repeat(24), customer='b'.repeat(24),service='c'.repeat(24);
const fixture:any={user:{id,name:'Chủ spa kiểm thử',role:'OWNER',cashier:true},today:'2026-10-23',totals:{treatments:1,remaining:8,bookings:0,debt:0,credit:0,inflow:0},pages:{},staff:[{_id:id,name:'Nhân viên A',role:'OWNER',active:true}],customers:[{_id:customer,name:'Nguyễn Ánh',phone:'0900000000'}],services:[{_id:service,name:'Chăm sóc da',active:true,price:100000,duration:60}],products:[],productGroups:[],packageTemplates:[],appointments:[],invoices:[],deposits:[],allocations:[],cash:[],days:[],uses:[],audit:[],treatments:[{_id:'d'.repeat(24),customerId:customer,serviceId:service,name:'Gói chăm sóc da',status:'ACTIVE',remaining:8,totalSessions:10}]};
const replace=history.replaceState.bind(history);history.replaceState=(...args)=>{replace(...args);window.dispatchEvent(new Event('urlchange'));};
const detailFixture = {
 invoice: {_id:id,code:'HD000123',customerId:customer,kind:'SERVICE',description:'Massage CVG + Dầu gội khách',total:1500000,paid:1500000,createdAt:'2026-11-05T05:00:00Z',performedAt:'2026-11-05T05:00:00Z',creatorName:'Chủ spa kiểm thử',serviceItems:[
  {lineId:'a',name:'Massage CVG',total:500000,performerName:'Thư'},
  {lineId:'b',name:'Dầu gội khách',total:1000000,performerName:'Quỳnh'},
  {lineId:'c',name:'Dịch vụ chưa phân công với tên dài để kiểm tra bố cục trên điện thoại',total:0,performerName:null},
 ]},customer:fixture.customers[0],events:[],signatures:[],payments:[{_id:'p1',method:'BANK_TRANSFER',amount:500000},{_id:'p2',method:'CASH',amount:600000},{_id:'p3',method:'CASH',amount:400000}],
};
const paymentInvoice = {_id:id,code:'HD000124',customerId:customer,kind:'SERVICE',description:'Hóa đơn thanh toán thử',total:1500000,paid:0,createdAt:'2026-11-05T05:00:00Z'};
fixture.invoices = [paymentInvoice]; fixture.pages.invoices = {rows:[paymentInvoice],total:1,page:1,pageSize:10};
function PaymentHarness() {
 const [saved,setSaved] = React.useState('');
 const options = new URLSearchParams(location.search);
 const invoice = {...paymentInvoice,paid:Number(options.get('paid') || 0),...(options.has('lines') ? {serviceItems:[
  {lineId:'1'.repeat(24),name:'Massage CVG',total:1000000,paid:0},
  {lineId:'2'.repeat(24),name:'Dầu gội khách',total:500000,paid:0},
 ]} : {})};
 return <><FormModal catalogs={{paymentInfo:{bankName:'Ngân hàng thử',accountNumber:'000000',accountName:'SPA TEST'}}} busy={false} error="" onClose={()=>{}} onSubmit={values=>setSaved(JSON.stringify(values))} spec={{title:'Thanh toán',action:'splitPayment',defaults:{invoice},fields:[]}}/><output hidden id="saved-payment">{saved}</output></>;
}
window.fetch=async(input:any)=>{await new Promise(resolve=>setTimeout(resolve,35));return new Response(JSON.stringify(String(input).startsWith('/api/cash-cards')?{cards:[],uses:[],total:0,useTotal:0}:String(input).startsWith('/api/invoices/')?detailFixture:String(input).includes('/api/workspace')?fixture:{customers:fixture.customers,total:1,page:1}),{status:200,headers:{'Content-Type':'application/json'}});};
function Harness(){const [saved,setSaved]=React.useState('');return <><Workspace/><aside id="money-test" style={{margin:20,padding:20,background:'white'}}><h2>Kiểm thử tiền</h2><ValidatedForm onSubmit={e=>{e.preventDefault();setSaved(String(parseMoney(String(new FormData(e.currentTarget).get('amount')))));}}><label>Số tiền<MoneyInput name="amount" required/></label><label>Ghi chú<textarea name="note"/></label><button>Lưu tiền kiểm thử</button></ValidatedForm><output id="saved-money">{saved}</output><p>Dữ liệu minh họa trong bộ nhớ, không kết nối database.</p></aside></>;}
createRoot(document.getElementById('root')!).render(location.pathname === '/split-payment' ? <PaymentHarness/> : location.pathname === '/invoice-detail' ? <InvoiceDetail record={{kind:'invoice',id}} onClose={()=>{}} onInvoice={()=>{}} onEdit={()=>{}}/> : <Harness/>);
