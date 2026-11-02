import test from 'node:test';
import assert from 'node:assert/strict';
import { cartGroups } from '../src/lib/cart-groups.ts';
test('cart groups preserve each technician, recipient and price; names alone do not merge records', () => {
  const first = { _id: 'one', name: 'Nano', cartId: 'a', performerId: 'tech-a', recipientName: 'Chủ gói', total: '100' };
  const other = { _id: 'two', name: 'Nano', cartId: 'b' };
  const second = { _id: 'one', name: 'Nano', cartId: 'c', performerId: 'tech-b', recipientName: 'Chồng', total: '200' };
  const items = [first, other, second];
  const groups = cartGroups(items);
  assert.deepEqual(groups, [[first, second], [other]]);
  assert.equal(groups[0][0], first);
  assert.equal(groups[0][1], second);
  assert.deepEqual(items, [first, other, second]);
  assert.deepEqual(cartGroups([]), []);
});
