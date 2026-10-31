import { parseMoney } from './currency';
import { useToken } from './treatment-rules';
type Row=Record<string,any>;
export function toggleCartItem(items:Row[],row:Row,defaults:Row={}):Row[]{
  if(items.some(item=>item._id===row._id))return items.filter(item=>item._id!==row._id);
  if(items.length>=30)throw new Error('Tối đa 30 mục mỗi loại trong giỏ.');
  return [...items,{...row,...defaults}];
}
export function addServiceItem(items:Row[],row:Row):Row[]{
  if(items.length>=30)throw new Error('Tối đa 30 dịch vụ trong giỏ.');
  return [...items,{...row,lineId:crypto.randomUUID(),total:String(row.price),performerIds:[]}];
}
export function removeServiceItem(items:Row[],lineId:string):Row[]{
  return items.filter(item=>item.lineId!==lineId);
}
export function updateServiceItemPerformers(items:Row[],lineId:string,performerIds:string[]):Row[]{
  return items.map(item=>item.lineId===lineId?{...item,performerIds}:item);
}
export function cashierActions(input:{
  customerId:string;services:Row[];sessions:Row[];products:Row[];packages:Row[];staffId?:string;participantIds:string[];dueDate:string;signature?:unknown;cashCard?:unknown;
}){
  const {customerId,services,sessions,products,packages,staffId,participantIds,dueDate,signature,cashCard}=input;
  const actions:{action:string;data:Row}[]=[];
  // Each service line may carry either legacy performerId (string) or new performerIds (string[]).
  // The backend accepts a single performerId per line; send the first selected performer.
  const items=services.map(item=>{
    const performerId=Array.isArray(item.performerIds) ? (item.performerIds[0] || undefined) : (item.performerId || undefined);
    return {serviceId:item._id,total:parseMoney(item.total),...(performerId?{performerId}:{})};
  });
  const productItems=products.map(item=>({productId:item._id,quantity:Number(item.quantity),unitPrice:parseMoney(item.unitPrice)}));
  if(sessions.length) actions.push({action:'invoice',data:{customerId,serviceId:sessions[0].serviceId,...(staffId?{staffId}:{}),treatments:sessions.map(item=>({treatmentId:item._id,remainingBefore:useToken(item),...(item.performerId?{performerId:item.performerId}: {})})),additionalServices:items,additionalProducts:productItems,...(signature?{signature}:{}),...(dueDate?{dueDate}:{})}});
  else if(services.length)actions.push({action:'serviceInvoice',data:{customerId,...(staffId?{staffId}:{}),items,additionalProducts:productItems,...(dueDate?{dueDate}:{}),...(cashCard?{cashCard}:{})}});
  else if(products.length)actions.push({action:'productInvoice',data:{customerId,items:productItems,...(dueDate?{dueDate}:{})}});
  for(const item of packages)actions.push({action:'sellPackage',data:{customerId,templateId:item._id,total:parseMoney(item.total),dueDate,participantIds,startsOn:item.startsOn,promotion:item.promotion || '',giftCashCardAmount:parseMoney(item.giftCashCardAmount || '0'),gifts:(item.gifts || []).map((gift:Row)=>({serviceId:gift.serviceId}))}});
  if(!actions.length)throw new Error('Chọn ít nhất một dịch vụ, gói hoặc sản phẩm.');
  return actions;
}
