import assert from 'node:assert/strict';
import { staffPhone, loginInput } from '../src/lib/login-identity';
import { User } from '../src/lib/models';
import { migrateUserIndexes } from '../src/lib/user-indexes';

assert.equal(staffPhone.parse('+84 329 357 116'), '0329357116');
assert.equal(staffPhone.parse('0329.357.116'), '0329357116');
for (const value of ['', 'abc', '123', '0329357116@example.test']) assert.equal(staffPhone.safeParse(value).success, false);
const phone = loginInput.parse({ identifier: '+84 329 357 116', password: 'password', spaId: 'forged' });
assert.deepEqual(phone.identity, { kind: 'phone', value: '0329357116' });
assert.equal('spaId' in phone, false);
assert.deepEqual(loginInput.parse({ phone: '0329357116', password: 'password' }).identity, phone.identity);
assert.deepEqual(loginInput.parse({ email: 'OWNER@EXAMPLE.TEST', password: 'password' }).identity,
  { kind: 'email', value: 'owner@example.test' });
assert.equal(loginInput.safeParse({ identifier: 'invalid', email: 'valid@example.test', password: 'x' }).success, false);
assert.equal(loginInput.safeParse({ identifier: '0329357116', password: '' }).success, false);
assert.equal(!!User.schema.path('email').isRequired, false);
assert.ok(User.schema.indexes().some(([keys, options]) => keys.phone === 1 && options.unique && options.partialFilterExpression));
const operations: string[] = [];
(User as any).createCollection = async () => { operations.push('collection'); };
(User as any).createIndexes = async () => { operations.push('new-indexes'); };
(User.collection as any).indexes = async () => [
  { name: 'email_1', key: { email: 1 }, unique: true },
  { name: 'user_email_present', key: { email: 1 }, unique: true, partialFilterExpression: { email: { $type: 'string' } } },
  { name: 'user_phone_present', key: { phone: 1 }, unique: true, partialFilterExpression: { phone: { $type: 'string' } } },
];
(User.collection as any).dropIndex = async (name: string) => { operations.push(`drop:${name}`); };
await migrateUserIndexes();
assert.deepEqual(operations, ['collection', 'new-indexes', 'drop:email_1']);
operations.length = 0;
(User as any).createIndexes = async () => { throw new Error('index conflict'); };
await assert.rejects(migrateUserIndexes());
assert.deepEqual(operations, ['collection'], 'A failed replacement index must never remove legacy uniqueness');
