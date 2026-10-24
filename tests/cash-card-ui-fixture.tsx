import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import CashCards from '../src/components/cash-cards';
const customerId='c'.repeat(24),cardId='a'.repeat(24);
let card={_id:cardId,amount:800000,balance:800000,origin:'PURCHASE',createdAt:new Date().toISOString()};
let bill={_id:'b'.repeat(24),kind:'SERVICE',customerId,serviceId:'d'.repeat(24),total:400000,paid:0};let uses:any[]=[];let count=0;
window.fetch=(async (input:any,options:any)=>{
 if(String(input).startsWith('/api/cash-cards?'))return Response.json({cards:[card],total:1,page:1,uses,useTotal:uses.length,usePage:1,canSell:true});
 if(input==='/api/operations'){
  const {action,data}=JSON.parse(options.body);if(action==='redeemCashCard'){
   if(data.amount>card.balance||data.amount+data.additionalAmount>bill.total-bill.paid)return Response.json({error:'Vượt số dư hoặc hóa đơn'},{status:409});
   card={...card,balance:card.balance-data.amount};bill={...bill,paid:bill.paid+data.amount+data.additionalAmount};uses.push({_id:String(++count),cardId,invoiceId:bill._id,amount:data.amount,balanceAfter:card.balance,createdAt:new Date().toISOString()});
  }else if(action==='sellCashCard'){card={...card,amount:data.amount,balance:data.amount};}
  return Response.json({ok:true});
 }
 throw new Error('Fixture blocks external requests');
}) as typeof fetch;
function App(){const [,refresh]=useState(0);return <main style={{maxWidth:600,margin:'auto',padding:12}}><h1>Thẻ tiền — dữ liệu giả</h1><p id="bill">Hóa đơn {bill.total}, đã trả {bill.paid}</p><button onClick={()=>{bill={...bill,_id:'e'.repeat(24),total:800000,paid:0};refresh(v=>v+1);}}>Hóa đơn thử 800k</button><CashCards key={bill._id} customerId={customerId} invoice={bill} onChanged={()=>refresh(v=>v+1)}/></main>;}
createRoot(document.getElementById('root')!).render(<App/>);
