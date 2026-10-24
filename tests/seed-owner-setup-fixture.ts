import assert from 'node:assert/strict';
import { mock } from 'node:test';
import mongoose from 'mongoose';
import { allModels, User, Spa, Control, StaffLeave, Migration } from '../src/lib/models';
import { verifyPassword } from '../src/lib/password';
const scenario = process.argv[2];
const errors: string[] = [];
console.error = (...values) => { errors.push(values.map(value => typeof value === 'string' ? value : JSON.stringify(value)).join(' ')); };
process.env.SEED_OWNER_PHONE = '+84 912 345 678';
process.env.SEED_OWNER_EMAIL = '';
process.env.SEED_OWNER_PASSWORD = 'fixture-password-123';
mock.module('../src/lib/db.ts', { namedExports: { connect: async () => {}, DatabaseUnavailableError: class extends Error {} } });
mock.module('../src/lib/user-indexes.ts', { namedExports: { migrateUserIndexes: async () => {} } });
for (const model of allModels) {
  (model as any).createCollection = async () => {};
  (model as any).createIndexes = async () => { if (scenario === 'index-error') throw Object.assign(new Error('SECRET_DRIVER_MESSAGE'), { code: 13 }); };
}
(StaffLeave.collection as any).indexes = async () => [];
(User as any).find = async (query: any) => {
  assert.deepEqual(query, { $or: [{ phone: '0912345678' }] });
  return scenario === 'existing' ? [{ phone: '0912345678', role: 'OWNER', active: true }] : [];
};
(User as any).exists = async () => scenario === 'occupied';
let creates = 0, migration = 0;
const session = {};
(mongoose.connection as any).transaction = async (fn: any) => fn(session);
(Spa as any).create = async (_rows: any, options: any) => { creates++; assert.equal(options.session, session); return [{ _id: 'spa' }]; };
(Control as any).create = async (_rows: any, options: any) => { creates++; assert.equal(options.session, session); };
(User as any).create = async ([row]: any, options: any) => {
  creates++; assert.equal(options.session, session); assert.equal(row.phone, '0912345678');
  assert.equal(row.email, undefined); assert.equal(row.role, 'OWNER'); assert.equal(row.spaId, 'spa');
  assert.ok(verifyPassword(process.env.SEED_OWNER_PASSWORD!, row.passwordHash));
};
(User as any).updateOne = () => assert.fail('Setup must not change an existing account');
(Migration as any).updateOne = async () => { migration++; };
(mongoose as any).disconnect = async () => {
  assert.equal(creates, scenario === 'new' ? 3 : 0);
  assert.equal(migration, ['occupied', 'index-error'].includes(scenario) ? 0 : 1);
  assert.equal(process.exitCode, ['occupied', 'index-error'].includes(scenario) ? 1 : undefined);
  if (scenario === 'index-error') {
    assert.ok(errors.join(' ').includes('indexes:'));
    assert.ok(errors.join(' ').includes('13'));
    assert.ok(!errors.join(' ').includes('SECRET_DRIVER_MESSAGE'));
  }
  process.exitCode = 0;
};
await import('../scripts/setup');
