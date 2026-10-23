import test from 'node:test';
import assert from 'node:assert/strict';
import { productImageType, MAX_PRODUCT_IMAGE_BYTES } from '../src/lib/product-image';
import { productInputs } from '../src/lib/product-rules';

test('product photos validate bytes instead of trusting file name or declared MIME', () => {
  const jpg = Buffer.alloc(20); jpg.set([255, 216, 255]);
  const png = Buffer.concat([Buffer.from([137]), Buffer.from('PNG\r\n\x1a\n'), Buffer.alloc(20)]);
  const webp = Buffer.from('RIFF0000WEBP00000000');
  assert.equal(productImageType(jpg), 'image/jpeg');
  assert.equal(productImageType(png), 'image/png');
  assert.equal(productImageType(webp), 'image/webp');
  for (const bytes of [Buffer.from('<svg onload="alert(1)"></svg>'), Buffer.from('<html>fake.jpg</html>'), Buffer.alloc(0), Buffer.alloc(MAX_PRODUCT_IMAGE_BYTES + 1)]) {
    assert.throws(() => productImageType(bytes));
  }
});
test('product accepts saved photo URLs and rejects arbitrary local paths', () => {
  const product = { name: 'Product', sku: 'SP01', price: 100000, sizeMl: 100 };
  const path = '/api/product-images/' + 'a'.repeat(24);
  assert.equal(productInputs.product.parse({ ...product, imageUrl: path }).imageUrl, path);
  assert.equal(productInputs.product.parse({ ...product, imageUrl: '' }).imageUrl, '');
  assert.equal(productInputs.product.parse({ ...product, imageUrl: 'https://example.test/image.jpg' }).imageUrl, 'https://example.test/image.jpg');
  for (const imageUrl of ['/api/product-images/foreign', '/api/customers/' + 'a'.repeat(24), '/api/product-images/../private']) {
    assert.equal(productInputs.product.safeParse({ ...product, imageUrl }).success, false);
  }
});
