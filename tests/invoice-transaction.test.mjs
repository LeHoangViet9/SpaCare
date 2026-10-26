import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { tsImport } from 'tsx/esm/api';
const { Invoice } = await tsImport('../src/lib/models.ts', import.meta.url);

for (const path of ['treatmentSessions', 'packageItems', 'productItems']) {
  test(`rollback preserves original error and strict embedded ${path} without version keys (mock driver)`, async t => {
    const id = () => new mongoose.Types.ObjectId();
    const item = { treatmentSessions: {treatmentId:id(),treatmentUseId:id(),name:'Test'},
      packageItems: {treatmentId:id(),serviceId:id(),name:'Test',total:100},
      productItems: {productId:id(),name:'Test',quantity:1,unitPrice:100,total:100} }[path];
    const invoice = new Invoice({spaId:id(),customerId:id(),total:100,[path]:[item]});
    class FakeSession {
      transaction = {};
      async withTransaction(fn) { return fn(); }
      async endSession() {}
    }
    const session = new FakeSession();
    t.mock.method(Invoice.db,'startSession',async()=>session);
    const insert=t.mock.method(Invoice.collection,'insertOne',async()=>({acknowledged:true,insertedId:invoice._id}));
    const original=new Error('ROLLBACK_SENTINEL');
    await assert.rejects(Invoice.db.transaction(async s=>{
      await invoice.save({session:s});
      assert.equal(invoice.isNew,false);
      throw original;
    }),error=>error===original);
    assert.equal(insert.mock.callCount(),1);
    assert.equal(invoice.isNew,true,'aborted document is restored for retry');
    assert.equal(invoice[path][0].isNew,true);
    assert.ok(!Object.hasOwn(invoice[path][0].toObject(),'__v'));
    assert.throws(()=>invoice[path][0].set('unexpectedField',true),/strict mode/);
  });
}
