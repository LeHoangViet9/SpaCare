import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { invoiceCode, sequenceInvoiceCode } from '../src/lib/invoice-code.ts';
test('invoice display codes are HD plus digits, preserve assigned codes and keep legacy IDs untruncated',()=>{
 assert.equal(sequenceInvoiceCode(1),'HD000001');assert.equal(sequenceInvoiceCode(1234567),'HD1234567');
 for(const number of [0,-1,1.5,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>sequenceInvoiceCode(number));
 assert.equal(invoiceCode({code:'HD000012',_id:'a'.repeat(24)}),'HD000012');
 const a=invoiceCode({_id:'a'.repeat(24)}),b=invoiceCode({_id:'b'.repeat(24)});
 assert.match(a,/^HD[0-9]+$/);assert.notEqual(a,b);assert.equal(a,invoiceCode({_id:'a'.repeat(24)}));
});

test('invoice code migration preserves historical financial amounts and safely resumes its sequence',()=>{
 execFileSync(process.execPath,['--import','tsx',fileURLToPath(new URL('./invoice-codes-fixture.ts',import.meta.url))],{env:{...process.env,MONGODB_URI:'mongodb://127.0.0.1:1/spacare_test'},stdio:'pipe',timeout:15000});
});
