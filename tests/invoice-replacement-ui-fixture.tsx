import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import InvoiceReplacement,{InvoiceDocumentHistory} from '../src/components/invoice-replacement';
const a='a'.repeat(24),b='b'.repeat(24),c='c'.repeat(24);
const invoice={_id:a,code:'HD000001',kind:'PACKAGE',total:1750000,paid:1750000,status:'PAID',updatedAt:'2026-11-02T01:00:00.000Z',saleParticipants:[{staffId:b,staffName:'Tư vấn A'}]};
const legacy=new URLSearchParams(location.search).has('legacy');
const calls:any[]=[];
window.fetch=(async(input:any,options:any)=>{
 if(String(input)!=='/api/operations')throw Error('External request blocked');
 const body=JSON.parse(options.body);calls.push({...body,key:options.headers['Idempotency-Key']});
 if(body.action==='previewPackageAdvisorReplacement')return Response.json({before:invoice.saleParticipants,after:[{staffId:c,staffName:'Tư vấn B'}],pool:87500,formula:'floor((paid - refunded) / 20)',payment:{id:a,receiptId:c,amount:1750000,method:'CASH'},treatmentIds:[b],beforeShares:[{staffId:b,total:87500}],afterShares:[{staffId:c,total:87500}]});
 await new Promise(r=>setTimeout(r,100));return Response.json({id:a,code:'HD000002'});
}) as typeof fetch;
function App(){const[done,setDone]=useState(false);return <main style={{maxWidth:800,margin:'auto',padding:16}}><InvoiceReplacement invoice={invoice} staff={[{_id:c,name:'Tư vấn B',role:'STAFF',active:true}]} onChanged={()=>setDone(true)}/>{done && <p role="status">Đã thay thế thành công</p>}<InvoiceDocumentHistory invoice={{...invoice,effectiveCode:'HD000002',activeDocumentId:c,documentHistory:[{documentId:a,...(legacy?{legacyInvoiceId:a}:{code:'HD000001'}),status:'REPLACED',replacedById:c,replacedByCode:'HD000002',replacedAt:'2026-11-02T02:00:00.000Z',reason:'Ghi nhầm người tư vấn',snapshot:{...invoice,...(legacy?{code:undefined}:{}),description:'Gói minh họa',createdAt:'2026-11-02T01:00:00.000Z'}}]}}/><button onClick={()=>{document.getElementById('calls')!.textContent=JSON.stringify(calls);}}>Đọc yêu cầu fixture</button><pre id="calls"/></main>;}
createRoot(document.getElementById('root')!).render(<App/>);
