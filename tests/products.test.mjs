import test from 'node:test';
import assert from 'node:assert/strict';
import { productInputs, productNameKey, productTotal, stockBalance, productQuery, canManageProducts } from '../src/lib/product-rules.ts';
import { cashierCatalog } from '../src/lib/cashier-catalog.ts';
const id = 'a'.repeat(24);
test('product stock preserves integer units and rejects overselling, negatives and overflow', () => {
  assert.equal(stockBalance(5, 'OUT', 5), 0);
  assert.equal(stockBalance(5, 'IN', 2), 7);
  for (const args of [[5, 'OUT', 6], [0, 'IN', -1], [5, 'OUT', 0.5], [1e9, 'IN', 1]]) assert.throws(() => stockBalance(...args));
  assert.equal(productTotal(150000, 3), 450000);
  assert.throws(() => productTotal(1e12, 2));
});
test('product input strips forged stock and tenant; normalizes SKU and duplicate group keys', () => {
  const p = productInputs.product.parse({ name: 'Serum', sku: ' sp01 ', sizeMl: 250, price: 10000, stock: 100, spaId: id });
  assert.equal(p.sku, 'SP01'); assert.equal(p.sizeMl, 250); assert.equal(p.stock, undefined); assert.equal(p.spaId, undefined);
  for (const sizeMl of [0, -1, 1.5, 100001]) assert.equal(productInputs.product.safeParse({ name: 'Serum', sku: 'SP02', sizeMl, price: 10000 }).success, false);
  assert.equal(productNameKey('  Chăm   Sóc  '), productNameKey('chăm sóc'));
  assert.equal(productInputs.stockMovement.parse({ productId: id, direction: 'OUT', quantity: 1 }).reason, '');
  assert.equal(productInputs.stockMovement.parse({ productId: id, direction: 'IN', quantity: 2, reason: ' ' }).reason, '');
  assert.equal(productInputs.stockMovement.safeParse({ productId: id, direction: 'IN', quantity: 1, reason: 'a'.repeat(2001) }).success, false);
  assert.equal(productInputs.sellProduct.safeParse({ productId: id, customerId: id, quantity: 0 }).success, false);
});
test('product catalog searches SKU and unaccented names, excludes stopped products', () => {
  const products = [{ _id: id, name: 'Sữa rửa mặt', sku: 'SP-01', active: true }, { _id: 'b', name: 'Sữa', active: false }];
  const data = { services: [], treatments: [], packageTemplates: [], products };
  assert.equal(cashierCatalog(data, 'product', '', 'sua rua').length, 1);
  assert.equal(cashierCatalog(data, 'product', '', 'sp-01')[0]._id, id);
});
test('product management only owner and paged queries bound input without a total record cap', () => {
  assert.equal(canManageProducts({ role: 'OWNER' }), true);
  assert.equal(canManageProducts({ role: 'STAFF', cashier: true }), false);
  assert.equal(canManageProducts({ role: 'MANAGER' }), false);
  assert.equal(productQuery(new URLSearchParams('page=501')).page, 501);
  for (const input of ['page=0', 'group=foreign', 'view=suppliers', 'status=unknown']) assert.throws(() => productQuery(new URLSearchParams(input)));
});

test('product creation no longer requires SKU and stock receipts require only product/direction/quantity',()=>{
 const p=productInputs.product.parse({name:'Serum',sizeMl:50,price:100000});assert.equal(p.sku,undefined);
 const movement=productInputs.stockMovement.parse({productId:'a'.repeat(24),direction:'IN',quantity:3});assert.equal(movement.reason,'');
 for(const quantity of [0,-1,0.5])assert.equal(productInputs.stockMovement.safeParse({...movement,quantity}).success,false);
});
