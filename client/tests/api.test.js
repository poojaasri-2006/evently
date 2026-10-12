import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apiFetch, apiFetchFresh, clearApiCache, markApiCacheStale, subscribeApiUpdates } from '../src/utils/api.js';
test('shared API cache preserves account isolation, invalidation, and independent aborts', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  let release;
  globalThis.fetch = async (_url, options = {}) => {
    calls++;
    if (options.headers?.wait) await new Promise(resolve => { release = resolve; });
    return new Response(JSON.stringify({ calls }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    clearApiCache();
    const headers = { Authorization: 'Bearer first' };
    const [a,b] = await Promise.all([apiFetch('/api/events', { headers }), apiFetch('/api/events', { headers })]);
    assert.deepEqual(await a.json(), await b.json()); assert.equal(calls, 1);
    await (await apiFetch('/api/events', { headers })).json(); assert.equal(calls, 1);
    await apiFetch('/api/events', { headers: { Authorization: 'Bearer other' } }); assert.equal(calls, 2);
    await apiFetch('/api/events', { method: 'POST', headers });
    await apiFetch('/api/events', { headers }); assert.equal(calls, 4);
    await apiFetch('/api/auth/me', { headers }); await apiFetch('/api/auth/me', { headers }); assert.equal(calls, 6);
    clearApiCache();
    const controller = new AbortController();
    const first = apiFetch('/api/quotes', { headers: { wait: 'yes' }, signal: controller.signal });
    const second = apiFetch('/api/quotes', { headers: { wait: 'yes' } });
    const aborted = assert.rejects(first, { name: 'AbortError' });
    controller.abort(); release(); await aborted; assert.equal((await second).status, 200); assert.equal(calls, 7);
    clearApiCache(); let failureCalls = 0;
    globalThis.fetch = async () => { failureCalls++; return new Response('{}', { status: 500 }); };
    await apiFetch('/api/events'); await apiFetch('/api/events'); assert.equal(failureCalls, 2);
  } finally { clearApiCache(); globalThis.fetch = original; }
});

test('stale modules render immediately while changed data refreshes in the background', async () => {
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  let now = 100000;
  let release;
  let calls = 0;
  let value = 1;
  let hold = false;
  const updates = [];
  const unsubscribe = subscribeApiUpdates(update => updates.push(update));
  Date.now = () => now;
  globalThis.fetch = async () => {
    calls++;
    if (hold) await new Promise(resolve => { release = resolve; });
    return new Response(JSON.stringify({ value }));
  };
  const flush = () => new Promise(resolve => setTimeout(resolve, 20));
  try {
    clearApiCache();
    const options = { headers: { Authorization: 'Bearer first' } };
    assert.deepEqual(await (await apiFetch('/api/events', options)).json(), { value: 1 });
    now += 31000; hold = true; value = 2;
    assert.deepEqual(await (await apiFetch('/api/events', options)).json(), { value: 1 });
    assert.equal(calls, 2);
    assert.equal(updates.length, 0);
    hold = false; release(); await flush();
    assert.deepEqual(await (await apiFetch('/api/events', options)).json(), { value: 2 });
    assert.equal(updates.length, 1);
    assert.deepEqual(updates[0], { path: '/api/events', authorization: 'Bearer first' });
    markApiCacheStale();
    assert.equal(updates.length, 2);
    hold = true;
    assert.deepEqual(await (await apiFetch('/api/events', options)).json(), { value: 2 });
    hold = false; release(); await flush();
    assert.equal(updates.length, 2, 'Unchanged background data must not trigger another render');
    value = 3;
    assert.deepEqual(await (await apiFetchFresh('/api/events', options)).json(), { value: 3 });
    assert.equal(calls, 4);
  } finally { unsubscribe(); clearApiCache(); globalThis.fetch = originalFetch; Date.now = originalNow; }
});

test('chat refreshes behind its snapshot and read receipts preserve other module caches', async () => {
 const originalFetch = globalThis.fetch;
 let release; let held = false; let calls = 0;
 globalThis.fetch = async () => { calls++; if (held) await new Promise(resolve => { release = resolve; }); return new Response('[]'); };
 try {
  clearApiCache();
  const headers = { Authorization: 'Bearer chat-test' };
  await apiFetch('/api/events', { headers });
  await apiFetch('/api/messages/conversations', { headers });
  held = true;
  assert.deepEqual(await (await apiFetch('/api/messages/conversations', { headers })).json(), []);
  assert.equal(calls, 3, 'Chat must refresh even a recent snapshot');
  held = false; release(); await new Promise(resolve => setTimeout(resolve, 20));
  await apiFetch('/api/notifications/read-all', { method: 'PATCH', headers });
  await apiFetch('/api/events', { headers });
  assert.equal(calls, 4, 'Read receipts must not force unrelated modules to reload');
 } finally { clearApiCache(); globalThis.fetch = originalFetch; }
});
