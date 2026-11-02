import mongoose from 'mongoose';
import { Control, Invoice } from './models';
import { ensure } from './rules';
import { invoiceCode, sequenceInvoiceCode } from './invoice-code';

// Only display metadata is assigned; transaction and payment history are untouched.
export async function backfillInvoiceCodes(onlySpaId?: mongoose.Types.ObjectId) {
  await Invoice.createCollection();
  await Invoice.createIndexes();
  const spas = onlySpaId ? [onlySpaId] : await Invoice.distinct('spaId');
  let changed = 0;
  for (const spaId of spas) {
    const count = await mongoose.connection.transaction(async session => {
      const scope = { spaId };
      const control = await Control.findOneAndUpdate(scope, { $inc: { revision: 1 } }, { session, returnDocument: 'after' });
      ensure(control, 'Missing spa write guard for invoice code migration.');
      const rows = await Invoice.find(scope).select('_id code effectiveCode documentHistory createdAt').sort({ createdAt: 1, _id: 1 }).session(session);
      let sequence = control.invoiceSequence || 0;
      for (const row of rows) for (const code of [row.code,row.effectiveCode,...(row.documentHistory || []).filter((d:any)=>
        !d.legacyInvoiceId && !(String(d.documentId)===String(row._id) && !d.snapshot?.code && !d.snapshot?.effectiveCode && d.code===invoiceCode({_id:row._id}))
      ).map((d:any)=>d.code)]) if (code && /^HD[0-9]+$/.test(code)) {
        const value = Number(code.slice(2));
        ensure(Number.isSafeInteger(value) && value >= 1, 'Existing invoice sequence is invalid.');
        sequence = Math.max(sequence, value);
      }
      let assigned = 0;
      for (const row of rows) {
        if (row.code) continue;
        const code = sequenceInvoiceCode(++sequence);
        await Invoice.updateOne({ ...scope, _id: row._id }, { $set: { code } }, { session });
        assigned++;
      }
      await Control.updateOne(scope, { $set: { invoiceSequence: sequence } }, { session });
      return assigned;
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
    changed += count;
  }
  return changed;
}
