import test from 'node:test';
import assert from 'node:assert/strict';
import { assertWritesAllowed, isWriteFrozen, maintenanceResponse, writeFreezeMode } from '../src/lib/write-freeze.ts';

test('production write-freeze fails closed when mode is missing or invalid', () => {
  assert.equal(writeFreezeMode(undefined, 'production'), 'ON');
  assert.equal(writeFreezeMode('unexpected', 'production'), 'ON');
  assert.equal(writeFreezeMode('OFF', 'production'), 'OFF');
  assert.equal(writeFreezeMode(undefined, 'test'), 'OFF');
});

test('write guard blocks writes and returns a retryable maintenance response', async () => {
  const previous = process.env.SPACARE_WRITE_FREEZE;
  process.env.SPACARE_WRITE_FREEZE = 'ON';
  try {
    assert.equal(isWriteFrozen(), true);
    assert.throws(assertWritesAllowed, /bảo trì/);
    const response = maintenanceResponse('req-test');
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('Retry-After'), '120');
    assert.equal((await response.json()).code, 'WRITE_FREEZE');
  } finally {
    if (previous === undefined) delete process.env.SPACARE_WRITE_FREEZE;
    else process.env.SPACARE_WRITE_FREEZE = previous;
  }
});

test('write guard permits writes only when explicitly OFF', () => {
  const previous = process.env.SPACARE_WRITE_FREEZE;
  process.env.SPACARE_WRITE_FREEZE = 'OFF';
  try { assert.doesNotThrow(assertWritesAllowed); }
  finally {
    if (previous === undefined) delete process.env.SPACARE_WRITE_FREEZE;
    else process.env.SPACARE_WRITE_FREEZE = previous;
  }
});
