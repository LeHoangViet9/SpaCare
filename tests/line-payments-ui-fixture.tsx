import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {FormModal} from '../src/components/workspace';
import CashCards from '../src/components/cash-cards';

const invoice={_id:'aaaaaaaaaaaaaaaaaaaaaaaa',customerId:'bbbbbbbbbbbbbbbbbbbbbbbb',total:500000,paid:0,serviceItems:[{lineId:'cccccccccccccccccccccccc',name:'Dịch vụ A',total:300000,paid:0},{lineId:'dddddddddddddddddddddddd',name:'Dịch vụ B',total:200000,paid:0}]};
const other={...invoice,_id:'eeeeeeeeeeeeeeeeeeeeeeee',serviceItems:invoice.serviceItems.map((line,index)=>({...line,lineId:(index?'1':'2').repeat(24)}))};
function Harness(){
  const [saved,setSaved]=useState('');
  const mode=new URLSearchParams(location.search).get('mode') || 'payment';
  window.fetch=async(input,init)=>{
    if(String(input).startsWith('/api/cash-cards')) return new Response(JSON.stringify({cards:[{_id:'ffffffffffffffffffffffff',amount:300000,balance:300000,origin:'OPENING'}],total:1,page:1,uses:[],useTotal:0,usePage:1}));
    if(String(input)==='/api/operations') {setSaved(String(init?.body));return new Response(JSON.stringify({ok:true}));}
    throw Error('Unexpected fixture request');
  };
  return <main>{mode==='card'?<CashCards customerId={invoice.customerId} invoice={invoice} onChanged={()=>{}}/>:<FormModal catalogs={{invoices:[invoice,other]}} busy={false} error="" onClose={()=>{}} onSubmit={values=>setSaved(JSON.stringify(values))} spec={{title:'Kiểm tra phân bổ',action:mode,defaults:{invoiceId:invoice._id,amount:100000,method:'CASH'},fields:[...(mode==='allocate'?[{key:'invoiceId',label:'Hóa đơn',options:[[invoice._id,'Hóa đơn A'],[other._id,'Hóa đơn B']] as [string,string][]}]:[]),{key:'amount',label:'Số tiền',type:'number'},...(mode==='payment'?[{key:'receivedConfirmation',label:'Đã nhận tiền',type:'checkbox'}]:[])]}}/>}<pre id="saved">{saved}</pre></main>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
