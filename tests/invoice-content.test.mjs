import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {invoiceContentInput,contentEqual,contentLineTotal,invoiceContentKinds,contentDisplayRecords} from '../src/lib/invoice-content-rules.ts';

test('legacy preview shows canonical old services but preserves explicit deletion after editing',()=>{
 const oldService={serviceId:'a'.repeat(24),name:'Legacy service',total:300000};
 const product={productId:'b'.repeat(24),name:'Product',quantity:1,unitPrice:50000};
 const stored={serviceId:oldService.serviceId,serviceItems:[],productItems:[product]};
 const source={serviceItems:[oldService],productItems:[product],packageItems:[],treatmentSessions:[]};
 const snapshot=structuredClone({stored,source});
 const display=contentDisplayRecords(stored,source,{serviceItems:[]});
 assert.deepEqual(display.before.serviceItems,[oldService]);
 assert.deepEqual(display.after.serviceItems,[]);
 assert.deepEqual(display.after.productItems,[product]);
 assert.deepEqual({stored,source},snapshot,'building a preview does not rewrite either source');
});
test('edit categories follow existing lines rather than the primary kind or catalogue',()=>{
 assert.deepEqual(invoiceContentKinds({serviceItems:[{}],productItems:[],packageItems:[]}),['serviceItems']);
 assert.deepEqual(invoiceContentKinds({productItems:[{}]}),['productItems']);
 assert.deepEqual(invoiceContentKinds({packageItems:[{}]}),['packageItems']);
 assert.deepEqual(invoiceContentKinds({kind:'SERVICE',serviceItems:[{}],productItems:[{}],packageItems:[{}]}),['serviceItems','productItems','packageItems']);
 assert.deepEqual(invoiceContentKinds({treatmentSessions:[{}]}),[]);
});
test('content patches validate source references, integers and allowed fields',()=>{
 const row={key:'one',sourceIndex:0,serviceId:'a'.repeat(24),total:300000};
 assert.equal(invoiceContentInput.safeParse({serviceItems:[row]}).success,true);
 for(const patch of [{paid:1},{serviceItems:[{...row,sourceIndex:-1}]},{serviceItems:[{...row,total:1.5}]},{productItems:[{key:'one',productId:row.serviceId,quantity:0,unitPrice:10}]},{treatmentSessions:[]}])assert.equal(invoiceContentInput.safeParse(patch).success,false);
 assert.ok(contentEqual({x:undefined,y:1},{y:1}));assert.ok(!contentEqual([1,2],[2,1]));
 assert.equal(contentLineTotal({serviceItems:[row],productItems:[{quantity:2,unitPrice:50000}],packageItems:[{total:200000}]},[{total:0}]),600000);
});
test('owner content editing preserves sources, safeguards execution/payroll, compensates stock and rights atomically (model doubles)',()=>{
 execFileSync(process.execPath,['--import','tsx',fileURLToPath(new URL('./invoice-content-fixture.ts',import.meta.url))],{stdio:'pipe',timeout:30000});
});
