'use client';
import {useState} from 'react';
import MoneyInput from './money-input';
import {parseMoney} from '@/lib/currency';
import {treatmentDay} from '@/lib/treatment-rules';

const methods=[['CASH','Tiền mặt'],['BANK_TRANSFER','Chuyển khoản']] as const;
type Method=typeof methods[number][0];

export default function CreationPayments({issuedOn,today=treatmentDay(),disabled=false,total}:{issuedOn?:string;today?:string;disabled?:boolean;total?:number}){
  const [amounts,setAmounts]=useState({CASH:'0',BANK_TRANSFER:'0'});
  const [dates,setDates]=useState<Partial<Record<Method,string>>>({});
  const [confirmed,setConfirmed]=useState({CASH:false,BANK_TRANSFER:false});
  const positive=methods.filter(([method])=>{try{return parseMoney(amounts[method]||'0')>0;}catch{return false;}});
  const payments=positive.map(([method])=>({method,amount:parseMoney(amounts[method]),receivedOn:dates[method]??(issuedOn||today),receivedConfirmation:confirmed[method]}));
  return <fieldset disabled={disabled} className="creation-payments"><legend>Thu tiền khi lập hóa đơn</legend>
    {methods.map(([method,title])=><section key={method} className="payment-method-entry"><label>{title}<MoneyInput name={'initial-'+method} min={0} max={total} value={amounts[method]} onValueChange={value=>{setAmounts(old=>({...old,[method]:value}));setConfirmed(old=>({...old,[method]:false}));}} /></label>
      {positive.some(([key])=>key===method)&&<><label>Ngày thực nhận · {title}<input type="date" required max={today} value={dates[method]??(issuedOn||today)} onChange={event=>{setDates(old=>({...old,[method]:event.target.value}));setConfirmed(old=>({...old,[method]:false}));}} /></label><label className="creation-receipt-confirmation"><input type="checkbox" required checked={confirmed[method]} onChange={event=>setConfirmed(old=>({...old,[method]:event.target.checked}))} />Đã thực nhận {title.toLocaleLowerCase('vi')}</label></>}
    </section>)}
    <input type="hidden" name="payments" value={payments.length?JSON.stringify(payments):''}/>
  </fieldset>;
}
