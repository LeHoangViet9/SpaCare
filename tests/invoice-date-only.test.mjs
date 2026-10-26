import test from 'node:test';
import assert from 'node:assert/strict';
import {tsImport} from 'tsx/esm/api';
const {operate}=await tsImport('../src/lib/operations.ts',import.meta.url);

test('date-only correction rejects attempts to change money or omit the reason before connecting to database',async()=>{
 const actor={id:'a'.repeat(24),spaId:'b'.repeat(24),role:'OWNER',cashier:true,name:'Test'};
 const input={id:'c'.repeat(24),expectedUpdatedAt:'2026-10-26T00:00:00.000Z',issuedOn:'2026-10-25',reason:'Sai ngày'};
 for(const extra of [{total:1},{paid:1},{treatmentId:'d'.repeat(24)},{signature:{}}]){
  await assert.rejects(operate(actor,'correctInvoiceDate',{...input,...extra},'date-only-test-key-123'),e=>e.name==='ZodError');
 }
 await assert.rejects(operate(actor,'correctInvoiceDate',{...input,reason:''},'date-only-test-key-123'),e=>e.name==='ZodError');
});
