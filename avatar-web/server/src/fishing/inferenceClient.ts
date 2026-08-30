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
  // Copy into a fresh plain Buffer[] via indexed access only. Never trust a
  // caller-owned iterator/map/serialization hook: the validator and encoder
  // must observe exactly the same buffers that reach the wire body.
  const buffers: Buffer[] = [];
  for (let i = 0; i < images.length; i++) {
    const png = images[i];
    validatePng(png);
    buffers.push(png);
  }
  return buffers;
}

function requestImages(images: readonly Buffer[]): RequestImage[] {
  const out: RequestImage[] = [];
  for (let i = 0; i < images.length; i++) {
    out.push({ index: i, pngBase64: images[i].toString('base64') });
  }
  return out;
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
  // The too-large check is performed by the caller (readBoundedResponse) so the
  // body can be released first; we only parse and validate the numeric format here.
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
  if (declaredLength !== undefined && declaredLength > MAX_RESPONSE_BYTES) {
    // Release the transport before surfacing the stable error code.
    await cancelBody(response);
    throw new ResponseValidationError('response_too_large');
  }
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
        // Best-effort release the transport. Swallow any cancel rejection so the
        // stable response_too_large code cannot be masked as connection_failed.
        await cancelBody(response);
        throw new ResponseValidationError('response_too_large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  // When a content-encoding is present, Content-Length is the ENCODED byte count
  // while response.body yields DECODED bytes, so exact equality is wrong under
  // decompression. Drop the strict check there; the streamed cap already bounds it.
  const encoding = response.headers.get('content-encoding');
  const hasEncoding = encoding !== null && encoding.toLowerCase() !== 'identity';
  if (declaredLength !== undefined && !hasEncoding && total !== declaredLength) {
    await cancelBody(response);
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
  if (typeof value.modelId !== 'string' || !isValidModelId(value.modelId)) {
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

function isValidModelId(modelId: string): boolean {
  if (modelId.length === 0 || modelId.length > MAX_MODEL_ID_CHARS) return false;
  for (let i = 0; i < modelId.length; i++) {
    const code = modelId.charCodeAt(i);
    // Reject C0 controls (< 0x20) and DEL (0x7f).
    if (code < 0x20 || code === 0x7f) return false;
    // Reject C1 controls (0x80-0x9f).
    if (code >= 0x80 && code <= 0x9f) return false;
    // Reject lone UTF-16 surrogates (never form a valid pair here).
    if (code >= 0xd800 && code <= 0xdfff) return false;
  }
  // Reject Unicode line separators (U+2028, U+2029) and bidi controls
  // (U+200E, U+200F, U+202A-U+202E). Use escape sequences: literal U+2028/U+2029
  // are JS line terminators and would break the regex literal.
  if (/[\u2028\u2029\u200e\u200f\u202a-\u202e]/.test(modelId)) {
    return false;
  }
  return true;
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
  #generation = 0;
  #modelId: string | undefined;

  constructor(config: ShadowConfig) {
    this.#config = config;
  }

  async match(payload: CanCauPayload): Promise<ShadowMatchResult> {
    if (
      !this.#config.enabled
      || this.#config.killSwitch
      || !(this.#config.sampleRate > 0)
      || !Number.isFinite(this.#config.sampleRate)
    ) {
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
    // Capture the breaker generation BEFORE any await. Only an outcome whose
    // generation still matches may mutate breaker state; an older in-flight
    // request completing after a newer transition must not corrupt the breaker.
    const gen = this.#generation;
    try {
      const result = await this.#matchOnce(request);
      // Only an outcome whose generation still matches may mutate breaker state.
      if (gen === this.#generation) {
        if (result.status === 'ok') {
          if (probe) {
            // Half-open probe success is the only path that closes the breaker.
            this.#closeBreaker();
          } else {
            // A non-probe success while closed resets the failure counter.
            this.#consecutiveFailures = 0;
          }
        } else if (probe) {
          // Half-open probe failure re-opens the breaker for another reset window.
          this.#openBreaker();
        } else {
          this.#recordFailure();
        }
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
      // Open transition: bump the generation so any in-flight request admitted
      // under the previous (closed) state is ignored when it completes.
      this.#generation += 1;
      this.#openUntil = Date.now() + this.#config.circuitBreaker.resetMs;
    }
  }

  #openBreaker(): void {
    this.#generation += 1;
    this.#openUntil = Date.now() + this.#config.circuitBreaker.resetMs;
  }

  #closeBreaker(): void {
    this.#generation += 1;
    this.#openUntil = 0;
    this.#consecutiveFailures = 0;
  }

  async #matchOnce(request: InferenceRequestDocument): Promise<ShadowMatchResult> {
    const startedAt = performance.now();
    // Strict, monotonic end-to-end deadline independent of the abort timer. The
    // abort timer alone can be defeated by microtask-heavy stream processing that
    // finishes after timeoutMs yet still returns ok.
    const deadline = Date.now() + this.#config.timeoutMs;
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
      // Enforce the deadline after the body is fully read/decoded and before any
      // success is emitted. Past the deadline the outcome is treated as a timeout.
      if (Date.now() > deadline) {
        await cancelBody(response);
        return { status: 'timeout', latencyMs: elapsedMs(startedAt), errorCode: 'request_timeout' };
      }
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
