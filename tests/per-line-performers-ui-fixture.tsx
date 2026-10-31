import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import Cashier from '../src/components/cashier';

async function start(){
 const data=await fetch('/fixture/data').then(r=>r.json());
 function Harness(){
  const [saved,setSaved]=useState<any>(null),[busy,setBusy]=useState(false);
  async function submit(action:string,values:any){
   setBusy(true);
   try{const response=await fetch('/fixture/submissions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,values})});const body=await response.json();if(!response.ok)throw Error(body.error);setSaved(body.submission);}
   finally{setBusy(false);}
  }
  return <main><h1>UI QA · nhân viên theo dòng</h1><Cashier data={data} busy={busy} initialMode="service" initialCustomer={data.customers[0]} onSubmit={submit} onInvoices={()=>{}} onNewCustomer={()=>{}}/><pre id="last-submission">{saved?JSON.stringify(saved):''}</pre></main>;
 }
 createRoot(document.getElementById('root')!).render(<Harness/>);
}
void start();
