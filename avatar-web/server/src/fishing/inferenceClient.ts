import type { ShadowConfig } from './shadowConfig.js';

export interface CanCauPayload {
  readonly images: readonly Buffer[];
  readonly imagesNew?: readonly Buffer[];
}

export interface ShadowMatchResult {
  readonly status: 'ok' | 'disabled' | 'timeout' | 'unavailable' | 'invalid';
  readonly modelId?: string;
  readonly predictionCount?: number;
  readonly acceptedCount?: number;
  readonly latencyMs?: number;
  readonly errorCode?: string;
}

interface RequestImage {
  readonly index: number;
  readonly pngBase64: string;
}

interface InferenceRequestDocument {
  readonly schemaVersion: 1;
  readonly references: readonly RequestImage[];
  readonly queries: readonly RequestImage[];
}

interface InferencePrediction {
  readonly queryIndex: number;
  readonly referenceIndex: number;
  readonly similarity: number;
  readonly margin: number | null;
  readonly accepted: boolean;
}

interface InferenceResponseDocument {
  readonly schemaVersion: 1;
  readonly modelId: string;
  readonly predictions: readonly InferencePrediction[];
  readonly latencyMs: number;
}

const MAX_IMAGES_PER_LIST = 64;
const MAX_PNG_BYTES = 960_000;
const MAX_RESPONSE_BYTES = 1_048_576;
const MAX_MODEL_ID_CHARS = 1_024;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const RESPONSE_KEYS = new Set(['schemaVersion', 'modelId', 'predictions', 'latencyMs']);
const PREDICTION_KEYS = new Set([
  'queryIndex',
  'referenceIndex',
  'similarity',
  'margin',
  'accepted',
]);

class LocalValidationError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'LocalValidationError';
    this.code = code;
  }
}

class ResponseValidationError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'ResponseValidationError';
    this.code = code;
  }
}

function invalid(errorCode: string): ShadowMatchResult {
  return { status: 'invalid', errorCode };
}

function unavailable(errorCode: string): ShadowMatchResult {
  return { status: 'unavailable', errorCode };
}

function isExactObject(value: unknown, keys: ReadonlySet<string>): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const present = Object.keys(value);
  return present.length === keys.size && present.every((key) => keys.has(key));
}

function isInteger(value: unknown): value is number {
  return Number.isInteger(value);
}

function validatePng(png: unknown): asserts png is Buffer {
  if (!Buffer.isBuffer(png)) throw new LocalValidationError('invalid_image_type');
  if (png.length < 33) throw new LocalValidationError('invalid_png');
  if (!png.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new LocalValidationError('invalid_png');
  }
  if (png.readUInt32BE(8) !== 13 || png.toString('ascii', 12, 16) !== 'IHDR') {
    throw new LocalValidationError('invalid_png_header');
  }
  if (png.readUInt32BE(16) !== 75 || png.readUInt32BE(20) !== 75) {
    throw new LocalValidationError('invalid_png_dimensions');
  }
  const colorType = png[25];
  if (colorType !== 2 && colorType !== 6) {
    throw new LocalValidationError('invalid_png_color_type');
  }
}

function validateImageList(
  images: unknown,
  field: 'references' | 'queries',
): readonly Buffer[] {
  if (!Array.isArray(images) || images.length < 1 || images.length > MAX_IMAGES_PER_LIST) {
    throw new LocalValidationError(`invalid_${field}_count`);
  }
  for (const png of images) validatePng(png);
  return images;
}

function requestImages(images: readonly Buffer[]): RequestImage[] {
  return images.map((png, index) => ({ index, pngBase64: png.toString('base64') }));
}

function buildRequest(payload: CanCauPayload): InferenceRequestDocument {
  if (typeof payload !== 'object' || payload === null) {
    throw new LocalValidationError('invalid_payload');
  }
  const referenceBuffers = validateImageList(payload.images, 'references');
  const queryBuffers = validateImageList(payload.imagesNew, 'queries');
  let aggregateBytes = 0;
  for (const image of referenceBuffers) aggregateBytes += image.length;
  for (const image of queryBuffers) aggregateBytes += image.length;
  if (aggregateBytes > MAX_PNG_BYTES) {
    throw new LocalValidationError('request_body_too_large');
  }
  return {
    schemaVersion: 1,
    references: requestImages(referenceBuffers),
    queries: requestImages(queryBuffers),
  };
}

function parseContentLength(response: Response): number | undefined {
  const raw = response.headers.get('content-length');
  if (raw === null) return undefined;
  if (!/^[0-9]+$/.test(raw)) throw new ResponseValidationError('invalid_content_length');
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed)) {
    throw new ResponseValidationError('invalid_content_length');
  }
  if (parsed > MAX_RESPONSE_BYTES) throw new ResponseValidationError('response_too_large');
  return parsed;
}

async function cancelBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // The peer may already have closed the stream. Never surface body-adjacent errors.
  }
}

async function readBoundedResponse(response: Response): Promise<Uint8Array> {
  const declaredLength = parseContentLength(response);
  if (response.body === null) {
    if (declaredLength !== undefined && declaredLength !== 0) {
      throw new ResponseValidationError('truncated_response_body');
    }
    return new Uint8Array();
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new ResponseValidationError('response_too_large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  if (declaredLength !== undefined && total !== declaredLength) {
    throw new ResponseValidationError('truncated_response_body');
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function parseResponseDocument(raw: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw));
  } catch {
    throw new ResponseValidationError('malformed_json');
  }
}

function validateResponse(
  value: unknown,
  referenceCount: number,
  queryCount: number,
): InferenceResponseDocument {
  if (!isExactObject(value, RESPONSE_KEYS)) {
    throw new ResponseValidationError('invalid_response_schema');
  }
  if (value.schemaVersion !== 1) {
    throw new ResponseValidationError('unsupported_schema_version');
  }
  if (
    typeof value.modelId !== 'string'
    || value.modelId.length === 0
    || value.modelId.length > MAX_MODEL_ID_CHARS
    || /[\u0000-\u001f\u007f]/.test(value.modelId)
  ) {
    throw new ResponseValidationError('invalid_model_id');
  }
  if (!isInteger(value.latencyMs) || value.latencyMs < 0) {
    throw new ResponseValidationError('invalid_latency_ms');
  }
  if (!Array.isArray(value.predictions)) {
    throw new ResponseValidationError('invalid_predictions');
  }

  const seenQueries = new Set<number>();
  const predictions = value.predictions.map((prediction) => {
    if (!isExactObject(prediction, PREDICTION_KEYS)) {
      throw new ResponseValidationError('invalid_prediction_schema');
    }
    if (!isInteger(prediction.queryIndex) || prediction.queryIndex < 0) {
      throw new ResponseValidationError('invalid_query_index');
    }
    if (prediction.queryIndex >= queryCount) {
      throw new ResponseValidationError('query_index_out_of_range');
    }
    if (seenQueries.has(prediction.queryIndex)) {
      throw new ResponseValidationError('duplicate_query_index');
    }
    seenQueries.add(prediction.queryIndex);
    if (!isInteger(prediction.referenceIndex) || prediction.referenceIndex < 0) {
      throw new ResponseValidationError('invalid_reference_index');
    }
    if (prediction.referenceIndex >= referenceCount) {
      throw new ResponseValidationError('reference_index_out_of_range');
    }
    if (typeof prediction.similarity !== 'number' || !Number.isFinite(prediction.similarity)) {
      throw new ResponseValidationError('non_finite_similarity');
    }
    if (
      prediction.margin !== null
      && (typeof prediction.margin !== 'number' || !Number.isFinite(prediction.margin))
    ) {
      throw new ResponseValidationError('non_finite_margin');
    }
    if (typeof prediction.accepted !== 'boolean') {
      throw new ResponseValidationError('invalid_accepted');
    }
    return prediction as unknown as InferencePrediction;
  });

  return {
    schemaVersion: 1,
    modelId: value.modelId,
    predictions,
    latencyMs: value.latencyMs,
  };
}

function elapsedMs(startedAt: number): number {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

function isAbortError(error: unknown, signal: AbortSignal): boolean {
  return signal.aborted
    || (error instanceof DOMException && error.name === 'AbortError')
    || (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError'));
}

export class InferenceClient {
  readonly #config: ShadowConfig;
  #inFlight = 0;
  #consecutiveFailures = 0;
  #openUntil = 0;
  #probeInFlight = false;
  #modelId: string | undefined;

  constructor(config: ShadowConfig) {
    this.#config = config;
  }

  async match(payload: CanCauPayload): Promise<ShadowMatchResult> {
    if (!this.#config.enabled || this.#config.killSwitch || this.#config.sampleRate <= 0) {
      return { status: 'disabled' };
    }

    const now = Date.now();
    const probe = this.#openUntil > 0 && now >= this.#openUntil;
    if (this.#openUntil > now || (probe && this.#probeInFlight)) {
      return unavailable('circuit_open');
    }
    if (this.#inFlight >= this.#config.circuitBreaker.maxInFlight) {
      return unavailable('backlog_full');
    }

    let request: InferenceRequestDocument;
    try {
      request = buildRequest(payload);
    } catch (error) {
      return invalid(error instanceof LocalValidationError ? error.code : 'invalid_payload');
    }

    if (probe) this.#probeInFlight = true;
    this.#inFlight += 1;
    try {
      const result = await this.#matchOnce(request);
      if (result.status === 'ok') {
        this.#consecutiveFailures = 0;
        this.#openUntil = 0;
      } else {
        this.#recordFailure();
      }
      return result;
    } finally {
      this.#inFlight -= 1;
      if (probe) this.#probeInFlight = false;
    }
  }

  #recordFailure(): void {
    this.#consecutiveFailures += 1;
    if (this.#consecutiveFailures >= this.#config.circuitBreaker.failureThreshold) {
      this.#openUntil = Date.now() + this.#config.circuitBreaker.resetMs;
    }
  }

  async #matchOnce(request: InferenceRequestDocument): Promise<ShadowMatchResult> {
    const startedAt = performance.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#config.timeoutMs);
    timer.unref?.();

    try {
      const response = await fetch(this.#config.endpoint, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify(request),
        redirect: 'error',
        signal: controller.signal,
      });
      if (!response.ok) {
        await cancelBody(response);
        return unavailable('http_status');
      }

      const rawResponse = await readBoundedResponse(response);
      const document = validateResponse(
        parseResponseDocument(rawResponse),
        request.references.length,
        request.queries.length,
      );
      if (this.#modelId === undefined) {
        this.#modelId = document.modelId;
      } else if (document.modelId !== this.#modelId) {
        return invalid('model_identity_mismatch');
      }

      return {
        status: 'ok',
        modelId: document.modelId,
        predictionCount: document.predictions.length,
        acceptedCount: document.predictions.filter((prediction) => prediction.accepted).length,
        latencyMs: elapsedMs(startedAt),
      };
    } catch (error) {
      if (isAbortError(error, controller.signal)) {
        return { status: 'timeout', latencyMs: elapsedMs(startedAt), errorCode: 'request_timeout' };
      }
      if (error instanceof ResponseValidationError) {
        return invalid(error.code);
      }
      return unavailable('connection_failed');
    } finally {
      clearTimeout(timer);
    }
  }
}
