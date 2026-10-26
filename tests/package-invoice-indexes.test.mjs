import test from 'node:test';
import assert from 'node:assert/strict';
import {tsImport} from 'tsx/esm/api';
const {Treatment}=await tsImport('../src/lib/models.ts',import.meta.url);
const {migratePackageInvoiceIndex,ensureGroupedPackageIndex}=await tsImport('../src/lib/package-invoice-indexes.ts',import.meta.url);
test('package invoice migration adds lookup before dropping only legacy unique index; retry is safe',async()=>{
 const collection=Treatment.collection;
 const original={indexes:collection.indexes,createIndex:collection.createIndex,dropIndex:collection.dropIndex};
 const events=[];let indexes=[{name:'_id_',key:{_id:1},unique:true},{name:'spaId_1_invoiceId_1',key:{spaId:1,invoiceId:1},unique:true}];
 collection.indexes=async()=>indexes;
 collection.createIndex=async(key,options)=>{events.push('create');if(!indexes.some(i=>i.name===options.name))indexes.push({name:options.name,key});return options.name;};
 collection.dropIndex=async(name)=>{events.push('drop:'+name);indexes=indexes.filter(i=>i.name!==name);};
 try{
  await assert.rejects(ensureGroupedPackageIndex(),/index/);
  await migratePackageInvoiceIndex();await ensureGroupedPackageIndex();await migratePackageInvoiceIndex();
  assert.deepEqual(events,['create','drop:spaId_1_invoiceId_1','create']);
  assert.ok(indexes.some(i=>i.name==='_id_'));
  assert.ok(!Treatment.schema.indexes().some(([key,options])=>key.spaId===1&&key.invoiceId===1&&options.unique));
 }finally{Object.assign(collection,original);}
});
