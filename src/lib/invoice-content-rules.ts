import {z} from 'zod';
const id=z.string().regex(/^[a-f\d]{24}$/i);
const money=z.number().int().min(0).max(1_000_000_000_000);
const day=z.string().refine(v=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v,'Ngày không hợp lệ.');
const source={key:z.string().min(1).max(80),sourceIndex:z.number().int().min(0).max(1000).optional()};
export const invoiceContentInput=z.object({
  customerId:id.optional(),description:z.string().trim().min(1).max(500).optional(),dueDate:day.nullable().optional(),
  promotion:z.string().trim().max(2000).optional(),consultantId:id.nullable().optional(),
  participantIds:z.array(id).max(20).refine(v=>new Set(v).size===v.length).optional(),
  serviceItems:z.array(z.object({...source,serviceId:id,total:money,performerId:id.nullable().optional()}).strict()).max(30).optional(),
  productItems:z.array(z.object({...source,productId:id,quantity:z.number().int().min(1).max(1_000_000_000),unitPrice:money}).strict()).max(30).optional(),
  packageItems:z.array(z.object({...source,templateId:id.nullable().optional(),total:money,promotion:z.string().trim().max(2000).optional(),totalSessions:z.number().int().min(1).max(10000).optional(),durationMonths:z.number().int().min(1).max(120).optional(),startsOn:day.optional(),expiresOn:day.optional()}).strict()).max(30).optional(),
}).strict();
export type InvoiceContentInput=z.infer<typeof invoiceContentInput>;

// Canonical rows fill legacy gaps; explicit patches (including []) take precedence.
export function contentDisplayRecords(invoice:Record<string,unknown>,source:Record<string,unknown>,patch:Record<string,unknown>){
  const before={...invoice,...source};
  return {before,after:{...before,...patch}};
}

// Use the verified original lines, not the primary invoice kind or the edited arrays.
export function invoiceContentKinds(source:{serviceItems?:unknown[];productItems?:unknown[];packageItems?:unknown[]}){
  return (['serviceItems','productItems','packageItems'] as const).filter(kind=>!!source[kind]?.length);
}

export function contentEqual(a:unknown,b:unknown):boolean{
  const stable=(value:any):any=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'
    ?Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,stable(value[k])])):value;
  return JSON.stringify(stable(JSON.parse(JSON.stringify(a??null))))===JSON.stringify(stable(JSON.parse(JSON.stringify(b??null))));
}
export function contentLineTotal(content:{serviceItems?:any[];productItems?:any[];packageItems?:any[]},sessions:any[]=[]){
  return (content.serviceItems||[]).reduce((n,r)=>n+r.total,0)+(content.productItems||[]).reduce((n,r)=>n+r.quantity*r.unitPrice,0)
    +(content.packageItems||[]).reduce((n,r)=>n+r.total,0)+sessions.reduce((n,r)=>n+(r.total||0),0);
}
