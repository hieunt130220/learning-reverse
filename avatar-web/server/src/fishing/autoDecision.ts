import { randomInt } from 'node:crypto';

import type { CanCauPayload } from '../game/fishingDecode.js';

/** Verified immutable mapping: TX43 wire byte = 0-based reference index. */
export const REFERENCE_TO_TX43_BYTE: readonly number[] = Object.freeze([0, 1, 2, 3, 4, 5]);

export interface FishingAnswerDomain {
  readonly queryCount: number;
  readonly validValuesByQuery: readonly (readonly number[])[];
}

export interface InferencePrediction {
  readonly queryIndex: number;
  readonly referenceIndex: number;
  readonly similarity: number;
  readonly margin: number | null;
  readonly accepted: boolean;
}

export interface SuccessfulInferenceResult {
  readonly status: 'ok';
  readonly modelId: string;
  readonly predictions: readonly InferencePrediction[];
  readonly predictionCount: number;
  readonly acceptedCount: number;
  readonly latencyMs: number;
}

export interface FailedInferenceResult {
  readonly status: 'disabled' | 'timeout' | 'unavailable' | 'invalid';
  readonly latencyMs?: number;
  readonly errorCode?: string;
}

export type InferenceResult =
  | SuccessfulInferenceResult
  | FailedInferenceResult;

export type AutoDecisionFailureCode =
  | 'disabled'
  | 'timeout'
  | 'unavailable'
  | 'invalid_response'
  | 'incomplete_predictions'
  | 'duplicate_query_index'
  | 'query_index_out_of_range'
  | 'reference_index_out_of_range'
  | 'model_identity_mismatch'
  | 'checkpoint_unavailable'
  | 'unexpected_error';

export type AutoDecisionResult =
  | {
      readonly status: 'answer';
      readonly source: 'ml';
      readonly answer: readonly number[];
      readonly modelId: string;
      readonly latencyMs?: number;
    }
  | {
      readonly status: 'answer';
      readonly source: 'random';
      readonly answer: readonly number[];
      readonly fallbackCode: AutoDecisionFailureCode;
      readonly latencyMs?: number;
    }
  | {
      readonly status: 'indeterminate';
      readonly code: 'invalid_answer_domain';
    };

/**
 * Builds the valid answer domain for an RX79 challenge payload.
 * Returns undefined if payload is structurally invalid, query count is out of
 * bounds, or reference count exceeds the verified bounds.
 */
export function buildAnswerDomain(payload: CanCauPayload): FishingAnswerDomain | undefined {
  if (
    !payload
    || !Array.isArray(payload.images)
    || payload.images.length === 0
    || payload.images.length > REFERENCE_TO_TX43_BYTE.length
    || !Array.isArray(payload.imagesNew)
    || payload.imagesNew.length === 0
    || payload.imagesNew.length > 255
  ) {
    return undefined;
  }

  const queryCount = payload.imagesNew.length;
  const refCount = payload.images.length;
  const validValues = REFERENCE_TO_TX43_BYTE.slice(0, refCount);

  const validValuesByQuery: (readonly number[])[] = [];
  for (let i = 0; i < queryCount; i++) {
    validValuesByQuery.push(validValues);
  }

  return {
    queryCount,
    validValuesByQuery: Object.freeze(validValuesByQuery),
  };
}

/**
 * Cryptographically draws an independent random valid answer for each query.
 */
export function randomAnswer(domain: FishingAnswerDomain): number[] {
  return domain.validValuesByQuery.map((values) => values[randomInt(values.length)]!);
}

/**
 * Maps an inference failure result to a sanitized AutoDecisionFailureCode.
 */
function mapInferenceFailureCode(res: FailedInferenceResult): AutoDecisionFailureCode {
  if (res.status === 'disabled') return 'disabled';
  if (res.status === 'timeout') return 'timeout';
  if (res.status === 'unavailable') {
    if (res.errorCode === 'checkpoint_unavailable') return 'checkpoint_unavailable';
    return 'unavailable';
  }
  if (res.errorCode === 'model_identity_mismatch') return 'model_identity_mismatch';
  return 'invalid_response';
}

/**
 * Evaluates inference result against the challenge domain and produces an
 * AutoDecisionResult (ML answer, random fallback, or indeterminate).
 */
export async function makeAutoDecision(
  payload: CanCauPayload,
  domain: FishingAnswerDomain | undefined,
  inferFn: (payload: CanCauPayload) => Promise<InferenceResult>,
): Promise<AutoDecisionResult> {
  if (!domain) {
    return { status: 'indeterminate', code: 'invalid_answer_domain' };
  }

  let inferRes: InferenceResult;
  try {
    inferRes = await inferFn(payload);
  } catch {
    return {
      status: 'answer',
      source: 'random',
      answer: randomAnswer(domain),
      fallbackCode: 'unexpected_error',
    };
  }

  if (inferRes.status !== 'ok') {
    return {
      status: 'answer',
      source: 'random',
      answer: randomAnswer(domain),
      fallbackCode: mapInferenceFailureCode(inferRes),
      latencyMs: inferRes.latencyMs,
    };
  }

  // Validate predictions completeness and conformity to domain
  const { predictions, modelId, latencyMs } = inferRes;
  if (!Array.isArray(predictions) || predictions.length !== domain.queryCount) {
    return {
      status: 'answer',
      source: 'random',
      answer: randomAnswer(domain),
      fallbackCode: 'incomplete_predictions',
      latencyMs,
    };
  }

  const seenQueries = new Set<number>();
  const answersByQuery = new Array<number>(domain.queryCount);

  for (const pred of predictions) {
    if (!pred || typeof pred.queryIndex !== 'number' || typeof pred.referenceIndex !== 'number') {
      return {
        status: 'answer',
        source: 'random',
        answer: randomAnswer(domain),
        fallbackCode: 'invalid_response',
        latencyMs,
      };
    }
    const { queryIndex, referenceIndex } = pred;
    if (queryIndex < 0 || queryIndex >= domain.queryCount) {
      return {
        status: 'answer',
        source: 'random',
        answer: randomAnswer(domain),
        fallbackCode: 'query_index_out_of_range',
        latencyMs,
      };
    }
    if (seenQueries.has(queryIndex)) {
      return {
        status: 'answer',
        source: 'random',
        answer: randomAnswer(domain),
        fallbackCode: 'duplicate_query_index',
        latencyMs,
      };
    }
    seenQueries.add(queryIndex);

    const validValues = domain.validValuesByQuery[queryIndex]!;
    if (referenceIndex < 0 || referenceIndex >= validValues.length) {
      return {
        status: 'answer',
        source: 'random',
        answer: randomAnswer(domain),
        fallbackCode: 'reference_index_out_of_range',
        latencyMs,
      };
    }

    // Map referenceIndex to TX43 wire byte
    const wireByte = REFERENCE_TO_TX43_BYTE[referenceIndex]!;
    answersByQuery[queryIndex] = wireByte;
  }

  if (seenQueries.size !== domain.queryCount) {
    return {
      status: 'answer',
      source: 'random',
      answer: randomAnswer(domain),
      fallbackCode: 'incomplete_predictions',
      latencyMs,
    };
  }

  return {
    status: 'answer',
    source: 'ml',
    answer: Object.freeze(answersByQuery),
    modelId,
    latencyMs,
  };
}
