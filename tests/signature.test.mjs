import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidSignature } from '../src/lib/signature.ts';

test('chữ ký phải có nét vẽ thật, tọa độ hữu hạn và định dạng vector giới hạn', () => {
  const valid = { version: 1, strokes: [[[0.1, 0.5], [0.3, 0.2], [0.9, 0.8]]] };
  assert.equal(isValidSignature(valid), true);
  assert.equal(isValidSignature(JSON.parse(JSON.stringify(valid))), true);
  for (const invalid of [undefined, null, '', '<svg onload="bad()"/>', {},
    { ...valid, version: 2 }, { ...valid, html: '<script />' },
    { version: 1, strokes: [] }, { version: 1, strokes: [[[0.5, 0.5]]] },
    { version: 1, strokes: [[[0.5, 0.5], [0.5, 0.5], [0.5, 0.5]]] },
    ...[NaN, Infinity, -1, 1.1, '0.1'].map(x => ({ version: 1, strokes: [[[x, 0.5], [0.3, 0.2], [0.9, 0.8]]] })),
    { version: 1, strokes: Array.from({ length: 31 }, () => valid.strokes[0]) },
    { version: 1, strokes: [Array.from({ length: 1001 }, () => [0.1, 0.5])] },
  ]) assert.equal(isValidSignature(invalid), false);
});
