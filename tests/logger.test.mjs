import test from 'node:test';
import assert from 'node:assert/strict';
import { tsImport } from 'tsx/esm/api';
const { log, requestId } = await tsImport('../src/lib/logger.ts', import.meta.url);
test('logger only emits safe fields and tolerates failed output', t => {
  const sink = t.mock.method(console, 'info', () => {});
  const secret = 'mongodb://user:password@host/database';
  log('info', 'operation.completed', { requestId: requestId(), actorId: 'abc123', status: 200, durationMs: 20, password: secret, error: new Error(secret), action: secret, code: secret, spaId: secret });
  const record = JSON.parse(sink.mock.calls[0].arguments[0]);
  assert.equal(record.event, 'operation.completed');
  assert.equal(record.actorId, 'abc123');
  assert.equal(record.status, 200);
  assert.ok(record.timestamp);
  assert.ok(!JSON.stringify(record).includes(secret));
  assert.equal(record.action, undefined);
  assert.equal(record.spaId, undefined);
  sink.mock.mockImplementation(() => { throw new Error('sink unavailable'); });
  assert.doesNotThrow(() => log('info', 'operation.completed'));
});
