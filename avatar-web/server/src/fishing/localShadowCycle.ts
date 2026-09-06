import type { CanCauPayload } from '../game/fishingDecode.js';
import {
  InferenceClient,
  type CanCauPayload as ImageOnlyPayload,
  type ShadowMatchResult,
} from './inferenceClient.js';

export const LOCAL_SHADOW_CYCLE_ID = 'p2cr2-20260906-01';

export const LOCAL_SHADOW_CASES = [
  'success',
  'timeout',
  'unavailable',
  'malformed_response',
  'wrong_model_identity',
  'post_kill_switch_disabled_before_http',
] as const;

export type LocalShadowCase = (typeof LOCAL_SHADOW_CASES)[number];
export type LocalShadowCaseStatus = ShadowMatchResult['status'];
export type LocalShadowErrorCode =
  | 'connection_failed'
  | 'request_timeout'
  | 'malformed_json'
  | 'model_identity_mismatch'
  | 'unexpected_result';

export interface LocalShadowCaseResult {
  readonly name: LocalShadowCase;
  readonly status: LocalShadowCaseStatus;
  readonly errorCode?: LocalShadowErrorCode;
}

export interface LocalShadowAggregateReport {
  readonly schemaVersion: 1;
  readonly cycleId: typeof LOCAL_SHADOW_CYCLE_ID;
  readonly replayGateSha256: string;
  readonly fixtureSha256: string;
  readonly caseCount: number;
  readonly continuationCount: number;
  readonly httpRequestCount: number;
  readonly gameplaySideEffectCount: number;
  readonly cases: readonly LocalShadowCaseResult[];
  readonly status: 'PASS' | 'FAIL';
}

const SAFE_ERROR_CODES = new Set<LocalShadowErrorCode>([
  'connection_failed',
  'request_timeout',
  'malformed_json',
  'model_identity_mismatch',
  'unexpected_result',
]);

const EXPECTED_RESULTS: Readonly<Record<LocalShadowCase, LocalShadowCaseResult>> = {
  success: { name: 'success', status: 'ok' },
  timeout: { name: 'timeout', status: 'timeout', errorCode: 'request_timeout' },
  unavailable: {
    name: 'unavailable',
    status: 'unavailable',
    errorCode: 'connection_failed',
  },
  malformed_response: {
    name: 'malformed_response',
    status: 'invalid',
    errorCode: 'malformed_json',
  },
  wrong_model_identity: {
    name: 'wrong_model_identity',
    status: 'invalid',
    errorCode: 'model_identity_mismatch',
  },
  post_kill_switch_disabled_before_http: {
    name: 'post_kill_switch_disabled_before_http',
    status: 'disabled',
  },
};

const MATCH_STATUSES = new Set<LocalShadowCaseStatus>([
  'ok',
  'disabled',
  'timeout',
  'unavailable',
  'invalid',
]);

function sanitizeResult(
  name: LocalShadowCase,
  result: ShadowMatchResult,
): LocalShadowCaseResult {
  if (!MATCH_STATUSES.has(result.status)) {
    return { name, status: 'invalid', errorCode: 'unexpected_result' };
  }
  if (result.errorCode === undefined) return { name, status: result.status };
  if (!SAFE_ERROR_CODES.has(result.errorCode as LocalShadowErrorCode)) {
    return { name, status: 'invalid', errorCode: 'unexpected_result' };
  }
  return {
    name,
    status: result.status,
    errorCode: result.errorCode as LocalShadowErrorCode,
  };
}

function matchesExpected(result: LocalShadowCaseResult): boolean {
  const expected = EXPECTED_RESULTS[result.name];
  return result.status === expected.status && result.errorCode === expected.errorCode;
}

function isLowercaseSha256(value: string): boolean {
  return /^[0-9a-f]{64}$/.test(value);
}

export class LocalShadowCycleController {
  readonly #client: InferenceClient;
  #killed = false;

  constructor(client: InferenceClient) {
    this.#client = client;
  }

  kill(): void {
    this.#killed = true;
  }

  async runCase(
    name: LocalShadowCase,
    payload: CanCauPayload,
    continuation: () => void,
  ): Promise<LocalShadowCaseResult> {
    try {
      if (this.#killed) return { name, status: 'disabled' };
      const imageOnly: ImageOnlyPayload = {
        images: payload.images,
        imagesNew: payload.imagesNew,
      };
      return sanitizeResult(name, await this.#client.match(imageOnly));
    } catch {
      return { name, status: 'unavailable', errorCode: 'connection_failed' };
    } finally {
      try {
        continuation();
      } catch {
        // The safety harness never lets a continuation failure escape the shadow path.
      }
    }
  }
}

export function buildLocalShadowAggregateReport(input: {
  readonly replayGateSha256: string;
  readonly fixtureSha256: string;
  readonly continuationCount: number;
  readonly httpRequestCount: number;
  readonly gameplaySideEffectCount: number;
  readonly cases: readonly LocalShadowCaseResult[];
}): LocalShadowAggregateReport {
  if (!isLowercaseSha256(input.replayGateSha256)) {
    throw new Error('replay gate digest is invalid');
  }
  if (!isLowercaseSha256(input.fixtureSha256)) {
    throw new Error('fixture digest is invalid');
  }
  const cases = input.cases.map((result) => ({ ...result }));
  const exactCases = cases.length === LOCAL_SHADOW_CASES.length
    && cases.every((result, index) => (
      result.name === LOCAL_SHADOW_CASES[index] && matchesExpected(result)
    ));
  const passed = exactCases
    && input.continuationCount === LOCAL_SHADOW_CASES.length
    && input.httpRequestCount === LOCAL_SHADOW_CASES.length - 1
    && input.gameplaySideEffectCount === 0;
  return {
    schemaVersion: 1,
    cycleId: LOCAL_SHADOW_CYCLE_ID,
    replayGateSha256: input.replayGateSha256,
    fixtureSha256: input.fixtureSha256,
    caseCount: cases.length,
    continuationCount: input.continuationCount,
    httpRequestCount: input.httpRequestCount,
    gameplaySideEffectCount: input.gameplaySideEffectCount,
    cases,
    status: passed ? 'PASS' : 'FAIL',
  };
}
