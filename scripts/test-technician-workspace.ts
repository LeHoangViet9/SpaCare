import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {build} from 'esbuild';
import {actor,owner,tech,tech2,customer,service,add,clone,call,localState,resetLocalState} from '../tests/technician-local-models';
import {Invoice,Commission,Payroll,CashEntry,Payment,Day,Treatment,TreatmentUse} from '../src/lib/models';
import {readInvoice} from '../src/lib/invoice-read';
import {spaDay} from '../src/lib/rules';
import {salaryOverviewRows} from '../src/lib/salary-overview';

// Local synthetic transport only. The imported doubles prohibit MongoDB/network connections.
// Browser requests execute production Workspace -> readInvoice -> operate, not hand-built preview results.
const baseline=clone(localState()),requests:any[]=[];let original:any,billId='',ids:any={};
function reset(kind='standalone',closed=false){
 resetLocalState(baseline);requests.length=0;const state=localState();
 state.User.find(p=>p._id===tech).name='KTV cũ local';state.User.find(p=>p._id===tech2).name='KTV mới local';
 state.Customer[0].name='Khách local HD000021';state.Service[0].name='Gội đầu dưỡng sinh';state.Service[0].price=300000;
 const yesterday=new Date(Date.now()-86400000),day=spaDay(yesterday),month=day.slice(0,7);
 if(!state.Day.some(p=>p.day===day))add(Day,{day,status:'OPEN',opening:0,revision:0});
 const bill=add(Invoice,{code:'HD000021',customerId:customer,serviceId:service,serviceItems:[],kind:'SERVICE',description:'Gội đầu dưỡng sinh',total:300000,paid:300000,status:'PAID',refunded:0,commission:10000,performedBy:tech,performedAt:yesterday.toISOString(),creatorName:'Owner local'});billId=bill._id;
 const ledger=add(Commission,{invoiceId:bill._id,customerId:customer,serviceId:service,serviceName:bill.description,staffId:tech,staffName:'KTV cũ local',amount:10000,earnedAt:yesterday.toISOString(),sourceType:'INVOICE',sourceId:bill._id});
 const oldDraft=add(Payroll,{staffId:tech,staffName:'KTV cũ local',month,status:closed?'PAID':'DRAFT',commissionIds:[ledger._id],invoiceLineCommissionIds:[],baseSalary:500000,commissionTotal:10000,total:510000,needsRecalculation:false});ledger.payrollId=oldDraft._id;
 const newDraft=add(Payroll,{staffId:tech2,staffName:'KTV mới local',month,status:'DRAFT',commissionIds:[],invoiceLineCommissionIds:[],baseSalary:500000,commissionTotal:0,total:500000,needsRecalculation:false});
 const receipt=add(CashEntry,{actorId:owner,customerId:customer,kind:'PAYMENT',method:'CASH',day,direction:'IN',amount:300000,reversed:false});
 add(Payment,{invoiceId:bill._id,receiptId:receipt._id,amount:300000,reversed:false});
 if(kind==='package'){
  const plan=add(Treatment,{invoiceId:'f'.repeat(24),customerId:customer,serviceId:service,name:'Gói nguồn local',packageType:'SESSIONS',totalSessions:5,remaining:4,status:'ACTIVE'});
  const use=add(TreatmentUse,{treatmentId:plan._id,checkoutInvoiceId:'e'.repeat(24),actorId:owner,staffId:tech,performedAt:yesterday.toISOString(),sessionNumber:1,signature:{version:1,strokes:[[[0.1,0.2],[0.8,0.9]]]},signatureDigest:'local-original-signature',snapshot:'local-original-use',digest:'local-original-digest'});
  Object.assign(bill,{treatmentId:plan._id,treatmentUseId:use._id,serviceItems:[{lineId:'d'.repeat(24),serviceId:service,name:bill.description,total:300000,commission:10000,performerId:tech}]});
 }
 ids={billId,tech,tech2,oldDraft:oldDraft._id,newDraft:newDraft._id,ledger:ledger._id};
 original=clone({invoice:bill,receipts:state.CashEntry,payments:state.Payment,uses:state.TreatmentUse,plans:state.Treatment,payrolls:state.Payroll});
 return ids;
}
const bundle=await build({entryPoints:['tests/technician-workspace-entry.tsx'],bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"test"'},alias:{'next/navigation':resolve('tests/input-ui-navigation.tsx'),'next/link':resolve('tests/input-ui-link.tsx')},tsconfig:'tsconfig.json'});
const css=(await Promise.all(['ui','globals','public'].map(name=>readFile('src/app/'+name+'.css','utf8')))).join('\n');reset();
const server=createServer(async(req,res)=>{
 const url=new URL(req.url||'/', 'http://127.0.0.1:3222');
 const json=(body:any,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
 try{
  if(url.pathname==='/__test/reset')return json(reset(url.searchParams.get('kind')||'standalone',url.searchParams.get('closed')==='1'));
  if(url.pathname==='/__test/state'){
   const state=localState(),ledgers=[...state.Commission,...state.InvoiceLineCommission];
   const pending=[tech,tech2].map(staffId=>({_id:{staffId,category:'SERVICE'},amount:ledgers.filter(p=>p.staffId===staffId).reduce((n,p)=>n+p.amount,0),ids:ledgers.filter(p=>p.staffId===staffId).map(p=>p._id)}));
   return json({ids,original,state,requests,salary:salaryOverviewRows(state.User.filter(p=>[tech,tech2].includes(p._id)),state.Payroll,pending,[],[],state.Payroll[0].month)});
  }
  if(url.pathname==='/api/notifications')return json({items:[],unread:0,publicKey:null});
  if(url.pathname==='/api/workspace'){
   const state=localState();return json({user:actor,today:spaDay(),customers:state.Customer,staff:state.User,services:state.Service,invoices:state.Invoice,packageTemplates:[],treatments:state.Treatment,
    appointments:[],products:[],deposits:[],allocations:[],days:state.Day,cash:state.CashEntry,payrolls:state.Payroll,commissions:[],serviceGroups:[],productGroups:[],totals:{},pages:{invoices:{rows:state.Invoice,page:1,pageSize:10,total:1}}});
  }
  if(url.pathname==='/api/invoices/'+billId){requests.push({method:'GET',path:url.pathname,edit:url.searchParams.get('edit')});return json(await readInvoice(actor,billId,Number(url.searchParams.get('signaturePage')||1),url.searchParams.get('edit')==='1'));}
  if(url.pathname==='/api/operations'&&req.method==='POST'){
   let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw),key=String(req.headers['idempotency-key']);requests.push({method:'POST',...body,key});return json(await call(body.action,body.data,key));
  }
  if(url.pathname==='/workspace.js'){res.writeHead(200,{'Content-Type':'text/javascript'});return res.end(bundle.outputFiles[0].text);}
  if(url.pathname==='/favicon.ico'){res.writeHead(204);return res.end();}
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<!doctype html><html lang="vi"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style><div id="root"></div><script src="/workspace.js"></script></html>');
 }catch(error:any){json({error:error.message},error.status||500);}
});
server.listen(3222,'127.0.0.1');process.once('SIGTERM',()=>server.close());
