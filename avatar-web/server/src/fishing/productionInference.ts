import type { CanCauPayload, InferencePrediction, InferenceResult } from './autoDecision.js';

export interface ProductionInferenceConfig {
  readonly endpoint: string;
  readonly timeoutMs: number;
  readonly expectedModelId?: string;
}

const MAX_IMAGES_PER_LIST = 64;
const MAX_PNG_BYTES = 960_000;
const MAX_RESPONSE_BYTES = 1_048_576;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

interface RequestImage {
  readonly index: number;
  readonly pngBase64: string;
}

interface InferenceRequestDocument {
  readonly schemaVersion: 1;
  readonly references: readonly RequestImage[];
  readonly queries: readonly RequestImage[];
}

function validatePng(png: unknown): asserts png is Buffer {
  if (!Buffer.isBuffer(png)) throw new Error('invalid_image_type');
  if (png.length < 33) throw new Error('invalid_png');
  if (!png.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error('invalid_png');
  }
}

function validateImages(images: unknown): readonly Buffer[] {
  if (!Array.isArray(images) || images.length < 1 || images.length > MAX_IMAGES_PER_LIST) {
    throw new Error('invalid_image_count');
  }
  const out: Buffer[] = [];
  for (let i = 0; i < images.length; i++) {
    const b = images[i];
    validatePng(b);
    out.push(b);
  }
  return out;
}

function buildPayload(payload: CanCauPayload): string {
  const refs = validateImages(payload.images);
  const queries = validateImages(payload.imagesNew);
  let totalBytes = 0;
  for (const r of refs) totalBytes += r.length;
  for (const q of queries) totalBytes += q.length;
  if (totalBytes > MAX_PNG_BYTES) throw new Error('request_body_too_large');

  const reqDoc: InferenceRequestDocument = {
    schemaVersion: 1,
    references: refs.map((buf, index) => ({ index, pngBase64: buf.toString('base64') })),
    queries: queries.map((buf, index) => ({ index, pngBase64: buf.toString('base64') })),
  };
  return JSON.stringify(reqDoc);
}

export class ProductionInferenceClient {
  readonly #endpoint: string;
  readonly #timeoutMs: number;
  readonly #expectedModelId?: string;

  constructor(config: ProductionInferenceConfig) {
    this.#endpoint = config.endpoint;
    this.#timeoutMs = config.timeoutMs;
    this.#expectedModelId = config.expectedModelId;
  }

  async match(payload: CanCauPayload): Promise<InferenceResult> {
    const startedAt = performance.now();
    let body: string;
    try {
      body = buildPayload(payload);
    } catch {
      return { status: 'invalid', errorCode: 'invalid_payload' };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#timeoutMs);
    timer.unref?.();

    try {
      const response = await fetch(this.#endpoint, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body,
        redirect: 'error',
        signal: controller.signal,
      });

      if (response.status !== 200) {
        return { status: 'unavailable', errorCode: 'http_status' };
      }

      const text = await response.text();
      if (text.length > MAX_RESPONSE_BYTES) {
        return { status: 'invalid', errorCode: 'response_too_large' };
      }

      const doc = JSON.parse(text) as {
        schemaVersion?: number;
        modelId?: string;
        predictions?: InferencePrediction[];
        latencyMs?: number;
      };

      if (doc.schemaVersion !== 1 || typeof doc.modelId !== 'string' || !Array.isArray(doc.predictions)) {
        return { status: 'invalid', errorCode: 'invalid_response_schema' };
      }

      if (this.#expectedModelId !== undefined && doc.modelId !== this.#expectedModelId) {
        return { status: 'invalid', errorCode: 'model_identity_mismatch' };
      }

      const latencyMs = Math.max(0, Math.round(performance.now() - startedAt));
      return {
        status: 'ok',
        modelId: doc.modelId,
        predictions: doc.predictions,
        predictionCount: doc.predictions.length,
        acceptedCount: doc.predictions.filter((p) => p.accepted).length,
        latencyMs,
      };
    } catch (err) {
      const latencyMs = Math.max(0, Math.round(performance.now() - startedAt));
      if (controller.signal.aborted) {
        return { status: 'timeout', latencyMs, errorCode: 'request_timeout' };
      }
      return { status: 'unavailable', latencyMs, errorCode: 'connection_failed' };
    } finally {
      clearTimeout(timer);
    }
  }
}
