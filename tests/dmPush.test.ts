import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { MessageChannel } from 'node:worker_threads';
const code = readFileSync(new URL('../public/kapsapp-notifications.js', import.meta.url), 'utf8');
for (const state of ['active', 'other-dm', 'hidden', 'offline', 'wrong-account', 'unresponsive']) {
 test(`push worker respects ${state} conversation`, async () => {
  const shown: unknown[] = []; const handlers = new Map<string, any>();
  const client = { visibilityState: state === 'hidden' ? 'hidden' : 'visible', focused: true, postMessage: (_: any, ports: any[]) => {
    if (state !== 'unresponsive') { ports[0].postMessage({ active: state === 'active' }); ports[0].close(); }
  } };
  const self = { location: { origin: 'https://kapsapp.online' }, addEventListener: (name: string, handler: any) => handlers.set(name, handler),
    clients: { matchAll: async () => state === 'offline' ? [] : [client] }, registration: { showNotification: async (...args: unknown[]) => shown.push(args) } };
  vm.runInNewContext(code, { self, URL, MessageChannel, setTimeout, clearTimeout });
  let pending: Promise<void> = Promise.resolve();
  handlers.get('push')({ data: { json: () => ({ title: 'user1', body: 'hello', tag: 'dm-1', recipientId: 2, expiresAt: Date.now() + 10000 }) }, waitUntil: (promise: Promise<void>) => { pending = promise; } });
  await pending;
  assert.equal(shown.length, state === 'active' ? 0 : 1);
 });
}
