import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import mongoose from 'mongoose';
import { allModels } from '../src/lib/models';
import { readReport } from '../src/lib/report-read';
import { readWorkspace } from '../src/lib/workspace-read';
import { workspaceQuery } from '../src/lib/workspace-query';
import { operate } from '../src/lib/operations';
import { spaDay } from '../src/lib/rules';

// In-memory model doubles only. Any attempt to open a database connection fails.
const clone = (value: any) => structuredClone(value);
const spaId = 'a'.repeat(24), ownerId = 'b'.repeat(24);
const actor = { id: ownerId, spaId, name: 'Synthetic owner', role: 'OWNER' as const, cashier: false };
const today = spaDay();
const oldDay = new Date(new Date(today + 'T12:00:00+07:00').getTime() - 86400000).toISOString().slice(0, 10);
const state: Record<string, any[]> = {};
const equal = (a: any, b: any) => a == null || b == null ? a == b : String(a) === String(b);
function matches(row: any, filter: any): boolean {
  return Object.entries(filter).every(([key, value]: any) => {
    if (key === '$and') return value.every((part: any) => matches(row, part));
    if (key === '$or') return value.some((part: any) => matches(row, part));
    if (key === '$nor') return !value.some((part: any) => matches(row, part));
    if (!value || typeof value !== 'object' || value instanceof mongoose.Types.ObjectId || value instanceof Date) return equal(row[key], value);
    return Object.entries(value).every(([op, expected]: any) => {
      switch (op) {
        case '$ne': return !equal(row[key], expected);
        case '$exists': return (row[key] !== undefined) === expected;
        case '$in': return expected.some((v: any) => equal(row[key], v));
        case '$gte': return row[key] >= expected;
        case '$lte': return row[key] <= expected;
        case '$lt': return row[key] < expected;
        default: assert.fail('Unsupported fixture predicate: ' + op);
      }
    });
  });
}
function expression(value: any, row: any): any {
  if (typeof value === 'string' && value.startsWith('$')) return row[value.slice(1)];
  if (!value || typeof value !== 'object') return value;
  if ('$eq' in value) return equal(expression(value.$eq[0], row), expression(value.$eq[1], row));
  if ('$cond' in value) return expression(value.$cond[expression(value.$cond[0], row) ? 1 : 2], row);
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, expression(v, row)]));
}
function aggregate(rows: any[], pipeline: any[]) {
  for (const stage of pipeline) {
    if (stage.$match) rows = rows.filter(row => matches(row, stage.$match));
    else if (stage.$group) {
      const groups = new Map<string, any>();
      for (const row of rows) {
        const id = expression(stage.$group._id, row), key = JSON.stringify(id);
        const group = groups.get(key) || { _id: id };
        for (const [field, accumulator] of Object.entries(stage.$group) as any) {
          if (field === '_id') continue;
          assert.ok('$sum' in accumulator);
          group[field] = (group[field] || 0) + expression(accumulator.$sum, row);
        }
        groups.set(key, group);
      }
      rows = [...groups.values()];
    } else if (stage.$unionWith) {
      const model = allModels.find(model => model.collection.name === stage.$unionWith.coll)!;
      assert.ok(model);
      rows = rows.concat(aggregate(clone(state[model.modelName]), stage.$unionWith.pipeline));
    } else if (stage.$sort) rows.sort((a, b) => String(a._id).localeCompare(String(b._id)));
    else assert.fail('Unsupported fixture aggregation stage');
  }
  return rows;
}
function document(name: string, row: any): any {
  if (!row) return null;
  return { ...clone(row), toObject() { const { save, toObject, ...data } = this; return clone(data); },
    async save(options: any) { assert.ok(options.session); state[name][state[name].findIndex(v => equal(v._id, row._id))] = this.toObject(); } };
}
function query(value: any, filter: any): any {
  const q: any = { then: (ok: any, fail: any) => Promise.resolve(value).then(ok, fail), cast: () => filter };
  for (const key of ['select', 'sort', 'skip', 'limit', 'lean', 'session']) q[key] = () => q;
  return q;
}
for (const model of allModels) {
  const name = model.modelName, m = model as any;
  state[name] = [];
  m.find = (filter: any) => query(state[name].filter(row => matches(row, filter)).map(row => document(name, row)), filter);
  m.findOne = (filter: any) => query(document(name, state[name].find(row => matches(row, filter))), filter);
  m.countDocuments = (filter: any) => Promise.resolve(state[name].filter(row => matches(row, filter)).length);
  m.aggregate = async (pipeline: any[]) => aggregate(clone(state[name]), pipeline);
  m.findOneAndUpdate = (filter: any, update: any) => {
    const row = state[name].find(row => matches(row, filter));
    if (row) for (const [key, value] of Object.entries(update.$inc || {})) row[key] = (row[key] || 0) + Number(value);
    return query(document(name, row), filter);
  };
  m.updateMany = async (_filter: any, _update: any, options: any) => { assert.ok(options.session); return { matchedCount: 0 }; };
  m.create = async (rows: any[], options: any) => {
    assert.ok(options.session);
    return rows.map(row => { const data = { _id: randomUUID(), ...clone(row) }; state[name].push(data); return document(name, data); });
  };
}
(mongoose as any).connect = () => assert.fail('This fixture must never connect to MongoDB');
(mongoose.connection as any).readyState = 1;
(mongoose.connection as any).transaction = async (callback: any) => {
  const before = clone(state);
  try { return await callback({ fixture: true }); }
  catch (error) { for (const key of Object.keys(state)) state[key] = before[key]; throw error; }
};
state.User.push({ _id: ownerId, spaId, name: actor.name, role: 'OWNER', active: true });
state.Control.push({ _id: 'c'.repeat(24), spaId, revision: 0 });
const oldBook = { _id: 'd'.repeat(24), spaId, day: oldDay, status: 'CLOSED', opening: 100, expected: 1100, bankNet: 2000, counted: 1100, difference: 0 };
state.Day.push(clone(oldBook), { _id: 'e'.repeat(24), spaId, day: today, status: 'OPEN', opening: 500 });
// A synthetic pair spanning two days, with genuine cash expense and bank refund.
state.CashEntry.push(
  { _id: 'TEST-ORIGINAL-CASH', spaId, day: oldDay, method: 'CASH', direction: 'IN', kind: 'INCOME', amount: 1000 },
  { _id: 'TEST-ORIGINAL-BANK', spaId, day: oldDay, method: 'BANK_TRANSFER', direction: 'IN', kind: 'INCOME', amount: 2000 },
  { _id: 'TEST-CASH-EXPENSE', spaId, day: today, method: 'CASH', direction: 'OUT', kind: 'EXPENSE', amount: 30 },
  { _id: 'TEST-BANK-REFUND', spaId, day: today, method: 'BANK_TRANSFER', direction: 'OUT', kind: 'REFUND', amount: 70 },
  { _id: 'TEST-FOREIGN', spaId: 'f'.repeat(24), day: today, method: 'CASH', direction: 'IN', kind: 'INCOME', amount: 999999 },
);
const call = (action: string, input: any, key = randomUUID()) => operate(actor, action, input, key);
const initialReport = await readReport(actor, workspaceQuery(new URLSearchParams({section:'reports',from:oldDay,to:today})));
assert.deepEqual([initialReport.cashIn,initialReport.cashOut,initialReport.bankIn,initialReport.bankOut],[1000,30,2000,70]);
// Execute the real reversal action against model doubles while the old book is CLOSED.
for (const id of ['TEST-ORIGINAL-CASH', 'TEST-ORIGINAL-BANK']) {
  const key = randomUUID(), input = { id, reason: 'Synthetic cross-day correction' };
  // Operation IDs must satisfy the existing ObjectId input schema.
  const row = state.CashEntry.find(row => row._id === id)!;
  row._id = String(new mongoose.Types.ObjectId()); input.id = row._id;
  await call('reverseCash', input, key);
  await call('reverseCash', input, key);
}
assert.deepEqual(state.Day.find(row => row.day === oldDay), oldBook);
assert.equal(state.CashEntry.filter(row => row.kind === 'REVERSAL').length, 2);
assert.ok(state.CashEntry.filter(row => row.kind === 'REVERSAL').every(row => row.day === today && row.originalId));
const makeQuery = (section: string, from = oldDay, to = today) => workspaceQuery(new URLSearchParams({ section, from, to }));
const report = await readReport(actor, makeQuery('reports'));
assert.equal(report.inflow, 0); assert.equal(report.outflow, 100);
assert.deepEqual([report.cashIn,report.cashOut,report.bankIn,report.bankOut],[0,30,0,70]);
assert.deepEqual(report.days, [{ _id: today, incoming: 0, outgoing: 100 }]);
assert.equal((await readReport(actor, makeQuery('reports', oldDay, oldDay))).days.length, 0);
const emptyReport = await readReport(actor, makeQuery('reports',oldDay,oldDay));
assert.deepEqual([emptyReport.cashIn,emptyReport.cashOut,emptyReport.bankIn,emptyReport.bankOut],[0,0,0,0]);
assert.equal((await readReport(actor, makeQuery('reports', today, today))).outflow, 100);

// Run the actual CSV click handler with browser I/O doubles, rather than rebuild its rows in the test.
const source = await readFile(new URL('../src/components/reports.tsx', import.meta.url), 'utf8');
const handler = source.slice(source.indexOf('  function exportSummary()'), source.indexOf('  return <section className="reports-workspace"'));
assert.ok(handler.startsWith('  function exportSummary()'));
let exported: Blob | undefined, clicked = false;
runInNewContext(ts.transpile(handler + '\nexportSummary();', { target: ts.ScriptTarget.ES2022 }), {
  activeTab: 'cash', r: report, employees: [], period: { from: oldDay, to: today }, today, Blob,
  URL: { createObjectURL(blob: Blob) { exported = blob; return 'blob:test'; }, revokeObjectURL() {} },
  document: { createElement() { return { click() { clicked = true; } }; } },
});
assert.ok(clicked && exported);
const csv = await exported.text();
assert.ok(csv.includes(`"${today}","0","100","-100"`));
assert.ok(csv.includes('"Tiền mặt","0","30","-30"'));
assert.ok(csv.includes('"Chuyển khoản","0","70","-70"'));
for (const row of ['"Thu tiền mặt","0"','"Chi tiền mặt","30"','"Thu chuyển khoản","0"','"Chi chuyển khoản","70"']) assert.ok(csv.includes(row),row);
assert.ok(!csv.includes(oldDay));

let workspace = await readWorkspace(actor, makeQuery('days'));
const saved = workspace.days.find((row: any) => row.day === oldDay)!;
assert.equal(saved.expected, 1100); assert.equal(saved.bankNet, 2000);
assert.equal(saved.liveExpected, undefined);
const preview = workspace.days.find((row: any) => row.day === today)!;
assert.equal(preview.liveExpected, 470); assert.equal(preview.liveBankNet, -70);
assert.deepEqual([preview.cashIn,preview.cashOut,preview.bankIn,preview.bankOut],[0,30,0,70]);
const expectedFlowPreview = {opening:preview.opening,cashIn:preview.cashIn,cashOut:preview.cashOut,bankIn:preview.bankIn,bankOut:preview.bankOut};
// Reject changed bank totals and offsetting cash movements even if expected cash is unchanged.
for (const method of ['BANK_TRANSFER','CASH']) {
  const before = clone(state);
  state.CashEntry.push(...['IN','OUT'].map(direction=>({_id:randomUUID(),spaId,day:today,method,direction,kind:direction==='IN'?'INCOME':'EXPENSE',amount:25})));
  const changed = clone(state);
  await assert.rejects(call('closeDay',{day:today,counted:470,expectedPreview:470,expectedFlowPreview}),(e:any)=>e.status===409);
  assert.deepEqual(state,changed,'stale close rolls back all writes');
  for (const key of Object.keys(state)) state[key]=before[key];
}
const cashWorkspace = await readWorkspace(actor, makeQuery('cash'));
assert.deepEqual(cashWorkspace.pages.cash.summary, { incoming: 0, outgoing: 100 });
assert.equal(cashWorkspace.cash.length, 6, 'same-spa correction history remains visible in ledger');
const overview = await readWorkspace(actor, makeQuery('overview'));
assert.equal(overview.totals.inflow, 0); assert.equal(overview.totals.outflow, 100);
await assert.rejects(call('closeDay', { day: oldDay, counted: 100 }), /Ngày chưa mở hoặc đã chốt/);
await call('closeDay', { day: today, counted: 470, expectedPreview: preview.liveExpected, expectedFlowPreview });
assert.equal(state.Day.find(row => row.day === today).expected, 470);
assert.equal(state.Day.find(row => row.day === today).bankNet, -70);
assert.deepEqual(state.Day.find(row => row.day === oldDay), oldBook);
await call('reopenDay', { day: oldDay, reason: 'Synthetic reopening' });
workspace = await readWorkspace(actor, makeQuery('days'));
const reopened = workspace.days.find((row: any) => row.day === oldDay)!;
assert.equal(reopened.liveExpected, 100); assert.equal(reopened.liveBankNet, 0);
await assert.rejects(call('closeDay', { day: oldDay, counted: 100, expectedPreview: 1100 }), (e: any) => e.status === 409);
const recloseKey = randomUUID(), reclose = { day: oldDay, counted: 100, expectedPreview: reopened.liveExpected };
await call('closeDay', reclose, recloseKey); await call('closeDay', reclose, recloseKey);
const reclosed = state.Day.find(row => row.day === oldDay)!;
assert.equal(reclosed.expected, 100); assert.equal(reclosed.bankNet, 0); assert.equal(reclosed.difference, 0);
assert.equal(state.Audit.filter(row => row.action === 'closeDay' && row.details.day === oldDay).length, 1);
assert.equal(state.CashEntry.length, 7, 'report, export and closing never delete ledger history');
const afterClosing = await readReport(actor, makeQuery('reports'));
assert.deepEqual(afterClosing.days, report.days);
assert.deepEqual(afterClosing.methods, report.methods);
