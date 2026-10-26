import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchWorkspace } from '../src/lib/workspace-fetch.ts';

test('workspace request settles stalled headers/body and cancels obsolete requests', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ user: { role: 'OWNER' } }));
    assert.equal((await fetchWorkspace('/api/workspace')).payload.user.role, 'OWNER');
    for (const stalled of ['headers', 'body']) {
      let requestSignal;
      globalThis.fetch = async (_url, options) => {
        requestSignal = options.signal;
        if (stalled === 'headers') return new Promise(() => {});
        return { json: () => new Promise(() => {}) };
      };
      await assert.rejects(fetchWorkspace('/api/workspace', undefined, 20), /Tải dữ liệu quá lâu/);
      assert.equal(requestSignal.aborted, true);
    }
    globalThis.fetch = async () => new Promise(() => {});
    const controller = new AbortController();
    const request = fetchWorkspace('/api/workspace', controller.signal);
    controller.abort();
    await assert.rejects(request, { name: 'AbortError' });
  } finally { globalThis.fetch = original; }
});
