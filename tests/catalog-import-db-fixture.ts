import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { importCatalog } from '../src/lib/catalog-import';
import { Audit, Control, Idempotency, PackageTemplate, Service, User } from '../src/lib/models';
import { hashPassword } from '../src/lib/password';
import { type CatalogEntry } from '../src/lib/catalog-import-plan';
const ownerId = '123456789012345678901234', password = 'fixture-password-123';
let role = 'OWNER', active = true, failPackage = false;
let state: any = { services: [], packages: [], markers: [], audits: [] };
const query = (value: any): any => ({ select: () => query(value), session: async () => value });
const session = {};
(mongoose.connection as any).transaction = async (fn: any) => {
  const before = structuredClone(state);
  try { return await fn(session); } catch (error) { state = before; throw error; }
};
(User as any).findOne = (filter: any) => query(role === filter.role && active === filter.active && ownerId === filter._id ? { _id: ownerId, spaId: 'spa', role, active, passwordHash: hashPassword(password) } : null);
(Control as any).findOneAndUpdate = (filter: any) => { assert.equal(filter.spaId, 'spa'); return query({ revision: 1 }); };
(Service as any).find = (filter: any) => { assert.deepEqual(filter, { spaId: 'spa' }); return query(state.services); };
(PackageTemplate as any).find = (filter: any) => { assert.deepEqual(filter, { spaId: 'spa' }); return query(state.packages); };
(Idempotency as any).findOne = (filter: any) => query(state.markers.find((row: any) => row.spaId === filter.spaId && row.key === filter.key));
for (const [model, key] of [[Service, 'services'], [PackageTemplate, 'packages'], [Idempotency, 'markers'], [Audit, 'audits']] as const) {
  (model as any).create = async (rows: any[], options: any) => {
    assert.equal(options.session, session);
    if (model === PackageTemplate && failPackage) throw new Error('test package failure');
    const result = rows.map(row => ({ ...row, active: true, _id: key + state[key].length }));
    // Production Mongoose returns separate documents; avoid aliasing the find() result in this model double.
    state[key] = [...state[key], ...result];
    return result;
  };
}
const entry: CatalogEntry = { row: 2, service: { name: 'Triệt lông Nách', category: 'TRIỆT LÔNG', price: 100000, commission: 0 },
  source: { min: 700000, max: 700000, notes: 'fixture' }, package: { name: 'Triệt lông Nách · 3 năm', price: 700000, packageType: 'TIME', durationMonths: 36 } };
const first = await importCatalog(ownerId, password, [entry]);
assert.deepEqual(first, { createdServices: 1, createdPackages: 1, skipped: 0 });
assert.equal(state.services.length, 1); assert.equal(state.packages.length, 1); assert.equal(state.audits.length, 1);
assert.equal(state.packages[0].serviceId, state.services[0]._id);
assert.equal('duration' in state.services[0], false);
assert.equal('totalSessions' in state.packages[0], false);
assert.deepEqual(await importCatalog(ownerId, password, [entry]), { createdServices: 0, createdPackages: 0, skipped: 1 });
assert.equal(state.audits.length, 1);
await assert.rejects(importCatalog(ownerId, password, [{ ...entry, service: { ...entry.service, price: 200000 } }]), /nội dung khác/);
role = 'STAFF'; await assert.rejects(importCatalog(ownerId, password, [entry]), (e: any) => e.status === 403); role = 'OWNER';
active = false; await assert.rejects(importCatalog(ownerId, password, [entry]), (e: any) => e.status === 403); active = true;
await assert.rejects(importCatalog(ownerId, 'wrong-password', [entry]), (e: any) => e.status === 403);
const next: CatalogEntry = { ...entry, row: 3, service: { ...entry.service, name: 'Triệt lông Mép' }, package: { ...entry.package!, name: 'Triệt lông Mép · 3 năm' } };
failPackage = true; await assert.rejects(importCatalog(ownerId, password, [next]), /test package failure/); failPackage = false;
assert.equal(state.services.length, 1); assert.equal(state.packages.length, 1); assert.equal(state.markers.length, 1);
assert.equal(state.audits.length, 1);
state.services.push({ ...next.service, _id: 'existing', spaId: 'spa', active: true, price: 999 });
await assert.rejects(importCatalog(ownerId, password, [next]), /khác giá/);
