import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import InvoiceReplacement,{InvoiceDocumentHistory} from '../src/components/invoice-replacement';
import InvoiceDetail from '../src/components/invoice-detail';
import CashEntryNote from '../src/components/cash-entry-note';
import { invoiceHandlingReasons, type HandlingContext } from '../src/lib/invoice-handling';
const a='a'.repeat(24),b='b'.repeat(24),c='c'.repeat(24);
const invoice={_id:a,code:'HD000001',kind:'PACKAGE',total:1750000,paid:1750000,status:'PAID',updatedAt:'2026-11-02T01:00:00.000Z',saleParticipants:[{staffId:b,staffName:'Tư vấn A'}]};
const legacy=new URLSearchParams(location.search).has('legacy');
const detail=new URLSearchParams(location.search).has('detail');
let currentInvoice:Record<string,any>={...invoice,description:'Gói minh họa',createdAt:'2026-11-02T01:00:00.000Z',activeDocumentId:a,effectiveCode:'HD000001'};
currentInvoice.sellerId=b;currentInvoice.saleCommissionVersion=1;
const scenario=new URLSearchParams(location.search).get('scenario');
if(scenario){delete currentInvoice.activeDocumentId;if(['unused','pending','used'].includes(scenario)){currentInvoice.paid=0;currentInvoice.status='OPEN';}}
const context:HandlingContext={used:scenario==='used',appointments:scenario==='pending',pendingAppointments:scenario==='pending',changedPlan:false,history:false,giftCards:false,usedGiftCard:false,settled:false,lineCommission:false,packageCommission:false,oldDayClosed:scenario==='closed',todayClosed:false,receiptDayOpen:true,directPayment:true,hasActivePayment:false};
if(new URLSearchParams(location.search).has('unreplaced'))delete currentInvoice.activeDocumentId;
const calls:any[]=[];
(window as any).__replacementCalls=calls;
window.fetch=(async(input:any,options:any)=>{
 if(detail && String(input).startsWith('/api/invoices/'+a+'?'))return Response.json({invoice:currentInvoice,treatment:null,handling:invoiceHandlingReasons(currentInvoice,context,scenario!=='staff'),customer:{name:'Khách fixture'},events:[],signatures:[],signatureTotal:0});
 if(String(input)!=='/api/operations')throw Error('External request blocked');
 const body=JSON.parse(options.body);calls.push({...body,key:options.headers['Idempotency-Key']});
 if(body.action==='previewPackageAdvisorReplacement')return Response.json({before:detail?currentInvoice.saleParticipants:invoice.saleParticipants,after:[{staffId:body.data.newStaffId,staffName:'Tư vấn mới'}],pool:87500,formula:'floor((paid - refunded) / 20)',payment:{id:a,receiptId:c,amount:1750000,method:'CASH'},treatmentIds:[b],beforeShares:[{staffId:b,total:87500}],afterShares:[{staffId:c,total:87500}]});
 await new Promise(r=>setTimeout(r,100));
 if(detail)currentInvoice={...currentInvoice,activeDocumentId:c,effectiveCode:'HD000002',saleParticipants:[{staffId:c,staffName:'Tư vấn B'}]};
 return Response.json({id:a,code:'HD000002'});
}) as typeof fetch;
function App(){const[done,setDone]=useState(false);return <main style={{maxWidth:800,margin:'auto',padding:16}}><InvoiceReplacement invoice={invoice} staff={[{_id:c,name:'Tư vấn B',role:'STAFF',active:true}]} onChanged={()=>setDone(true)}/>{done && <p role="status">Đã thay thế thành công</p>}<InvoiceDocumentHistory invoice={{...invoice,effectiveCode:'HD000002',activeDocumentId:c,documentHistory:[{documentId:a,...(legacy?{legacyInvoiceId:a}:{code:'HD000001'}),status:'REPLACED',replacedById:c,replacedByCode:'HD000002',replacedAt:'2026-11-02T02:00:00.000Z',reason:'Ghi nhầm người tư vấn',snapshot:{...invoice,...(legacy?{code:undefined}:{}),description:'Gói minh họa',createdAt:'2026-11-02T01:00:00.000Z'}}]}}/><button onClick={()=>{document.getElementById('calls')!.textContent=JSON.stringify(calls);}}>Đọc yêu cầu fixture</button><pre id="calls"/></main>;}
function DetailApp(){const[done,setDone]=useState(false);const action=(name:string)=>(()=>{calls.push({opened:name});});const owner=scenario!=='staff';return <><InvoiceDetail record={{kind:'invoice',id:a}} replacementStaff={owner?[{_id:b,name:'Tư vấn A',role:'STAFF',active:true},{_id:c,name:'Tư vấn B',role:'STAFF',active:true}]:undefined} onEdit={owner?action('updateInvoice'):undefined} onCorrectDate={owner?action('correctInvoiceDate'):undefined} onCancel={owner?action('cancelInvoice'):undefined} onDelete={owner?action('deleteInvoice'):undefined} onClose={()=>{}} onInvoice={()=>{}} onReplacement={()=>setDone(true)}/>{done && <output id="detail-done">Đã thay thế thành công</output>}<button onClick={()=>{document.getElementById('calls')!.textContent=JSON.stringify(calls);}}>Đọc yêu cầu fixture</button><pre id="calls"/></>;}
function LedgerApp(){return <main style={{padding:16}}><h1>Sổ thu chi · fixture giả</h1><table><tbody>{[
 {_id:a,kind:'PAYMENT',note:'Thu thanh toán gói',paymentInvoiceCode:'HD000067'},
 {_id:b,kind:'REVERSAL',originalId:a,note:'Đảo khoản thu gói',reversalInvoiceCode:'HD000067'},
 {_id:c,kind:'REVERSAL',originalId:'d'.repeat(24),note:'Đảo thu khác'},
].map(entry=><tr key={entry._id}><td><CashEntryNote entry={entry} fallback={entry.kind}/></td></tr>)}</tbody></table></main>;}
createRoot(document.getElementById('root')!).render(new URLSearchParams(location.search).has('ledger')?<LedgerApp/>:detail?<DetailApp/>:<App/>);
