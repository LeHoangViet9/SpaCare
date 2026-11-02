import test from 'node:test';
import assert from 'node:assert/strict';
import { replacementParticipants } from '../src/lib/invoice-replacement-rules.ts';
import { historicalInvoiceCode, invoiceCode } from '../src/lib/invoice-code.ts';
const a='a'.repeat(24), b='b'.repeat(24), c='c'.repeat(24), z='0'.repeat(24);
const invoice={kind:'PACKAGE',status:'PAID',total:1750000,paid:1750000,sellerId:a,sellerName:'Advisor A',saleParticipants:[{staffId:a,staffName:'Advisor A'}],saleCommissionVersion:1,saleCommissionAccrued:87500};
test('replacement uses the original package rule and only replaces the selected sale participant',()=>{
 const source={...invoice,consultantId:b,createdBy:c,performedBy:b};const before=structuredClone(source);
 const p=replacementParticipants(source,a,{staffId:c,staffName:'Advisor C'});
 assert.equal(p.pool,87500);assert.equal(p.beforeShares[0].amount,87500);assert.equal(p.afterShares[0].staffId,c);
 assert.deepEqual(source,before);
});
test('odd VND and many consultants preserve a single pool with deterministic rounding',()=>{
 const source={...invoice,total:1750061,paid:1750061,saleCommissionAccrued:87503,saleCommissionVersion:2,saleParticipants:[...invoice.saleParticipants,{staffId:b,staffName:'Advisor B'},{staffId:c,staffName:'Advisor C'}]};
 const p=replacementParticipants(source,c,{staffId:z,staffName:'Advisor Z'});
 assert.equal(p.beforeShares.reduce((n,s)=>n+s.amount,0),87503);
 assert.equal(p.afterShares.reduce((n,s)=>n+s.amount,0),87503);
 assert.deepEqual(p.beforeShares.map(s=>s.total),[29168,29168,29167]);
 assert.equal(p.afterShares.find(s=>s.staffId===z).total,29168);
});
test('unpaid, partially paid, refunded, legacy or inconsistent sale snapshots fail closed',()=>{
 for(const changes of [{paid:0},{paid:100},{refunded:1},{openingBalance:true},{kind:'SESSION'},{status:'CANCELLED'},
  {saleCommissionVersion:undefined},{saleCommissionAccrued:2},{sellerId:b},{saleParticipants:[...invoice.saleParticipants,...invoice.saleParticipants]}])
   assert.throws(()=>replacementParticipants({...invoice,...changes},a,{staffId:c,staffName:'C'}));
 assert.throws(()=>replacementParticipants(invoice,b,{staffId:c,staffName:'C'}));
 assert.throws(()=>replacementParticipants(invoice,a,{staffId:a,staffName:'A'}));
});
test('current document code supersedes original code without creating another financial invoice',()=>{
 assert.equal(invoiceCode({code:'HD000001',effectiveCode:'HD000002'}),'HD000002');
 assert.equal(invoiceCode({code:'HD000001'}),'HD000001');
});
test('legacy historical identity is separate from an issued code and stays stable after migration',()=>{
 const document={documentId:a,legacyInvoiceId:a,snapshot:{_id:a}};
 const before=structuredClone(document);
 assert.equal(historicalInvoiceCode(document),invoiceCode({_id:a}));
 assert.equal(historicalInvoiceCode({...document,snapshot:{_id:a,code:'HD000042'}}),invoiceCode({_id:a}));
 assert.equal(historicalInvoiceCode({documentId:b,code:'HD000043'}),'HD000043');
 assert.deepEqual(document,before);assert.equal(document.code,undefined);
});
test('strict replacement API rejects unrelated invoice edits and missing reasons before DB access',async()=>{
 const {tsImport}=await import('tsx/esm/api');const {operate}=await tsImport('../src/lib/operations.ts',import.meta.url);
 const actor={id:a,spaId:b,name:'Owner',role:'OWNER',cashier:true};
 const input={id:a,expectedUpdatedAt:'2026-11-02T01:00:00.000Z',expectedDocumentId:a,oldStaffId:a,newStaffId:c,reason:'Correct advisor'};
 for(const changes of [{total:2},{consultantId:c},{createdBy:c},{signature:{}},{reason:''},{expectedDocumentId:undefined}])
  await assert.rejects(operate(actor,'replacePackageAdvisor',{...input,...changes},'replacement-strict-123'),e=>e.name==='ZodError');
});
