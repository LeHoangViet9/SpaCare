import test from 'node:test';
import assert from 'node:assert/strict';
import { customerQuery, customerFilter } from '../src/lib/customer-query.ts';

test('customer pages validate input and never accept a client spa scope', () => {
  assert.deepEqual(customerQuery(new URLSearchParams()), { search: '', page: 1, pageSize: 20 });
  for (const input of ['page=0', 'page=-1', 'page=1.5', 'pageSize=101', 'pageSize=0', 'id=bad', 'search=' + 'a'.repeat(101)]) {
    assert.throws(() => customerQuery(new URLSearchParams(input)));
  }
  const query = customerQuery(new URLSearchParams('spaId=foreign&page=26&pageSize=20'));
  assert.equal(customerFilter('authenticated-spa', query.search).spaId, 'authenticated-spa');
  assert.equal(query.spaId, undefined);
});

test('customer search treats regular expression metacharacters as literal text', () => {
  const input = 'Khách [A].* (VIP) + ? $ ^ \\';
  const filter = customerFilter('spa', input);
  const regex = new RegExp(filter.$or[0].name.$regex, 'i');
  assert.equal(regex.test(input), true);
  assert.equal(regex.test('Khách A other VIP'), false);
  const id = 'a'.repeat(24);
  assert.deepEqual(customerFilter('spa', '', id), { spaId: 'spa', _id: id });
});
