export const SHADOW_CONFIG_ERROR_CODES = [
  'invalid_enabled',
  'invalid_kill_switch',
  'invalid_endpoint',
  'invalid_timeout_ms',
  'invalid_sample_rate',
  'invalid_failure_threshold',
  'invalid_reset_ms',
  'invalid_max_in_flight',
] as const;

export type ShadowConfigErrorCode = (typeof SHADOW_CONFIG_ERROR_CODES)[number];

export interface ShadowCircuitBreakerConfig {
  readonly failureThreshold: number;
  readonly resetMs: number;
  readonly maxInFlight: number;
}

export interface ShadowConfig {
  readonly enabled: boolean;
  readonly killSwitch: boolean;
  readonly endpoint: string;
  readonly timeoutMs: number;
  readonly sampleRate: number;
  readonly circuitBreaker: Readonly<ShadowCircuitBreakerConfig>;
  readonly configErrorCode?: ShadowConfigErrorCode;
}

const DEFAULT_ENDPOINT = 'http://127.0.0.1:8080/infer';
const DEFAULT_TIMEOUT_MS = 250;
const DEFAULT_SAMPLE_RATE = 0;
const DEFAULT_FAILURE_THRESHOLD = 3;
const DEFAULT_RESET_MS = 30_000;
const DEFAULT_MAX_IN_FLIGHT = 1;

const TRUE_TOKENS = new Set(['1', 'true', 'yes', 'on']);
const FALSE_TOKENS = new Set(['0', 'false', 'no', 'off']);

class ShadowConfigParseError extends Error {
  readonly code: ShadowConfigErrorCode;

  constructor(code: ShadowConfigErrorCode) {
    super(code);
    this.name = 'ShadowConfigParseError';
    this.code = code;
  }
}

function parseBoolean(
  value: string | undefined,
  fallback: boolean,
  code: ShadowConfigErrorCode,
): boolean {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return fallback;
  if (TRUE_TOKENS.has(normalized)) return true;
  if (FALSE_TOKENS.has(normalized)) return false;
  throw new ShadowConfigParseError(code);
}

function parseInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  code: ShadowConfigErrorCode,
): number {
  const normalized = value?.trim();
  if (!normalized) return fallback;
  if (!/^[0-9]+$/.test(normalized)) throw new ShadowConfigParseError(code);
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new ShadowConfigParseError(code);
  }
  return parsed;
}

function parseSampleRate(value: string | undefined): number {
  const normalized = value?.trim();
  if (!normalized) return DEFAULT_SAMPLE_RATE;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new ShadowConfigParseError('invalid_sample_rate');
  }
  return parsed;
}

function parseEndpoint(value: string | undefined): string {
  const endpoint = value?.trim() || DEFAULT_ENDPOINT;
  // Reject a raw literal '#' before parsing: `http://host/infer#` yields an empty
  // URL.hash, which the post-parse hash check cannot catch. Percent-encoded '%23'
  // contains no literal '#' and remains allowed.
  if (/#/.test(endpoint)) throw new ShadowConfigParseError('invalid_endpoint');
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new ShadowConfigParseError('invalid_endpoint');
  }
  if (
    (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
    || !parsed.hostname
    || parsed.username !== ''
    || parsed.password !== ''
    || parsed.hash !== ''
  ) {
    throw new ShadowConfigParseError('invalid_endpoint');
  }
  return endpoint;
}

function freezeConfig(config: Omit<ShadowConfig, 'circuitBreaker'> & {
  circuitBreaker: ShadowCircuitBreakerConfig;
}): ShadowConfig {
  return Object.freeze({
    ...config,
    circuitBreaker: Object.freeze({ ...config.circuitBreaker }),
  });
}

/**
 * Strictly parse the shadow-only environment variables:
 * FISHING_SHADOW_ENABLED, FISHING_SHADOW_KILL_SWITCH,
 * FISHING_SHADOW_ENDPOINT, FISHING_SHADOW_TIMEOUT_MS,
 * FISHING_SHADOW_SAMPLE_RATE, FISHING_SHADOW_FAILURE_THRESHOLD,
 * FISHING_SHADOW_RESET_MS, and FISHING_SHADOW_MAX_IN_FLIGHT.
 */
export function parseShadowConfig(env: NodeJS.ProcessEnv = process.env): ShadowConfig {
  return freezeConfig({
    enabled: parseBoolean(env.FISHING_SHADOW_ENABLED, false, 'invalid_enabled'),
    killSwitch: parseBoolean(
      env.FISHING_SHADOW_KILL_SWITCH,
      false,
      'invalid_kill_switch',
    ),
    endpoint: parseEndpoint(env.FISHING_SHADOW_ENDPOINT),
    timeoutMs: parseInteger(
      env.FISHING_SHADOW_TIMEOUT_MS,
      DEFAULT_TIMEOUT_MS,
      1,
      5_000,
      'invalid_timeout_ms',
    ),
    sampleRate: parseSampleRate(env.FISHING_SHADOW_SAMPLE_RATE),
    circuitBreaker: {
      failureThreshold: parseInteger(
        env.FISHING_SHADOW_FAILURE_THRESHOLD,
        DEFAULT_FAILURE_THRESHOLD,
        1,
        100,
        'invalid_failure_threshold',
      ),
      resetMs: parseInteger(
        env.FISHING_SHADOW_RESET_MS,
        DEFAULT_RESET_MS,
        100,
        300_000,
        'invalid_reset_ms',
      ),
      maxInFlight: parseInteger(
        env.FISHING_SHADOW_MAX_IN_FLIGHT,
        DEFAULT_MAX_IN_FLIGHT,
        1,
        16,
        'invalid_max_in_flight',
      ),
    },
  });
}

/** Fail closed on invalid shadow-only configuration without breaking startup. */
export function loadShadowConfig(env: NodeJS.ProcessEnv = process.env): ShadowConfig {
  try {
    return parseShadowConfig(env);
  } catch (error) {
    const configErrorCode = error instanceof ShadowConfigParseError
      ? error.code
      : 'invalid_enabled';
    return freezeConfig({
      enabled: false,
      killSwitch: true,
      endpoint: DEFAULT_ENDPOINT,
      timeoutMs: DEFAULT_TIMEOUT_MS,
      sampleRate: DEFAULT_SAMPLE_RATE,
      circuitBreaker: {
        failureThreshold: DEFAULT_FAILURE_THRESHOLD,
        resetMs: DEFAULT_RESET_MS,
        maxInFlight: DEFAULT_MAX_IN_FLIGHT,
      },
      configErrorCode,
    });
  }
}

export function shouldSampleShadow(
  config: Pick<ShadowConfig, 'enabled' | 'killSwitch' | 'sampleRate'>,
  randomValue: number = Math.random(),
): boolean {
  if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
    throw new RangeError('random_value_out_of_range');
  }
  return config.enabled
    && !config.killSwitch
    && config.sampleRate > 0
    && randomValue < config.sampleRate;
}
