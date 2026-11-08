import test from 'node:test';
import assert from 'node:assert/strict';
import {hasInvoiceEditContext,loadInvoiceAdjustment} from '../src/lib/invoice-edit-client.ts';
test('edit loader requests the real edit endpoint and rejects missing/mismatched content rather than opening the reduced form',async()=>{
 const original=global.fetch,id='a'.repeat(24),context={client:{serviceItems:[],productItems:[],packageItems:[]},source:{serviceItems:[],productItems:[],packageItems:[],treatmentSessions:[]},locks:{services:[],packages:[]},references:{gifts:[],giftCards:[]},catalogs:{staff:[],services:[],products:[],packageTemplates:[]}};
 let body={invoice:{_id:id,code:'HD000021'},editContext:context,customer:{name:'Local customer'}},status=200;
 global.fetch=async(url,options)=>{assert.equal(url,'/api/invoices/'+id+'?edit=1');assert.equal(options.cache,'no-store');return Response.json(body,{status});};
 try{
  assert.equal(hasInvoiceEditContext(context),true);assert.equal(hasInvoiceEditContext({client:{}}),false);
  const loaded=await loadInvoiceAdjustment(id,'CORRECT');assert.equal(loaded.code,'HD000021');assert.deepEqual(loaded.editContext,context);
  body={invoice:{_id:id}};await assert.rejects(loadInvoiceAdjustment(id,'CORRECT'),/Chưa tải được nội dung/);
  assert.equal((await loadInvoiceAdjustment(id,'VOID'))._id,id);
  body={invoice:{_id:'b'.repeat(24)},editContext:context};await assert.rejects(loadInvoiceAdjustment(id,'CORRECT'),/không đúng hóa đơn/);
  status=403;body={error:'Owner only'};await assert.rejects(loadInvoiceAdjustment(id,'CORRECT'),/Owner only/);
 }finally{global.fetch=original;}
});
