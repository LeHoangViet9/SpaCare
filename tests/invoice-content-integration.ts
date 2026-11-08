import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import mongoose from 'mongoose';
import {Spa,Control,User,Customer,Service,Invoice,Payment,CashEntry,Product,StockMovement,InvoiceAdjustment,Audit,Day} from '../src/lib/models';
import {operate} from '../src/lib/operations';
import {readInvoice} from '../src/lib/invoice-read';
import {hashPassword} from '../src/lib/password';
import {spaDay} from '../src/lib/rules';
import {readReport} from '../src/lib/report-read';
import {workspaceQuery} from '../src/lib/workspace-query';
const snapshot=(v:unknown)=>JSON.parse(JSON.stringify(v));

// Called only after integration-safety verifies the local spacare_test replica set.
export async function invoiceContentIntegration(extraSpaIds:mongoose.Types.ObjectId[]){
 const spa=await Spa.create({name:'Synthetic content correction'});extraSpaIds.push(spa._id);const scope={spaId:spa._id};
 const owner=await User.create({...scope,name:'Content owner',role:'OWNER',active:true,passwordHash:hashPassword(randomUUID())});
 const actor={id:String(owner._id),spaId:String(spa._id),name:owner.name,role:'OWNER' as const,cashier:false};
 const call=(action:string,data:unknown,key=randomUUID())=>operate(actor,action,data,key);
 await Control.create(scope);await call('openDay',{day:spaDay(),opening:0});
 const yesterday=spaDay(new Date(Date.now()-86400000));await Day.create({...scope,day:yesterday,status:'CLOSED',opening:0,expected:100000,counted:100000,difference:0});
 const customer=await Customer.create({...scope,name:'Content customer',phone:'0900000089'});
 const service=await Service.create({...scope,name:'Content service',price:300000,active:true,commission:0});
 const product=await Product.create({...scope,name:'Content product',sku:'CONTENT-TEST',unit:'chai',stock:8,price:50000,active:true});
 const invoice=await Invoice.create({...scope,customerId:customer._id,kind:'SERVICE',description:'Original contents',total:400000,paid:100000,status:'PARTIALLY_PAID',serviceId:service._id,serviceItems:[{lineId:new mongoose.Types.ObjectId(),serviceId:service._id,name:service.name,total:300000,commission:0}],productItems:[{lineId:new mongoose.Types.ObjectId(),productId:product._id,name:product.name,unit:product.unit,quantity:2,unitPrice:50000,total:100000}]});
 const receipt=await CashEntry.create({...scope,actorId:owner._id,customerId:customer._id,day:yesterday,kind:'PAYMENT',method:'CASH',direction:'IN',amount:100000});
 const payment=await Payment.create({...scope,invoiceId:invoice._id,receiptId:receipt._id,amount:100000});
 await StockMovement.create({...scope,checkoutInvoiceId:invoice._id,actorId:owner._id,productId:product._id,productName:product.name,sku:product.sku,unit:product.unit,direction:'OUT',kind:'MANUAL',quantity:2,before:10,after:8,reason:'Synthetic initial stock'});
 const read=await readInvoice(actor,String(invoice._id),1,true);assert.ok(read.editContext);assert.equal(String(read.editContext.client.customerId),String(customer._id));
 const fields=JSON.parse(JSON.stringify(read.editContext.client)),source=snapshot([receipt.toObject(),payment.toObject()]);
 const base={id:String(invoice._id),expectedUpdatedAt:invoice.updatedAt.toISOString(),mode:'CORRECT',total:invoice.total,reason:'Synthetic correction'};
 const otherCustomer=await Customer.create({...scope,name:'Other content customer',phone:'0900000092'});
 await assert.rejects(call('previewInvoiceAdjustment',{...base,content:{customerId:String(otherCustomer._id)}}),(e:any)=>e.status===409);
 await assert.rejects(call('previewInvoiceAdjustment',{...base,content:{packageItems:[{key:'cross-package',templateId:String(new mongoose.Types.ObjectId()),total:1,totalSessions:1}]}}),(e:any)=>e.status===409);
 assert.equal(String((await Invoice.findById(invoice._id))!.customerId),String(customer._id));
 const preview=await call('previewInvoiceAdjustment',{...base,content:fields});assert.equal(preview.noChanges,true);
 await call('applyInvoiceAdjustment',{...base,content:fields,confirmed:true,expectedPreview:preview.previewToken});
 assert.deepEqual(snapshot((await Invoice.findById(invoice._id))!.toObject()),snapshot(invoice.toObject()));assert.equal(await InvoiceAdjustment.countDocuments(scope),0);
 fields.productItems[0].quantity=1;
 const payload={...base,total:350000,content:{description:'Corrected contents',productItems:fields.productItems}};
 const changed=await call('previewInvoiceAdjustment',payload),request={...payload,confirmed:true,expectedPreview:changed.previewToken},key=randomUUID();
 const createAudit=Audit.create;let failed=false;
 try{
  (Audit as any).create=async(...args:any[])=>{if(args[0]?.[0]?.action==='correctInvoice'){failed=true;throw Error('INJECTED_CONTENT_AUDIT');}return (createAudit as any).apply(Audit,args);};
  await assert.rejects(call('applyInvoiceAdjustment',request,key),/INJECTED_CONTENT_AUDIT/);
 }finally{Audit.create=createAudit;}
 assert.ok(failed);assert.equal((await Product.findById(product._id))!.stock,8);assert.equal(await StockMovement.countDocuments({...scope,checkoutInvoiceId:invoice._id}),1);assert.equal(await InvoiceAdjustment.countDocuments(scope),0);
 const result=await call('applyInvoiceAdjustment',request,key);assert.deepEqual(await call('applyInvoiceAdjustment',request,key),result);
 const saved=(await Invoice.findById(invoice._id))!;assert.equal(saved.description,'Corrected contents');assert.equal(saved.total,350000);assert.equal(saved.paid,100000);assert.equal(saved.productItems![0].quantity,1);assert.equal((await Product.findById(product._id))!.stock,9);
 assert.deepEqual(snapshot([(await CashEntry.findById(receipt._id))!.toObject(),(await Payment.findById(payment._id))!.toObject()]),source);
 assert.equal(await CashEntry.countDocuments(scope),1);assert.equal(await InvoiceAdjustment.countDocuments(scope),1);
 const report=(day:string)=>readReport(actor,workspaceQuery(new URLSearchParams({section:'reports',from:day,to:day})));
 assert.equal((await report(yesterday)).inflow,100000);assert.equal((await report(spaDay())).inflow,0);
 assert.equal((await Day.findOne({...scope,day:yesterday}))!.expected,100000);
 const history=await readInvoice(actor,String(invoice._id),1,true);assert.equal(history.adjustments[0].before.description,'Original contents');assert.equal(history.adjustments[0].after.description,'Corrected contents');
 // Hydrated legacy invoices have empty default arrays while their old service is top-level.
 const legacy=await Invoice.create({...scope,customerId:customer._id,serviceId:service._id,serviceItems:[],kind:'SERVICE',description:'Legacy original service',total:300000,paid:0,status:'OPEN',commission:0,performedBy:owner._id});
 const legacyRead=await readInvoice(actor,String(legacy._id),1,true);
 assert.equal(legacyRead.editContext!.client.serviceItems.length,1);
 const replacement=await Service.create({...scope,name:'Legacy replacement service',price:300000,active:true,commission:0});
 const legacyInput={id:String(legacy._id),expectedUpdatedAt:legacy.updatedAt.toISOString(),mode:'CORRECT',total:300000,reason:'Synthetic legacy preview regression',content:{serviceItems:[{...legacyRead.editContext!.client.serviceItems[0],serviceId:String(replacement._id)}]}};
 const legacyPreview=await call('previewInvoiceAdjustment',legacyInput),legacyDisplay=legacyPreview.reconciliation.content;
 assert.equal(legacyDisplay.displayBefore.serviceItems.length,1);
 assert.equal(legacyDisplay.displayBefore.serviceItems[0].name,'Legacy original service');
 assert.equal(legacyDisplay.displayAfter.serviceItems.length,1);
 assert.equal(legacyDisplay.displayAfter.serviceItems[0].name,replacement.name);
 assert.deepEqual(snapshot((await Invoice.findById(legacy._id))!.serviceItems),[]);
 await call('applyInvoiceAdjustment',{...legacyInput,confirmed:true,expectedPreview:legacyPreview.previewToken});
 const legacyHistory=await InvoiceAdjustment.findOne({...scope,invoiceId:legacy._id});
 assert.deepEqual(legacyHistory!.before.serviceItems,[]);
 assert.equal(legacyHistory!.reconciliation.content.displayBefore.serviceItems[0].name,'Legacy original service');
 assert.equal(legacyHistory!.reconciliation.content.displayAfter.serviceItems[0].name,replacement.name);
 assert.deepEqual(snapshot([(await CashEntry.findById(receipt._id))!.toObject(),(await Payment.findById(payment._id))!.toObject()]),source);
 assert.equal(await CashEntry.countDocuments(scope),1);
}
