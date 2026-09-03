import test from 'node:test';
import assert from 'node:assert/strict';

import { InferenceClient, MAX_CANONICAL_REQUEST_BYTES } from './inferenceClient.js';
import type { ShadowConfig } from './shadowConfig.js';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const originalFetch = globalThis.fetch;

function syntheticPng(size = 101): Buffer {
  assert.ok(size >= 33);
  const png = Buffer.alloc(size);
  PNG_SIGNATURE.copy(png);
  png.writeUInt32BE(13, 8);
  png.write('IHDR', 12, 'ascii');
  png.writeUInt32BE(75, 16);
  png.writeUInt32BE(75, 20);
  png[24] = 8;
  png[25] = 2;
  return png;
}

const payload = { images: [syntheticPng()], imagesNew: [syntheticPng()] };

function config(overrides: Partial<ShadowConfig> = {}): ShadowConfig {
  return {
    enabled: true,
    killSwitch: false,
    sampleRate: 1,
    endpoint: 'http://example.invalid/infer',
    timeoutMs: 1_000,
    circuitBreaker: { failureThreshold: 3, maxInFlight: 8, resetMs: 1_000 },
    ...overrides,
  };
}

function validResponse(modelId = 'model-1'): Response {
  return new Response(JSON.stringify({
    schemaVersion: 1,
    modelId,
    predictions: [
      { queryIndex: 0, referenceIndex: 0, similarity: 0.9, margin: 0.1, accepted: true },
    ],
    latencyMs: 5,
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

function installFetch(implementation: typeof fetch): () => void {
  globalThis.fetch = implementation;
  return () => { globalThis.fetch = originalFetch; };
}

test('serializes one canonical request string and sends that exact bounded body', async () => {
  const bodies: string[] = [];
  const restore = installFetch((async (_input, init) => {
    assert.equal(init?.method, 'POST');
    assert.equal(init?.redirect, 'error');
    assert.equal(typeof init?.body, 'string');
    bodies.push(init.body as string);
    return validResponse();
  }) as typeof fetch);

  try {
    const result = await new InferenceClient(config()).match(payload);
    assert.equal(result.status, 'ok');
    assert.equal(bodies.length, 1);

    const expected = JSON.stringify({
      schemaVersion: 1,
      references: [{ index: 0, pngBase64: payload.images[0].toString('base64') }],
      queries: [{ index: 0, pngBase64: payload.imagesNew[0].toString('base64') }],
    });
    assert.equal(bodies[0], expected);
    assert.equal(Buffer.byteLength(bodies[0], 'utf8'), Buffer.byteLength(expected, 'utf8'));
    assert.ok(Buffer.byteLength(bodies[0], 'utf8') < MAX_CANONICAL_REQUEST_BYTES);
  } finally {
    restore();
  }
});

test('rejects decoded PNG aggregate overflow locally with structurally valid buffers', async () => {
  let fetchCalls = 0;
  const restore = installFetch((async () => {
    fetchCalls += 1;
    throw new Error('fetch must not run');
  }) as typeof fetch);

  try {
    const result = await new InferenceClient(config()).match({
      images: [syntheticPng(480_001)],
      imagesNew: [syntheticPng(480_000)],
    });
    assert.deepEqual(result, { status: 'invalid', errorCode: 'request_body_too_large' });
    assert.equal(fetchCalls, 0);
  } finally {
    restore();
  }
});

test('accepts the exact maximal canonical request boundary', async () => {
  let observedBytes = 0;
  const restore = installFetch((async (_input, init) => {
    assert.equal(typeof init?.body, 'string');
    observedBytes = Buffer.byteLength(init?.body as string, 'utf8');
    return new Response(JSON.stringify({
      schemaVersion: 1,
      modelId: 'boundary-model',
      predictions: [],
      latencyMs: 1,
    }), { status: 200 });
  }) as typeof fetch);

  try {
    const references = Array.from({ length: 64 }, (_, index) =>
      syntheticPng(index === 63 ? 134 : 7_558));
    const queries = Array.from({ length: 64 }, () => syntheticPng(7_558));
    const result = await new InferenceClient(config()).match({ images: references, imagesNew: queries });
    assert.equal(result.status, 'ok');
    assert.equal(observedBytes, MAX_CANONICAL_REQUEST_BYTES);
  } finally {
    restore();
  }
});

test('maps malformed and oversized responses to stable invalid results', async (t) => {
  await t.test('malformed JSON', async () => {
    const restore = installFetch((async () => new Response('{not-json', { status: 200 })) as typeof fetch);
    try {
      assert.deepEqual(await new InferenceClient(config()).match(payload), {
        status: 'invalid', errorCode: 'malformed_json',
      });
    } finally {
      restore();
    }
  });

  await t.test('declared oversized body', async () => {
    const restore = installFetch((async () => new Response('x', {
      status: 200,
      headers: { 'content-length': '1048577' },
    })) as typeof fetch);
    try {
      assert.deepEqual(await new InferenceClient(config()).match(payload), {
        status: 'invalid', errorCode: 'response_too_large',
      });
    } finally {
      restore();
    }
  });
});

test('times out an abort-aware fetch without throwing', async () => {
  const restore = installFetch(((_input, init) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      reject(error);
    }, { once: true });
  })) as typeof fetch);

  try {
    const result = await new InferenceClient(config({ timeoutMs: 15 })).match(payload);
    assert.equal(result.status, 'timeout');
    assert.equal(result.errorCode, 'request_timeout');
    assert.ok((result.latencyMs ?? 0) >= 0);
  } finally {
    restore();
  }
});

test('opens the circuit after consecutive failures and refuses further fetches', async () => {
  let fetchCalls = 0;
  const restore = installFetch((async () => {
    fetchCalls += 1;
    throw new Error('synthetic network failure');
  }) as typeof fetch);

  try {
    const client = new InferenceClient(config({
      circuitBreaker: { failureThreshold: 2, maxInFlight: 8, resetMs: 10_000 },
    }));
    assert.equal((await client.match(payload)).errorCode, 'connection_failed');
    assert.equal((await client.match(payload)).errorCode, 'connection_failed');
    assert.deepEqual(await client.match(payload), { status: 'unavailable', errorCode: 'circuit_open' });
    assert.equal(fetchCalls, 2);
  } finally {
    restore();
  }
});

test('enforces max-in-flight backlog protection', async () => {
  let release!: () => void;
  let fetchCalls = 0;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  const restore = installFetch((async () => {
    fetchCalls += 1;
    await pending;
    return validResponse();
  }) as typeof fetch);

  try {
    const client = new InferenceClient(config({
      circuitBreaker: { failureThreshold: 3, maxInFlight: 1, resetMs: 1_000 },
    }));
    const first = client.match(payload);
    await Promise.resolve();
    assert.deepEqual(await client.match(payload), { status: 'unavailable', errorCode: 'backlog_full' });
    assert.equal(fetchCalls, 1);
    release();
    assert.equal((await first).status, 'ok');
  } finally {
    release();
    restore();
  }
});
