import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import InvoiceAdjustmentDialog from '../src/components/invoice-adjustment';
import {TreatmentEditDialog} from '../src/components/treatment-edit';
import CommercialFields from '../src/components/commercial-fields';
import Cashier from '../src/components/cashier';
import {FormModal} from '../src/components/workspace';
import InvoiceReplacement,{InvoiceDocumentHistory} from '../src/components/invoice-replacement';
import InvoiceDetail from '../src/components/invoice-detail';
import InvoiceListActions from '../src/components/invoice-list-actions';
import CashEntryNote from '../src/components/cash-entry-note';
import { invoiceHandlingReasons, type HandlingContext } from '../src/lib/invoice-handling';
const a='a'.repeat(24),b='b'.repeat(24),c='c'.repeat(24);
const invoice={_id:a,code:'HD000001',kind:'PACKAGE',total:1750000,paid:1750000,status:'PAID',updatedAt:'2026-11-02T01:00:00.000Z',saleParticipants:[{staffId:b,staffName:'Tư vấn A'}]};
const legacy=new URLSearchParams(location.search).has('legacy');
const detail=new URLSearchParams(location.search).has('detail');
let currentInvoice:Record<string,any>={...invoice,description:'Gói minh họa',createdAt:'2026-11-02T01:00:00.000Z',activeDocumentId:a,effectiveCode:'HD000001'};
currentInvoice.sellerId=b;currentInvoice.saleCommissionVersion=1;
const scenario=new URLSearchParams(location.search).get('scenario');
const display=new URLSearchParams(location.search).get('display');
const receiptCase=new URLSearchParams(location.search).get('case');
const contentEdit=new URLSearchParams(location.search).has('content-edit');
const editCatalogs={services:[{_id:b,name:'Chăm sóc da',active:true,price:300000},{_id:'d'.repeat(24),name:'Gội đầu',active:true,price:100000}],products:[{_id:c,name:'Sữa rửa mặt',unit:'chai',active:true,stock:7,price:50000}],packageTemplates:[{_id:'e'.repeat(24),name:'Chăm sóc 5 buổi',serviceId:b,active:true,totalSessions:5,price:1000000}],staff:[{_id:b,name:'Kỹ thuật viên A',active:true,role:'STAFF'},{_id:c,name:'Tư vấn B',active:true,role:'STAFF'}]};
if(contentEdit){
 Object.assign(currentInvoice,{kind:'SERVICE',customerId:c,customerName:'Khách fixture',description:'Hóa đơn đang sửa',total:450000,paid:0,status:'OPEN',dueDate:'2026-11-10',consultantId:c,consultantName:'Tư vấn B',promotion:'Ưu đãi cũ',saleParticipants:[],sellerId:undefined,serviceItems:[{lineId:'service-old',serviceId:b,name:'Chăm sóc da',total:300000,performerId:b}],productItems:[{lineId:'product-old',productId:c,name:'Sữa rửa mặt',unit:'chai',quantity:3,unitPrice:50000,total:150000}]});delete currentInvoice.activeDocumentId;
 currentInvoice.editContext={client:{customerId:c,description:currentInvoice.description,dueDate:currentInvoice.dueDate,promotion:currentInvoice.promotion,consultantId:c,participantIds:[],serviceItems:[{key:'service-old',sourceIndex:0,serviceId:b,total:300000,performerId:b}],productItems:[{key:'product-old',sourceIndex:0,productId:c,quantity:3,unitPrice:50000}],packageItems:[]},source:{serviceItems:currentInvoice.serviceItems,productItems:currentInvoice.productItems,packageItems:[],treatmentSessions:[]},catalogs:editCatalogs,locks:{customer:scenario==='used'?'Khách đã có lịch sử.':'',metadata:'',consultant:'',promotion:'',participants:'',services:[{identity:scenario==='used'?'Dịch vụ đã thực hiện; giữ dòng và kỹ thuật viên.':'',price:''}],products:'',packages:[],addService:scenario==='used'?'Dịch vụ đã thực hiện.':'',addPackage:''},references:{gifts:[],giftCards:[]}};
 if(receiptCase==='content-service'){
  Object.assign(currentInvoice,{total:300000,productItems:[]});currentInvoice.editContext.client.productItems=[];currentInvoice.editContext.source.productItems=[];
 }
 if(receiptCase==='content-product'){
  Object.assign(currentInvoice,{kind:'PRODUCT',total:150000,serviceItems:[]});currentInvoice.editContext.client.serviceItems=[];currentInvoice.editContext.source.serviceItems=[];
 }
 if(receiptCase==='content-package'||receiptCase==='content-all'){
  editCatalogs.packageTemplates.push({_id:'f'.repeat(24),name:'Chăm sóc 10 buổi',serviceId:b,active:true,totalSessions:10,price:1500000},{_id:'1'.repeat(24),name:'Gói đã ngừng',serviceId:b,active:false,totalSessions:10,price:1500000});
  const all=receiptCase==='content-all';
  Object.assign(currentInvoice,{kind:'PACKAGE',total:all?1450000:1000000,serviceItems:all?currentInvoice.serviceItems:[],productItems:all?currentInvoice.productItems:[],packageItems:[{lineId:'package-old',templateId:'e'.repeat(24),treatmentId:'2'.repeat(24),serviceId:b,name:'Chăm sóc 5 buổi',total:1000000,totalSessions:5,packageType:'SESSIONS',promotion:'Ưu đãi gói'}],sellerId:b,sellerName:'Kỹ thuật viên A',saleParticipants:[{staffId:b,staffName:'Kỹ thuật viên A'}]});
  Object.assign(currentInvoice.editContext.client,{serviceItems:all?currentInvoice.editContext.client.serviceItems:[],productItems:all?currentInvoice.editContext.client.productItems:[],participantIds:[b],packageItems:[{key:'package-old',sourceIndex:0,templateId:'e'.repeat(24),total:1000000,totalSessions:5,promotion:'Ưu đãi gói'}]});
  Object.assign(currentInvoice.editContext.source,{serviceItems:currentInvoice.serviceItems,productItems:currentInvoice.productItems,packageItems:currentInvoice.packageItems});currentInvoice.editContext.locks.packages=[scenario==='used'?'Gói đã dùng buổi; giữ lịch sử.':''];
  if(scenario==='used')currentInvoice.editContext.locks.addPackage='Đã có lịch sử dùng buổi.';
 }
 if(scenario==='correction'){
  Object.assign(currentInvoice,{total:300000,paid:300000,status:'PAID',performedAt:'2026-11-02T01:00:00.000Z',performedBy:b,productItems:[]});
  currentInvoice.editContext.client.productItems=[];currentInvoice.editContext.source.productItems=[];
  Object.assign(currentInvoice.editContext.locks,{correctionOnly:true,metadata:'Chỉ đính chính dịch vụ hoặc kỹ thuật viên đã thực hiện.',services:[{identity:'',price:'Đính chính không thay đổi giá dịch vụ.',correctionOnly:true}],products:'',addService:'Dịch vụ đã thực hiện.'});
 }
 if(scenario==='session-correction'){
  const session={lineId:'service-old',treatmentUseId:'f'.repeat(24),name:'Chăm sóc da · Buổi 1',performerId:b,performerName:'Kỹ thuật viên A',total:0,paid:0};
  Object.assign(currentInvoice,{kind:'SESSION',total:0,paid:0,status:'PAID',performedAt:'2026-11-02T01:00:00.000Z',performedBy:b,serviceItems:[{lineId:'service-old',serviceId:b,name:'Chăm sóc da',total:0,commission:10000,performerId:b}],productItems:[],treatmentSessions:[session]});
  Object.assign(currentInvoice.editContext.client,{serviceItems:[{key:'service-old',sourceIndex:0,serviceId:b,total:0,performerId:b}],productItems:[]});
  Object.assign(currentInvoice.editContext.source,{serviceItems:currentInvoice.serviceItems,productItems:[],treatmentSessions:[session]});
  Object.assign(currentInvoice.editContext.locks,{correctionOnly:true,metadata:'Chỉ đính chính dịch vụ hoặc kỹ thuật viên đã thực hiện.',services:[{identity:'',price:'Giá dịch vụ được giữ nguyên.',correctionOnly:true,technicianOnly:true}],products:'',addService:'Buổi đã thực hiện.',treatmentSessions:'Chỉ đính chính KTV; dịch vụ, số buổi, chữ ký và thời điểm thực hiện được giữ nguyên.'});
  delete currentInvoice.activeDocumentId;
 }
}
if(receiptCase==='receipt-single'||receiptCase==='receipt-many')Object.assign(currentInvoice,{total:300000,paid:receiptCase==='receipt-many'?50000:30000,payments:[{_id:b,receiptId:c,amount:30000,day:'2026-11-07',method:'CASH'},...(receiptCase==='receipt-many'?[{_id:c,receiptId:b,amount:20000,day:'2026-11-06',method:'BANK_TRANSFER'}]:[])]});
const voidReceiptCase=receiptCase?.startsWith('void-');
if(voidReceiptCase){Object.assign(currentInvoice,{kind:'SERVICE',total:receiptCase==='void-cancelled'?0:300000,paid:receiptCase==='void-cancelled'?0:300000,status:receiptCase==='void-cancelled'?'CANCELLED':'PAID',adjustmentCredit:receiptCase==='void-cancelled'?300000:0,cancelledTotal:receiptCase==='void-cancelled'?300000:undefined,payments:[{_id:b,receiptId:c,amount:100000,day:'2026-11-07',method:'CASH'},{_id:c,receiptId:b,amount:200000,day:'2026-11-07',method:'BANK_TRANSFER'}]});delete currentInvoice.activeDocumentId;}
const signature={version:1,strokes:[[[0.1,0.3],[0.3,0.7],[0.8,0.2]]]};
if(display)Object.assign(currentInvoice,{kind:'SESSION',description:'Dịch vụ đã thực hiện',total:250000,paid:150000,status:'PARTIAL',creatorName:'Thu ngân fixture',performerName:'Kỹ thuật viên fixture',performedAt:'2026-11-02T01:00:00.000Z',serviceItems:[{lineId:'line-a',serviceId:b,name:'Chăm sóc da',total:100000},{lineId:'line-b',serviceId:b,name:'Gội đầu dưỡng sinh',total:150000}]});
if(display==='sessions')Object.assign(currentInvoice,{serviceItems:[{lineId:'line-a',serviceId:b,name:'Chăm sóc da · Buổi 1',total:0}],treatmentSessions:[{lineId:'line-a',treatmentUseId:b,name:'Chăm sóc da · Buổi 1',total:0},{lineId:'line-b',treatmentUseId:c,name:'Gội đầu dưỡng sinh · Buổi 1',total:0}],total:0,paid:0});
if(display)for(const group of ['serviceItems','treatmentSessions'])currentInvoice[group]?.forEach((item:Record<string,any>,index:number)=>{item.performerName=index===0?'Thư fixture':'Quỳnh fixture';});
if(scenario){delete currentInvoice.activeDocumentId;if(['unused','pending','used'].includes(scenario)){currentInvoice.paid=0;currentInvoice.status='OPEN';}}
const context:HandlingContext={used:scenario==='used',appointments:scenario==='pending',pendingAppointments:scenario==='pending',changedPlan:false,history:false,giftCards:false,usedGiftCard:false,settled:false,lineCommission:false,packageCommission:false,oldDayClosed:scenario==='closed',todayClosed:false,receiptDayOpen:true,directPayment:true,hasActivePayment:false};
if(new URLSearchParams(location.search).has('unreplaced'))delete currentInvoice.activeDocumentId;
const calls:any[]=[];
const voidResults=new Map<string,Record<string,any>>();let droppedVoidResponse=false;
(window as any).__replacementCalls=calls;
window.fetch=(async(input:any,options:any)=>{
 if(String(input).startsWith('/api/discount-programs'))return Response.json({program:null});
 if(String(input).startsWith('/api/invoices/'+a+'?edit=1'))return Response.json({invoice:currentInvoice,customer:{name:'Khách fixture'},payments:currentInvoice.payments||[],adjustmentContext:{stock:false,packages:false,gifts:false},editContext:receiptCase==='missing-context'?undefined:currentInvoice.editContext||{
  client:{customerId:c,description:currentInvoice.description,dueDate:null,promotion:'',consultantId:null,participantIds:[],serviceItems:[],productItems:[],packageItems:[]},
  source:{serviceItems:[],productItems:[],packageItems:[],treatmentSessions:[]},catalogs:editCatalogs,locks:{metadata:'',services:[],packages:[]},references:{gifts:[],giftCards:[]}}});
 if(contentEdit&&String(input).startsWith('/api/customers'))return Response.json({customers:[{_id:c,name:'Khách fixture',phone:'0900000000'}],total:1,page:1});
 if(new URLSearchParams(location.search).has('creation')){
  if(String(input).startsWith('/api/customers'))return Response.json({customers:[{_id:c,name:'Khách hồi tố',phone:'0900000000'}],total:1,page:1});
  if(String(input).startsWith('/api/cash-cards'))return Response.json({cards:[],total:0,page:1});
 }
 if(detail && String(input).startsWith('/api/invoices/'+a+'?'))return Response.json({invoice:currentInvoice,payments:currentInvoice.payments||[],canAdjustInvoice:!!voidReceiptCase&&scenario!=='staff',adjustmentContext:{stock:false,packages:false,gifts:false},treatment:null,handling:{...invoiceHandlingReasons(currentInvoice,context,scenario!=='staff'),...(scenario!=='staff'&&currentInvoice.status!=='CANCELLED'?{edit:'',void:''}:{})},customer:{name:'Khách fixture',phone:'0900000000'},events:[],signatures:display?[{id:b,packageName:'Tên gói không thuộc mục chữ ký · Buổi 1',sessionNumber:1,performedAt:'2026-11-02T01:00:00.000Z',signature:display==='signed'?signature:null},{id:c,packageName:'Gói thứ hai · Buổi 1',sessionNumber:1,performedAt:'2026-11-02T01:00:00.000Z',signature:display==='empty'?{version:1,strokes:[]}:null}]:[],signatureTotal:display?2:0});
 if(String(input)!=='/api/operations')throw Error('External request blocked');
 const body=JSON.parse(options.body);calls.push({...body,key:options.headers['Idempotency-Key']});
 if(voidReceiptCase&&body.action==='previewInvoiceAdjustment'){
  const selected=currentInvoice.payments.filter((p:any)=>body.data.mistakenPaymentIds?.includes(p._id)),amount=selected.reduce((n:number,p:any)=>n+p.amount,0);
  return Response.json({before:currentInvoice,after:{...currentInvoice,total:0,paid:0,status:'CANCELLED',adjustmentCredit:currentInvoice.paid+(currentInvoice.adjustmentCredit||0)-amount},delta:-currentInvoice.total,previewToken:'a'.repeat(64),reconciliation:{balance:{},commissionChanges:[],...(selected.length?{mistakenReceipts:{total:amount,rows:selected.map((p:any)=>({paymentId:p._id,receiptId:p.receiptId,amount:p.amount,method:p.method,originalDay:p.day,reversalDay:'2026-11-08'}))}}:{})}});
 }
 if(voidReceiptCase&&body.action==='applyInvoiceAdjustment'){
  const key=options.headers['Idempotency-Key'];if(voidResults.has(key))return Response.json(voidResults.get(key));
  const selected=currentInvoice.payments.filter((p:any)=>body.data.mistakenPaymentIds?.includes(p._id));currentInvoice={...currentInvoice,total:0,paid:0,status:'CANCELLED',adjustmentCredit:currentInvoice.paid+(currentInvoice.adjustmentCredit||0)-selected.reduce((n:number,p:any)=>n+p.amount,0),payments:currentInvoice.payments.filter((p:any)=>!body.data.mistakenPaymentIds?.includes(p._id))};voidResults.set(key,{id:a});
  if(scenario==='retry'&&!droppedVoidResponse){droppedVoidResponse=true;throw Error('Mất kết nối sau khi lưu fixture');}return Response.json({id:a});
 }
 if(contentEdit&&body.action==='previewInvoiceAdjustment'){
  const patch=body.data.content||{},after={...currentInvoice,...patch,total:body.data.total};
  for(const [kind,field,catalog]of [['serviceItems','serviceId',editCatalogs.services],['productItems','productId',editCatalogs.products],['packageItems','templateId',editCatalogs.packageTemplates]] as const)if(patch[kind])after[kind]=patch[kind].map((r:any)=>({...r,name:catalog.find(p=>p._id===r[field])?.name,total:kind==='productItems'?r.quantity*r.unitPrice:r.total}));
  if(scenario==='session-correction'&&patch.serviceItems)after.treatmentSessions=currentInvoice.treatmentSessions.map((row:any)=>({...row,performerId:patch.serviceItems.find((line:any)=>line.key===row.lineId)?.performerId||row.performerId}));
  return Response.json({before:currentInvoice,after,delta:body.data.total-currentInvoice.total,noChanges:Object.keys(patch).length===0&&body.data.total===currentInvoice.total,previewToken:'a'.repeat(64),reconciliation:{content:{displayBefore:currentInvoice,displayAfter:after,totalAdjustment:0},balance:{},commissionChanges:[],receiptChanges:[]}});
 }
 if(body.action==='previewInvoiceAdjustment'&&scenario==='closed'&&receiptCase==='receipt-single')return Response.json({error:'Sổ ngày 2026-11-07 chưa mở hoặc đã chốt. Chưa có quy trình điều chỉnh khoản thu của ngày đã chốt an toàn; không sửa snapshot. Chủ spa cần đối soát và mở lại sổ theo quy trình hiện có.'},{status:409});
 if(body.action==='previewInvoiceAdjustment')return Response.json({before:currentInvoice,after:{...currentInvoice,total:body.data.total,paid:body.data.paid??Math.min(currentInvoice.paid,body.data.total),adjustmentCredit:Math.max(0,currentInvoice.paid-body.data.total),...(body.data.issuedOn?{createdAt:body.data.issuedOn+'T12:00:00+07:00'}:{})},delta:body.data.total-currentInvoice.total,previewToken:'a'.repeat(64),reconciliation:{receipts:(currentInvoice.payments||[]).map((row:any)=>({...row,_id:row.receiptId})),receiptChanges:(body.data.receiptCorrections||[]).map((row:any)=>{const old=currentInvoice.payments.find((source:any)=>source._id===row.paymentId);return {paymentId:row.paymentId,receiptId:old.receiptId,method:old.method,before:{amount:old.amount,day:old.day},after:{amount:row.amount,day:row.day}};}),balance:{depositReturn:0,cardReturn:0},commissionChanges:[]}});
 if(body.action==='previewPackageAdvisorReplacement')return Response.json({before:detail?currentInvoice.saleParticipants:invoice.saleParticipants,after:[{staffId:body.data.newStaffId,staffName:'Tư vấn mới'}],pool:87500,formula:'floor((paid - refunded) / 20)',payment:{id:a,receiptId:c,amount:1750000,method:'CASH'},treatmentIds:[b],beforeShares:[{staffId:b,total:87500}],afterShares:[{staffId:c,total:87500}]});
 await new Promise(r=>setTimeout(r,100));
 if(detail)currentInvoice={...currentInvoice,activeDocumentId:c,effectiveCode:'HD000002',saleParticipants:[{staffId:c,staffName:'Tư vấn B'}]};
 return Response.json({id:a,code:'HD000002'});
}) as typeof fetch;
function App(){const[done,setDone]=useState(false);return <main style={{maxWidth:800,margin:'auto',padding:16}}><InvoiceReplacement invoice={invoice} staff={[{_id:c,name:'Tư vấn B',role:'STAFF',active:true}]} onChanged={()=>setDone(true)}/>{done && <p role="status">Đã thay thế thành công</p>}<InvoiceDocumentHistory invoice={{...invoice,effectiveCode:'HD000002',activeDocumentId:c,documentHistory:[{documentId:a,...(legacy?{legacyInvoiceId:a}:{code:'HD000001'}),status:'REPLACED',replacedById:c,replacedByCode:'HD000002',replacedAt:'2026-11-02T02:00:00.000Z',reason:'Ghi nhầm người tư vấn',snapshot:{...invoice,...(legacy?{code:undefined}:{}),description:'Gói minh họa',createdAt:'2026-11-02T01:00:00.000Z'}}]}}/><button onClick={()=>{document.getElementById('calls')!.textContent=JSON.stringify(calls);}}>Đọc yêu cầu fixture</button><pre id="calls"/></main>;}
function DetailApp(){const[done,setDone]=useState(false);const action=(name:string)=>(()=>{calls.push({opened:name});});const owner=scenario!=='staff';return <><InvoiceDetail record={{kind:'invoice',id:a}} replacementStaff={owner?[{_id:b,name:'Tư vấn A',role:'STAFF',active:true},{_id:c,name:'Tư vấn B',role:'STAFF',active:true}]:undefined} onEdit={owner?action('openCorrection'):undefined} onCorrectDate={owner?action('correctInvoiceDate'):undefined} onCancel={owner?action('cancelInvoice'):undefined} onDelete={owner?action('openVoid'):undefined} onClose={()=>{}} onInvoice={()=>{}} onReplacement={()=>setDone(true)}/>{done && <output id="detail-done">Đã thay thế thành công</output>}<button onClick={()=>{document.getElementById('calls')!.textContent=JSON.stringify(calls);}}>Đọc yêu cầu fixture</button><pre id="calls"/></>;}
function LedgerApp(){return <main style={{padding:16}}><h1>Sổ thu chi · fixture giả</h1><table><tbody>{[
 {_id:a,kind:'PAYMENT',note:'Thu thanh toán gói',paymentInvoiceCode:'HD000067'},
 {_id:b,kind:'REVERSAL',originalId:a,note:'Đảo khoản thu gói',reversalInvoiceCode:'HD000067'},
 {_id:c,kind:'REVERSAL',originalId:'d'.repeat(24),note:'Đảo thu khác'},
].map(entry=><tr key={entry._id}><td><CashEntryNote entry={entry} fallback={entry.kind}/></td></tr>)}</tbody></table></main>;}
function ListApp(){const owner=scenario!=='staff';const row:Record<string,any>={...currentInvoice,...(scenario==='cancelled'?{status:'CANCELLED',paid:0}:{}),...(scenario==='unpaid'?{status:'OPEN',paid:0}:{})};const open=(action:string,method?:string)=>{calls.push({opened:action,id:row._id,...(method?{method}:{})});};return <main style={{padding:16,maxWidth:380}}><h1>Hóa đơn · fixture giả</h1><div style={{maxWidth:220}}><InvoiceListActions invoice={row} owner={owner} busy={scenario==='busy'} onEdit={()=>open('updateInvoice')} onCancel={()=>open('cancelInvoice')} onDelete={()=>open('deleteInvoice')} onPayment={()=>open('payment')}/></div></main>;}
function AdjustmentApp(){const[done,setDone]=useState(false),[closed,setClosed]=useState(false);const params=new URLSearchParams(location.search),which=params.get('case'),mode=params.get('mode')==='CORRECT'?'CORRECT':'VOID';
 const target={...currentInvoice,kind:which==='packages'?'PACKAGE':'SERVICE',customerName:'Khách fixture',customerPhone:'0900000000',adjustmentContext:{stock:which==='stock'||which==='mixed',packages:which==='packages'||which==='mixed',gifts:which==='gifts'||which==='mixed'}};
 return done?<p>Đã lưu điều chỉnh fixture</p>:closed?<p>Đã quay lại</p>:<InvoiceAdjustmentDialog invoice={target} mode={mode} onClose={()=>setClosed(true)} onChanged={()=>setDone(true)}/>;
}
function TreatmentApp(){
 const [done,setDone]=useState(false);
 const services=[{_id:b,name:'Chăm sóc da',active:true},{_id:'d'.repeat(24),name:'Gói dịch vụ lẻ',active:true},{_id:'e'.repeat(24),name:'Dịch vụ đã ngừng',active:false}];
 const packageTemplates=[{_id:a,name:'Chăm sóc cơ bản',serviceId:b,totalSessions:5,active:true},{_id:c,name:'Chăm sóc mở rộng',serviceId:b,totalSessions:10,active:true},
  {_id:'f'.repeat(24),name:'Hai lần chăm sóc',serviceId:b,totalSessions:2,active:true},
  {_id:'1'.repeat(24),name:'Ngừng bán',serviceId:b,totalSessions:8,active:false},
  {_id:'2'.repeat(24),name:'Dịch vụ đã ngừng của mẫu',serviceId:'e'.repeat(24),totalSessions:8,active:true}];
 const plan={_id:'3'.repeat(24),templateId:a,serviceId:b,name:'Tên cũ trong hồ sơ',totalSessions:5,remaining:2,openingBalance:true,openingRemaining:5,usedSessions:3,recordedUseCount:3,status:'ACTIVE',updatedAt:'2026-11-02T01:00:00.000Z'};
 return <><div hidden><CommercialFields action="sellPackage" data={{services,packageTemplates,treatments:[],staff:[],products:[{_id:'4'.repeat(24),name:'Gói mỹ phẩm',active:true}],user:{id:a}}} disabled={false}/></div>{done?<p>Đã lưu gói fixture</p>:<TreatmentEditDialog plan={plan} services={services} packageTemplates={packageTemplates} onClose={()=>{}} onChanged={()=>setDone(true)}/>}</>;
}
function CreationApp(){
 const [done,setDone]=useState(false);
 const customer={_id:c,name:'Khách hồi tố',phone:'0900000000'},owner={_id:a,id:a,name:'Chủ spa',active:true,role:'OWNER'};
 const data={user:owner,today:'2026-11-08',customers:[customer],staff:[owner],services:[{_id:b,name:'Dịch vụ hồi tố',active:true,price:300000,commission:0}],products:[{_id:'e'.repeat(24),name:'Sản phẩm hồi tố',price:300000,stock:5,active:true,unit:'chai'}],packageTemplates:[],treatments:[]};
 const submit=(action:string,values:any)=>{calls.push({action,data:values});setDone(true);};
 return done?<p>Đã lưu hóa đơn fixture</p>:new URLSearchParams(location.search).get('creation')==='modal'
  ?<FormModal catalogs={data} busy={false} error="" onClose={()=>{}} onSubmit={values=>submit('invoice',values)} spec={{title:'Lập hóa đơn',action:'invoice',defaults:{customerId:c},fields:[{key:'customerId',label:'Khách hàng',remoteCustomers:true}]}}/>
  :<Cashier data={data} busy={false} initialMode="product" initialCustomer={customer} onSubmit={submit} onInvoices={()=>{}} onNewCustomer={()=>{}}/>;
}
createRoot(document.getElementById('root')!).render(contentEdit?<AdjustmentApp/>:new URLSearchParams(location.search).has('creation')?<CreationApp/>:new URLSearchParams(location.search).has('treatment-edit')?<TreatmentApp/>:new URLSearchParams(location.search).has('adjust')?<AdjustmentApp/>:new URLSearchParams(location.search).has('list')?<ListApp/>:new URLSearchParams(location.search).has('ledger')?<LedgerApp/>:detail?<DetailApp/>:<App/>);
