import { InferenceClient, type CanCauPayload as ImageOnlyPayload, type ShadowMatchResult } from './inferenceClient.js';
import { loadShadowConfig, shouldSampleShadow } from './shadowConfig.js';
import type { CanCauPayload } from '../game/fishingDecode.js';
import type { ShadowConfig } from './shadowConfig.js';

// Lazily-built singleton. The config is read once at module load; the client is
// only instantiated on first use, and only when a match is actually attempted.
let config: ShadowConfig = loadShadowConfig();
let client: InferenceClient | undefined;

// The production path (`maybeShadowMatch`) passes no config, so `cfg` is the
// module singleton and the client is built once and cached. A caller-supplied
// config always drives its own client from that config — never the singleton —
// so `runShadowMatch(payload, cfg)` honors `cfg` end to end.
function getClient(cfg: ShadowConfig): InferenceClient {
  if (cfg === config) {
    if (client === undefined) client = new InferenceClient(config);
    return client;
  }
  return new InferenceClient(cfg);
}

/**
 * Best-effort, read-only shadow inference against a fishing CAN_CAU RX79.
 *
 * Returns `{ status: 'disabled' }` when shadow sampling is off (default):
 * no request is ever made. Otherwise maps the game payload to the image-only
 * request shape and awaits the inference client. Any failure (network,
 * timeout, malformed response) is converted into a result code and never
 * thrown — callers must not see the shadow path fail the real flow.
 */
export async function runShadowMatch(
  payload: CanCauPayload,
  cfg: ShadowConfig = config,
): Promise<ShadowMatchResult> {
  if (!shouldSampleShadow(cfg)) {
    return { status: 'disabled' };
  }

  const imageOnly: ImageOnlyPayload = {
    images: payload.images,
    imagesNew: payload.imagesNew,
  };

  try {
    // Never forward idUser/idFish/timeDelayMs — image bytes only.
    return await getClient(cfg).match(imageOnly);
  } catch {
    return { status: 'unavailable', errorCode: 'connection_failed' };
  }
}

/**
 * Emit a single sanitized telemetry line for a shadow match result.
 *
 * Only `{ shadow, status, errorCode?, predictionCount?, acceptedCount? }` are
 * logged. NEVER modelId, predictions, idUser/idFish, raw packet, base64 image,
 * cookie, or credentials. Mirrors the surrounding redacted logging style.
 */
export function recordShadowTelemetry(result: ShadowMatchResult): void {
  console.error(JSON.stringify({
    shadow: true,
    status: result.status,
    ...(result.errorCode !== undefined ? { errorCode: result.errorCode } : {}),
    ...(result.predictionCount !== undefined ? { predictionCount: result.predictionCount } : {}),
    ...(result.acceptedCount !== undefined ? { acceptedCount: result.acceptedCount } : {}),
  }));
}

/**
 * Fire-and-forget convenience for the two call sites in fishing-probe.ts.
 * Never throws into the caller; resolves the telemetry record on success and
 * swallows any rejection from the telemetry step itself.
 */
export function maybeShadowMatch(payload: CanCauPayload): void {
  void runShadowMatch(payload)
    .then(recordShadowTelemetry)
    .catch(() => {});
}
