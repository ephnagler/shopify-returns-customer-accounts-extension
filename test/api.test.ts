import {test, mock} from 'node:test';
import assert from 'node:assert/strict';

import {customerAccountQuery} from '../shared/returns/api.ts';

const throttled = {errors: [{message: 'Throttled', extensions: {code: 'THROTTLED'}}]};
const ok = {data: {order: {id: 'gid://shopify/Order/1'}}};

function fakeFetch(bodies: unknown[]) {
  const calls: unknown[] = [];
  globalThis.fetch = (async () => {
    calls.push(1);
    const body = bodies[Math.min(calls.length - 1, bodies.length - 1)];
    return {json: async () => body} as Response;
  }) as typeof fetch;
  return calls;
}

test('a throttled check retries, then returns the data', async () => {
  mock.timers.enable({apis: ['setTimeout']});
  const calls = fakeFetch([throttled, throttled, ok]);
  const pending = customerAccountQuery('{ order { id } }', {});
  for (let i = 0; i < 10; i++) {
    await new Promise((resolve) => setImmediate(resolve));
    mock.timers.tick(10_000);
  }
  assert.deepEqual(await pending, ok.data);
  assert.equal(calls.length, 3);
  mock.timers.reset();
});

test('a check that stays throttled fails after the retries', async () => {
  mock.timers.enable({apis: ['setTimeout']});
  const calls = fakeFetch([throttled]);
  const rejected = assert.rejects(customerAccountQuery('{ order { id } }', {}), /Throttled/);
  for (let i = 0; i < 10; i++) {
    await new Promise((resolve) => setImmediate(resolve));
    mock.timers.tick(10_000);
  }
  await rejected;
  assert.equal(calls.length, 4);
  mock.timers.reset();
});

test('other errors do not retry', async () => {
  const calls = fakeFetch([{errors: [{message: 'Field does not exist'}]}]);
  await assert.rejects(customerAccountQuery('{ x }', {}), /Field does not exist/);
  assert.equal(calls.length, 1);
});
