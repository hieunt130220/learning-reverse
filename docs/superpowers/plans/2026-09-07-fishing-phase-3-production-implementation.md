# Fishing Phase 3 Production Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement safe, fail-closed Phase 3 automated fishing decision making and TX43 transmission using the frozen Phase 2 ML matcher and verified protocol mapping.

**Architecture:** Integrate the verified `REFERENCE_TO_TX43_BYTE` mapping and frozen ML inference client into a new `autoDecision` module with cryptographic fallback. Wire RX79 challenge reception through `GameClient` and drive execution from `AvatarSession` behind the fail-closed `FISHING_AUTO_TX43_ENABLED === 'true'` environment gate with strict generation and connection race guards.

**Tech Stack:** TypeScript 5.7, Node.js 22 (ESM), `node:crypto.randomInt`, `GameClient`, `AvatarSession`, GitNexus MCP.

**Spec:** `docs/superpowers/specs/2026-09-07-fishing-phase-3-production-automation-design.md`

## Global Constraints

- Implement production code before creating or modifying any Phase 3 test.
- Strictly NO Test-Driven Development; repository instructions explicitly prohibit test-first development.
- Use only the frozen Phase 2 candidate checkpoint (`6168b65a...`).
- Do not retrain, reselect, recalibrate, or alter Phase 2 model/weights/config.
- A complete valid ML inference result always uses each query's top-1 `referenceIndex`.
- Ignore `accepted`, similarity, margin, confidence, or abstention when selecting production answers.
- Attempt inference once per admitted challenge; never retry.
- Production inference must not use, consult, or mutate shadow circuit breaker or backlog counters.
- Every inference failure produces cryptographic fallback only after a complete valid answer domain is established.
- Use `node:crypto.randomInt`; never use `Math.random()` for fishing answers.
- Only exact `process.env.FISHING_AUTO_TX43_ENABLED === 'true'` authorizes automated TX43.
- Read the environment gate immediately before every send; do not cache it.
- No send may occur after Stop, disconnect, teardown, client replacement, stale challenge generation, duplicate consumption, or indeterminate answer domain.
- Mark a challenge consumed before calling the synchronous TX43 send.
- Never retry TX43.
- Only `ParkService.doFinishFishing()` may construct automated TX43.
- Do not persist or emit images, raw packets, answer vectors, predictions, identifiers, endpoints, or tokens.
- Run GitNexus upstream impact analysis before modifying any existing symbol.
- Run GitNexus `detect_changes({scope: "all"})` before every commit.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `avatar-web/server/src/fishing/autoDecision.ts` | Create | Domain validation, `REFERENCE_TO_TX43_BYTE` mapping, ML prediction parsing, cryptographic random fallback, decision contracts. |
| `avatar-web/server/src/fishing/productionInference.ts` | Create | Production inference client calling frozen Python service without circuit breaker, validating HTTP/JSON response. |
| `avatar-web/server/src/game/parkService.ts` | Modify | Add `CMD_AVATAR_CAU_THANH_CONG = 43` and `doFinishFishing(answer: readonly number[])`. |
| `avatar-web/server/src/game/client.ts` | Modify | Add `finishFishing()` delegation, hook RX79 in `onMessage`, emit `fishing-challenge`. |
| `avatar-web/server/src/session/avatarSession.ts` | Modify | Wire `fishing-challenge` listener, lifecycle guards, kill-switch check, critical section, challenge consumption. |

---

### Task 1: Create `autoDecision.ts` Decision Module

**Files:**
- Create: `avatar-web/server/src/fishing/autoDecision.ts`

**Interfaces:**
- Consumes: `CanCauPayload` from `../game/fishingDecode.js`.
- Produces: `REFERENCE_TO_TX43_BYTE`, `FishingAnswerDomain`, `AutoDecisionResult`, `AutoDecisionFailureCode`, `buildAnswerDomain()`, `randomAnswer()`, `makeAutoDecision()`.

- [x] **Step 1: Write `autoDecision.ts`**

Create `avatar-web/server/src/fishing/autoDecision.ts`:

```ts
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
```

- [x] **Step 2: Typecheck**

Run:
```bash
cd /Users/devios/learning-reverse/avatar-web/server && npm run typecheck
```
Expected: PASS with 0 errors.

- [x] **Step 3: Commit Task 1**

```bash
git add avatar-web/server/src/fishing/autoDecision.ts
git commit -m "feat(fishing): implement autoDecision module for Phase 3

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: Create `productionInference.ts` Client

**Files:**
- Create: `avatar-web/server/src/fishing/productionInference.ts`

**Interfaces:**
- Consumes: `CanCauPayload`, `InferenceResult` from `./autoDecision.js`.
- Produces: `ProductionInferenceClient`, `createProductionInference()`.

- [x] **Step 1: Write `productionInference.ts`**

Create `avatar-web/server/src/fishing/productionInference.ts`:

```ts
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
```

- [x] **Step 2: Typecheck**

Run:
```bash
cd /Users/devios/learning-reverse/avatar-web/server && npm run typecheck
```
Expected: PASS with 0 errors.

- [x] **Step 3: Commit Task 2**

```bash
git add avatar-web/server/src/fishing/productionInference.ts
git commit -m "feat(fishing): implement ProductionInferenceClient for Phase 3

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: Add `doFinishFishing` to `ParkService`

**Files:**
- Modify: `avatar-web/server/src/game/parkService.ts`

**Interfaces:**
- Consumes: `Session`, `Message`, answer array `readonly number[]`.
- Produces: `CMD_AVATAR_CAU_THANH_CONG = 43`, `ParkService.doFinishFishing(answer: readonly number[])`.

- [x] **Step 1: Check impact before editing `ParkService`**

```text
mcp__gitnexus__impact({target: "ParkService", direction: "upstream"})
```

- [x] **Step 2: Add `doFinishFishing` implementation**

In `avatar-web/server/src/game/parkService.ts`:
Define:
```ts
export const CMD_AVATAR_CAU_THANH_CONG = 43;
```
Inside `ParkService` class:
```ts
  /**
   * CAU_THANH_CONG (TX43): bool isF=true, i8 len, len × i8 answers.
   * Throws if answer is empty, length > 255, or any value is not integer in [0, 255].
   */
  doFinishFishing(answer: readonly number[]): void {
    if (!Array.isArray(answer) || answer.length === 0) {
      throw new Error('TX43: answer must be a non-empty array');
    }
    if (answer.length > 255) {
      throw new Error(`TX43: answer length ${answer.length} exceeds 255`);
    }
    for (let i = 0; i < answer.length; i++) {
      const b = answer[i];
      if (!Number.isSafeInteger(b) || b < 0 || b > 255) {
        throw new Error(`TX43: invalid answer byte at index ${i}: ${b}`);
      }
    }
    const m = Message.create(CMD_AVATAR_CAU_THANH_CONG);
    m.writer!.writeBoolean(true).writeByte(answer.length);
    for (let i = 0; i < answer.length; i++) {
      m.writer!.writeByte(answer[i]!);
    }
    this.session.send(m);
  }
```

- [x] **Step 3: Typecheck**

Run:
```bash
cd /Users/devios/learning-reverse/avatar-web/server && npm run typecheck
```
Expected: PASS with 0 errors.

- [x] **Step 4: Commit Task 3**

```bash
git add avatar-web/server/src/game/parkService.ts
git commit -m "feat(fishing): add TX43 doFinishFishing to ParkService

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: Hook RX79 and Add `finishFishing` to `GameClient`

**Files:**
- Modify: `avatar-web/server/src/game/client.ts`

**Interfaces:**
- Consumes: `ParkService.doFinishFishing`, `decodeCanCau`.
- Produces: `GameClient.finishFishing(answer: readonly number[])`, event `fishing-challenge` emitting `CanCauPayload`.

- [x] **Step 1: Check impact before editing `GameClient`**

```text
mcp__gitnexus__impact({target: "GameClient", direction: "upstream"})
```

- [x] **Step 2: Add `finishFishing` and RX79 handling**

In `avatar-web/server/src/game/client.ts`:
Import `decodeCanCau`:
```ts
import { decodeCanCau } from './fishingDecode.js';
```
Add method:
```ts
  finishFishing(answer: readonly number[]): void {
    this.park.doFinishFishing(answer);
  }
```
In `onMessage(msg: Message)` add case 79:
```ts
      case 79: {
        // CAN_CAU (RX79) — cá cắn câu + ảnh mini-game
        try {
          const payload = decodeCanCau(msg.getData());
          this.emit('fishing-challenge', payload);
        } catch {
          this.emit('log', 'RX79 CAN_CAU decode thất bại');
        }
        break;
      }
```

- [x] **Step 3: Typecheck**

Run:
```bash
cd /Users/devios/learning-reverse/avatar-web/server && npm run typecheck
```
Expected: PASS with 0 errors.

- [x] **Step 4: Commit Task 4**

```bash
git add avatar-web/server/src/game/client.ts
git commit -m "feat(fishing): wire RX79 and finishFishing in GameClient

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: Integrate Automated Fishing Lifecycle & Guards in `AvatarSession`

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts`

**Interfaces:**
- Consumes: `buildAnswerDomain`, `makeAutoDecision`, `isFishingAutoTx43Enabled`, `ProductionInferenceClient`.
- Produces: Fail-closed automated TX43 transmission with challenge generation, epoch, wanted, and consumption guards.

- [x] **Step 1: Check impact before editing `AvatarSession`**

```text
mcp__gitnexus__impact({target: "AvatarSession", direction: "upstream"})
```

- [x] **Step 2: Implement fishing challenge handling in `AvatarSession`**

Add helper to evaluate environment flag immediately before send:
```ts
export function isFishingAutoTx43Enabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.FISHING_AUTO_TX43_ENABLED === 'true';
}
```

In `AvatarSession`:
- Maintain state:
  ```ts
  private fishingChallengeGeneration = 0;
  private readonly consumedFishingChallenges = new Set<number>();
  private fishingInferenceClient?: ProductionInferenceClient;
  ```
- In `wire(client: GameClient, epoch: number)`:
  ```ts
  client.on('fishing-challenge', (payload: CanCauPayload) => {
    this.handleFishingChallenge(client, epoch, payload);
  });
  ```
- Implement `handleFishingChallenge(client: GameClient, epoch: number, payload: CanCauPayload)`:
  ```ts
  private handleFishingChallenge(
    client: GameClient,
    epoch: number,
    payload: CanCauPayload,
  ): void {
    if (!this.isCurrent(client, epoch) || client.status !== 'online' || !this.wanted) {
      return;
    }

    const domain = buildAnswerDomain(payload);
    if (!domain) {
      this.pushLog('fishing: domain không hợp lệ (suppressed_invalid_domain)');
      return;
    }

    const challengeGen = ++this.fishingChallengeGeneration;
    const autoGen = this.automationGeneration;

    const inferenceClient = this.fishingInferenceClient ??= new ProductionInferenceClient({
      endpoint: process.env.FISHING_INFERENCE_URL || 'http://127.0.0.1:8000/match',
      timeoutMs: Number(process.env.FISHING_INFERENCE_TIMEOUT_MS) || 5000,
    });

    void makeAutoDecision(payload, domain, (p) => inferenceClient.match(p))
      .then((decision) => {
        if (decision.status !== 'answer') {
          this.pushLog('fishing: không xác định được câu trả lời hợp lệ');
          return;
        }

        // Critical Pre-Send Gate (Strictly Synchronous, No Await)
        if (this.consumedFishingChallenges.has(challengeGen)) return;
        if (this.fishingChallengeGeneration !== challengeGen) return;
        if (this.automationGeneration !== autoGen) return;
        if (this.connectionEpoch !== epoch) return;
        if (this.client !== client) return;
        if (!this.isCurrent(client, epoch)) return;
        if (!this.wanted) return;
        if (client.status !== 'online') return;

        // Verify answer matches domain
        if (
          !Array.isArray(decision.answer)
          || decision.answer.length !== domain.queryCount
          || !decision.answer.every((val, idx) => domain.validValuesByQuery[idx]!.includes(val))
        ) {
          this.pushLog('fishing: answer vi phạm domain');
          return;
        }

        // Fail-closed environment kill switch checked immediately before send
        if (!isFishingAutoTx43Enabled()) {
          this.pushLog('fishing: TX43 bị chặn bởi FISHING_AUTO_TX43_ENABLED !== true');
          return;
        }

        // Mark consumed immediately before synchronous send
        this.consumedFishingChallenges.add(challengeGen);

        try {
          client.finishFishing(decision.answer);
          this.pushLog(`fishing: đã gửi TX43 (${decision.source})`);
        } catch (sendErr) {
          this.pushLog(`fishing: gửi TX43 lỗi: ${(sendErr as Error).message}`);
        }
      })
      .catch((err) => {
        this.pushLog(`fishing: lỗi xử lý challenge: ${(err as Error).message}`);
      });
  }
  ```
- In `stop()` and disconnect teardown:
  ```ts
  this.fishingChallengeGeneration += 1;
  ```

- [x] **Step 3: Typecheck**

Run:
```bash
cd /Users/devios/learning-reverse/avatar-web/server && npm run typecheck
```
Expected: PASS with 0 errors.

- [x] **Step 4: Commit Task 5**

```bash
git add avatar-web/server/src/session/avatarSession.ts
git commit -m "feat(fishing): integrate automated fishing TX43 in AvatarSession

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 6: Final Verification & GitNexus Scope Audit

**Files:**
- None created; repository-wide verification.

- [x] **Step 1: Typecheck the whole server project**

Run:
```bash
cd /Users/devios/learning-reverse/avatar-web/server && npm run typecheck
```
Expected: 0 errors.

- [x] **Step 2: Run GitNexus changes detection**

```text
mcp__gitnexus__detect_changes({
  repo: "learning-reverse",
  scope: "all",
  base_ref: "main"
})
```
Verify only intended symbols and files are modified.

- [x] **Step 3: Refresh GitNexus index**

```bash
npx gitnexus analyze
```
Expected: All nodes and edges updated cleanly.
