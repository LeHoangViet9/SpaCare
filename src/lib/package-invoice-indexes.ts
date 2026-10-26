import { Treatment } from './models';
import { ensure } from './rules';
const invoiceKey=(key:Record<string,unknown>)=>Object.keys(key).length===2 && key.spaId===1 && key.invoiceId===1;
// Add the lookup before removing only the old constraint. Never rewrite documents.
export async function migratePackageInvoiceIndex(){
 const indexes=await Treatment.collection.indexes();
 await Treatment.collection.createIndex({spaId:1,invoiceId:1},{name:'treatment_invoice_lookup'});
 for(const index of indexes)if(index.unique && invoiceKey(index.key) && index.name)await Treatment.collection.dropIndex(index.name);
}
export async function ensureGroupedPackageIndex(){
 const indexes=await Treatment.collection.indexes();
 ensure(!indexes.some(index=>index.unique && invoiceKey(index.key)),'Cần cập nhật index bán nhiều gói: chạy npm run db:package-invoices trên đúng database trước khi bán.',503);
 ensure(indexes.some(index=>!index.unique && invoiceKey(index.key)),'Thiếu index tra cứu liệu trình theo hóa đơn.',503);
}
