# Fishing Phase 3 Production Automation Design

**Status:** Proposed for user review  
**Date:** 2026-09-07  
**Workflow stage:** Spec only  
**Target spec path:** `docs/superpowers/specs/2026-09-07-fishing-phase-3-production-automation-design.md`

## 1. Goals and Context

Phase 2 produced and independently verified a frozen fishing image matcher. The selected candidate is:

```text
runId:
p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01

matrix key:
photometric_plus_geom|off|t0.05|dim_128

checkpoint SHA-256:
6168b65abaf8ade9008c9611413167f76533d1e80926b2be852df6e7e3a67789
```

The selection artifact identifies that candidate and preserves its dataset and configuration provenance in `avatar-web/fishing-ml/artifacts/phase2-selection.json:1-23`. The execution ledger records all 24 CPU candidates, the selected candidate, the successful independent freeze verification, and the fact that final data was not opened in `docs/superpowers/plans/2026-09-04-fishing-phase-2-freeze-execution-results.md:1-6`, `docs/superpowers/plans/2026-09-04-fishing-phase-2-freeze-execution-results.md:29-48`, and `docs/superpowers/plans/2026-09-04-fishing-phase-2-freeze-execution-results.md:50-60`.

The frozen manifest binds the deployed model to its exact checkpoint, supporting files, training revision, and run identity in `avatar-web/fishing-ml/artifacts/p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01/frozen/freeze-manifest.json:1`.

Phase 3 will use that exact frozen Phase 2 candidate to answer live RX79 fishing challenges and send TX43 automatically. The integration must remain small: `AvatarSession` owns lifecycle and race checks, while a new `autoDecision` module owns inference-result interpretation, fallback generation, answer validation, and the TX43 payload contract.

The approved operating policy is:

1. Use the current frozen Phase 2 model without retraining, reselection, recalibration, or threshold changes.
2. Always use the model’s top-1 reference index for every query when the response is complete and valid.
3. Ignore `accepted`, similarity, margin, confidence, and abstention when selecting a production answer.
4. On inference timeout, service failure, malformed/invalid response, incomplete prediction set, model-identity failure, or unavailable checkpoint/service, generate a cryptographically random valid answer.
5. Continue processing future challenges indefinitely after inference failures. There is no inference circuit breaker and no failure-count shutdown.
6. Final evaluation and replay are non-blocking evidence. Their absence, failure, or incompleteness must not disable production automation.
7. Manual Stop and an environment kill switch are the control boundaries.
8. Automated TX43 is fail-closed: only the exact environment string `true` in `FISHING_AUTO_TX43_ENABLED` permits a send.
9. The kill switch is checked immediately before every TX43 send, not merely at startup or challenge receipt.
10. No send, including random fallback, may occur after manual Stop, disconnect, connection/session replacement, stale challenge generation, disabled or indeterminate kill switch, duplicate challenge consumption, or inability to determine the complete valid-answer domain.
11. At most one TX43 may be sent for one challenge.
12. Telemetry must be aggregate and sanitized.

### 1.1 Existing protocol foundation

RX79 contains:

```text
i32 idUser
i16 idFish
i16 timeDelay
i8  referenceCount
referenceCount × { i32 pngLength; pngBytes }
[optional:
  i8 queryCount
  queryCount × { i32 pngLength; pngBytes }
]
```

The production decoder currently exposes this as `CanCauPayload` and decodes the optional `imagesNew` block in `avatar-web/server/src/game/fishingDecode.ts:8-17` and `avatar-web/server/src/game/fishingDecode.ts:50-69`.

TX43 is direction-sensitive. Its outgoing body is:

```text
bool true
i8   answerLength
answerLength × i8 answerValue
```

The reverse-engineering record confirms that TX43 is built by `ParkService.doFinishFishing`, that the boolean is always true at the native call site, and that the array represents the mini-game input sequence in `avatar-re/notes/fishing.md:37-54`. The same opcode has a different incoming layout, `i32 idUser + i16 idFish`, as documented in `avatar-re/notes/fishing.md:56-67`. The end-to-end native exchange is documented in `avatar-re/notes/fishing.md:87-99`.

The TypeScript receive decoder already preserves that direction distinction for RX43 and RX79 in `avatar-web/server/src/game/fishingDecode.ts:271-293`.

## 2. Scope

### 2.1 In scope

1. Add a small production `autoDecision` module.
2. Return complete prediction rows from the Node inference client rather than only prediction counts.
3. Add a TX43 encoder method to `ParkService`, surfaced through `GameClient`.
4. Decode RX79 in the live `GameClient` message flow and emit a typed fishing challenge event.
5. Integrate fishing challenge handling into `AvatarSession`.
6. Assign a session-local monotonically increasing challenge generation to every accepted RX79.
7. Enforce at-most-once TX43 per challenge.
8. Use ML top-1 reference indices without consulting confidence or `accepted`.
9. Use cryptographically secure random selection for every answer position when inference cannot supply a complete valid answer.
10. Continue after every inference failure without opening a circuit, suppressing future inference, or stopping the session.
11. Recheck all lifecycle predicates and the exact-string environment gate immediately before sending.
12. Invalidate pending work on Stop, disconnect, teardown, connection replacement, and newer challenge receipt.
13. Emit sanitized aggregate telemetry for decisions and suppression outcomes.
14. Add automated verification only after production code is complete.
15. Run manual production-path verification only after production code and automated verification are complete.

### 2.2 Out of scope

1. Retraining or fine-tuning the frozen candidate.
2. Changing Phase 2 data, split, augmentation, architecture, checkpoint, thresholds, or selection policy.
3. Selecting a different Phase 2 run.
4. Treating `accepted=false`, low similarity, or low margin as a fallback condition.
5. Blocking production on Phase 2 final evaluation.
6. Blocking production on replay reports or replay gate policy.
7. Adding a confidence threshold, abstention policy, minimum accepted rate, or quality circuit breaker.
8. Retrying inference for the same challenge.
9. Retrying TX43 for the same challenge.
10. Sending TX43 after a send throws; the challenge remains consumed.
11. Queuing a stale answer for a later reconnect.
12. Persisting challenge images, raw packets, answer vectors, per-query predictions, account IDs, credentials, or cookies.
13. Adding a fishing UI, database-backed fishing configuration, or a new automation mode.
14. Automatically starting, casting, closing the fishing screen, moving to a fishing map, or sending TX41/TX44/TX45.
15. Reusing `Math.random()` for the production fallback.
16. Reusing the Phase 2 shadow circuit breaker in the production decision path.
17. Using the generic `sendRaw` endpoint for automated TX43.
18. Writing tests before production code.

### 2.3 Inputs

A processable challenge consists of:

- the current `GameClient`;
- the current `AvatarSession.connectionEpoch`;
- the current `AvatarSession.automationGeneration`;
- a new session-local `challengeGeneration`;
- a successfully decoded RX79 `CanCauPayload`;
- at least one reference image;
- at least one query image;
- a determinable valid answer domain;
- a still-online current session;
- exact environment value `FISHING_AUTO_TX43_ENABLED === 'true'` at send time.

### 2.4 Outputs

For each processable challenge, exactly one terminal outcome is recorded:

- `sent_ml`;
- `sent_random`;
- `suppressed_stopped`;
- `suppressed_disconnected`;
- `suppressed_stale_session`;
- `suppressed_stale_challenge`;
- `suppressed_disabled`;
- `suppressed_invalid_domain`;
- `suppressed_duplicate`;
- `send_failed`.

Only `sent_ml` and `sent_random` transmit TX43.

## 3. Existing Architecture and Constraints

### 3.1 `AvatarSession` is the lifecycle authority

`AvatarSession` already separates desired connection state from actual client state and describes that separation as the basis for continuous server-side operation in `avatar-web/server/src/session/avatarSession.ts:176-182`.

Relevant existing state includes:

- `wanted`;
- `connectionEpoch`;
- `automationGeneration`;
- the active `GameClient`;
- log and traffic buffers.

These fields are defined in `avatar-web/server/src/session/avatarSession.ts:183-227`.

`stop()` sets `wanted=false`, cancels pending timers, tears down the client, and publishes idle state in `avatar-web/server/src/session/avatarSession.ts:317-344`.

`connect()` creates one new client for a new epoch, binds it to the session, and wires listeners only while generation, desired state, and client identity remain current in `avatar-web/server/src/session/avatarSession.ts:699-755`.

`isCurrent(client, epoch)` already defines the correct connection ownership predicate in `avatar-web/server/src/session/avatarSession.ts:758-760`.

The message and status listeners already reject stale clients before acting in `avatar-web/server/src/session/avatarSession.ts:762-787`.

On disconnect, the session stops active automation components and only schedules reconnect when the epoch and desired state remain current in `avatar-web/server/src/session/avatarSession.ts:1496-1525`.

Hard teardown invalidates asynchronous automation continuations, increments `connectionEpoch`, clears the active client reference, removes listeners, and logs out the old client in `avatar-web/server/src/session/avatarSession.ts:1560-1582`.

Phase 3 must reuse these predicates rather than create an independent lifecycle model.

### 3.2 Current `GameClient` event ordering

`GameClient.onMessage` records received traffic, dispatches command-specific behavior, and then emits the generic `message` event in `avatar-web/server/src/game/client.ts:838-841` and `avatar-web/server/src/game/client.ts:1448-1452`.

RX79 currently has no command-specific production branch. Phase 3 will add one before the final generic `message` emission.

### 3.3 Existing inference service

The Python service:

- loads exactly one verified frozen candidate;
- rejects missing, tampered, or revision-mismatched artifacts during startup;
- keeps images only in request memory;
- does not import game or opcode code;
- does not log image or identity data.

These boundaries are explicit in `avatar-web/fishing-ml/src/fishing_ml/inference_service.py:1-22`.

`load_frozen_matcher()` verifies the frozen directory, checks its Git revision, reconciles model identity, and returns the single loaded matcher in `avatar-web/fishing-ml/src/fishing_ml/inference_service.py:240-291`.

Inference calculates cosine similarity and selects one top-1 reference index for every query. It then calculates thresholds only to populate the `accepted` field in `avatar-web/fishing-ml/src/fishing_ml/inference_service.py:405-459`. Phase 3 consumes `referenceIndex` from every row and intentionally ignores `accepted`, `similarity`, and `margin`.

The HTTP service bounds one inference worker, enforces an absolute deadline, and returns sanitized failures in `avatar-web/fishing-ml/src/fishing_ml/inference_service.py:473-544` and `avatar-web/fishing-ml/src/fishing_ml/inference_service.py:759-810`.

### 3.4 Existing Node inference client

The Node request contract accepts only `images` and `imagesNew` in `avatar-web/server/src/fishing/inferenceClient.ts:3-15`.

It already:

- validates image counts;
- validates 75×75 PNG structure;
- limits decoded and serialized body sizes;
- validates exact response and prediction schemas;
- rejects duplicate or out-of-range query/reference indices;
- enforces a request deadline;
- pins model identity after the first successful response.

These checks are implemented in `avatar-web/server/src/fishing/inferenceClient.ts:43-57`, `avatar-web/server/src/fishing/inferenceClient.ts:106-168`, `avatar-web/server/src/fishing/inferenceClient.ts:254-317`, and `avatar-web/server/src/fishing/inferenceClient.ts:445-509`.

Its current public result discards individual predictions and exposes only counts in `avatar-web/server/src/fishing/inferenceClient.ts:8-15` and `avatar-web/server/src/fishing/inferenceClient.ts:492-498`. Phase 3 must preserve validated predictions in the successful result.

The existing `match()` method contains a circuit breaker and backlog rejection in `avatar-web/server/src/fishing/inferenceClient.ts:349-443`. That behavior is suitable for optional shadow observation but conflicts with the approved production policy. Production decision inference must use a no-breaker execution path.

## 4. Selected Design

### 4.1 Chosen integration

Use a direct, session-owned challenge pipeline:

```text
GameClient receives RX79
        |
        v
decodeCanCau(body)
        |
        v
emit typed fishing-challenge event
        |
        v
AvatarSession captures:
client + connectionEpoch + automationGeneration + challengeGeneration
        |
        v
autoDecision.decide(payload)
        |
        +---- valid complete inference ----> ML top-1 answer
        |
        +---- any other inference outcome -> crypto-random answer
        |
        v
AvatarSession final send gate
        |
        +---- stale/stopped/offline/disabled/invalid/consumed -> suppress
        |
        v
GameClient.finishFishing(answer)
        |
        v
ParkService.doFinishFishing(true, answer) -> TX43
```

This design is selected because it:

- adds no new orchestration service;
- uses `AvatarSession`’s existing epoch and generation semantics;
- isolates policy from wire encoding;
- keeps TX43 unavailable through generic raw-send code;
- supports deterministic verification through dependency injection;
- permits random fallback without weakening lifecycle safety;
- leaves offline final and replay tooling independent of gameplay availability.

### 4.2 Alternatives rejected

#### A. Put inference and fallback inside `GameClient`

Rejected because `GameClient` should remain responsible for protocol and transport. It does not own manual Stop, session generation, or replacement-client semantics. An inference continuation inside `GameClient` could survive beyond the `AvatarSession` that authorized it.

#### B. Create a full `FishingAutomation` runner

Rejected as unnecessary for this phase. Phase 3 only reacts to RX79 and sends one TX43. It does not own navigation, casting, repetition, persistence, or UI state. A full runner would duplicate lifecycle machinery already present in `AvatarSession`.

#### C. Reuse `maybeShadowMatch()`

Rejected because it is fire-and-forget, intentionally discards predictions, uses sampling, and is explicitly read-only. Its behavior is documented in `avatar-web/server/src/fishing/shadowMatcher.ts:23-51` and `avatar-web/server/src/fishing/shadowMatcher.ts:70-79`.

## 5. Components and Files

### 5.1 New production module

#### `avatar-web/server/src/fishing/autoDecision.ts`

Responsibilities:

1. Validate that the challenge has a complete, determinate answer domain.
2. Call the no-breaker inference operation once.
3. Convert a complete valid inference response into the ordered ML top-1 answer.
4. Ignore `accepted`, similarity, and margin.
5. Convert every inference failure category into a cryptographically random answer.
6. Return a typed decision; never send packets.
7. Never log or persist images or prediction vectors.
8. Never maintain failure counters or breaker state.

This is the only new behavior module.

### 5.2 Modified production modules

#### `avatar-web/server/src/fishing/inferenceClient.ts`

- Export the validated prediction shape.
- Include validated prediction rows in successful results.
- Extract the existing one-request transport into a no-breaker operation callable by `autoDecision`.
- Preserve the current shadow `match()` behavior for existing shadow callers.
- Do not change the Python service contract.
- Do not change request size or response validation rules.

#### `avatar-web/server/src/game/parkService.ts`

- Add the dedicated TX43 encoder.
- Validate the complete answer before constructing the message.
- Serialize `true`, answer count, then answer bytes.
- Do not read environment configuration here; authorization remains in `AvatarSession`.
- Do not expose a retry.

The current service demonstrates the project’s typed message construction pattern in `avatar-web/server/src/game/parkService.ts:36-52`.

#### `avatar-web/server/src/game/client.ts`

- Decode RX79 with `decodeCanCau`.
- Emit a typed `fishing-challenge` event.
- Add `finishFishing(answer)` as the only typed GameClient entry point for TX43.
- Do not run inference or random selection.
- Do not inspect the environment flag.
- Preserve final generic `message` emission.

#### `avatar-web/server/src/session/avatarSession.ts`

- Add session-local challenge generation and consumed-state tracking.
- Subscribe to `fishing-challenge` in `wire(client, epoch)`.
- Capture lifecycle tokens before starting decision work.
- Mark the challenge consumed before attempting TX43.
- Recheck every send predicate immediately before the send call.
- Invalidate pending fishing work during Stop, disconnect, teardown, and challenge replacement.
- Emit sanitized telemetry.

### 5.3 Existing modules retained without production-semantic changes

#### `avatar-web/fishing-ml/src/fishing_ml/inference_service.py`

Remains the model host. The model, thresholds, frozen verification, worker bound, request deadline, and sanitized error responses remain unchanged.

#### `avatar-web/server/src/fishing/shadowMatcher.ts`

Remains optional shadow-only plumbing. It must not be used to authorize or send TX43.

Its telemetry allowlist currently excludes model ID, predictions, identity, raw packets, images, and credentials in `avatar-web/server/src/fishing/shadowMatcher.ts:53-68`. Phase 3 telemetry follows the same allowlist style.

#### `avatar-web/server/src/fishing/shadowConfig.ts`

Remains shadow configuration. Its permissive boolean parsing and circuit-breaker settings must not be reused for the production TX43 gate. Existing behavior is in `avatar-web/server/src/fishing/shadowConfig.ts:37-60` and `avatar-web/server/src/fishing/shadowConfig.ts:122-169`.

#### `avatar-web/fishing-ml/src/fishing_ml/replay.py`

Remains non-blocking evidence generation.

#### `avatar-web/fishing-ml/src/fishing_ml/evaluate.py`

Remains non-blocking final evidence generation.

## 6. Interfaces and Data Contracts

### 6.1 Validated inference prediction

```ts
export interface InferencePrediction {
  readonly queryIndex: number;
  readonly referenceIndex: number;
  readonly similarity: number;
  readonly margin: number | null;
  readonly accepted: boolean;
}
```

The Python service already emits these fields from the computed top-1 rows in `avatar-web/fishing-ml/src/fishing_ml/inference_service.py:430-459`.

### 6.2 Successful inference result

```ts
export interface SuccessfulInferenceResult {
  readonly status: 'ok';
  readonly modelId: string;
  readonly predictions: readonly InferencePrediction[];
  readonly predictionCount: number;
  readonly acceptedCount: number;
  readonly latencyMs: number;
}
```

Non-success statuses retain the stable existing shape:

```ts
export interface FailedInferenceResult {
  readonly status: 'disabled' | 'timeout' | 'unavailable' | 'invalid';
  readonly latencyMs?: number;
  readonly errorCode?: string;
}

export type InferenceResult =
  | SuccessfulInferenceResult
  | FailedInferenceResult;
```

### 6.3 Challenge domain

```ts
export interface FishingAnswerDomain {
  readonly queryCount: number;
  readonly validValuesByQuery: readonly (readonly number[])[];
}
```

The production domain is valid only when:

1. `images` is a non-empty array.
2. `imagesNew` is a non-empty array.
3. `queryCount === imagesNew.length`.
4. A complete valid TX43 answer-value set is determinable for every query.
5. Every allowed TX43 value is an integer in `[0, 255]`.
6. Every domain list is non-empty.
7. `queryCount` is in `[1, 255]`.

The Phase 2 matcher returns `referenceIndex`, while the native TX43 field is the mini-game key sequence. Reverse engineering previously recorded observed key values `{50, 52, 54}` in `docs/superpowers/specs/2026-08-26-auto-fishing-design.md:108-121`, which reflected an earlier or alternative input-path hypothesis.

Live protocol verification on 2026-09-07 resolved the mapping definitively (documented in `avatar-re/notes/fishing.md`):

1. **Static analysis (`libil2cpp.so` arm64):**
   - `FishingScr.onCaCanCau` (@0x5DDD68) iterates `arrImg` in wire order, storing each reference image into `listKey` with its 0-based index `i` (@0x5DE4A4: `w2 = w27 = i`).
   - `FishingScr.numKeyPress` (@0x5DBFF0) hit-tests user touches against `listKey` and invokes `setIndex(listKey[index].key, false)` (@0x5DC3DC).
   - `FishingScr.setIndex` (@0x5DBA60) appends to `listKeySend` and rebuilds `arrIndex[j] = (sbyte)listKeySend[j].key` (@0x5DBCB8–0x5DBD00).
   - `ParkService.doFinishFishing` (@0x71BC4C) emits `arrIndex` verbatim as TX43 (`bool isF=true; i8 length; length × i8 answerBytes`).

2. **Dynamic verification (live Frida, 4 atomic challenges):**
   - Four separate challenges (C1: `0,1,2,3,4,5` → `00 01 02 03 04 05`; C2: `0,1,4,3,2,5` → `00 01 04 03 02 05`; C3: `4×7, 3` → `04 04 04 04 04 04 04 03 00`; C4: `3,4,5,4,3,3,3` → `03 04 05 04 03 03 03`).
   - Every supported reference position (0..5) has at least two concordant observations from separate challenges showing that the outgoing TX43 byte equals the 0-based reference index.

Therefore, the production mapping is proven to be the identity: `TX43 byte = referenceIndex`. The immutable mapping in `autoDecision.ts` is defined as:

```ts
export const REFERENCE_TO_TX43_BYTE: readonly number[] = Object.freeze([0, 1, 2, 3, 4, 5]);
```

For any RX79 challenge where all reference positions fall within `[0, REFERENCE_TO_TX43_BYTE.length - 1]`, the valid TX43 answer set for each query is `REFERENCE_TO_TX43_BYTE`. If an RX79 presents a reference count exceeding the verified bounds or with an unmapped reference position, the valid domain remains indeterminate and the terminal outcome must be `suppressed_invalid_domain`. Random fallback is forbidden in that state.

This rule remains part of the send-time safety contract required by the approved “no send when valid answers are indeterminate” decision.

### 6.4 Decision request

```ts
export interface AutoDecisionRequest {
  readonly payload: CanCauPayload;
  readonly domain: FishingAnswerDomain;
}
```

### 6.5 Decision result

```ts
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
```

### 6.6 TX43 encoder

```ts
ParkService.doFinishFishing(answer: readonly number[]): void
```

Contract:

1. Reject an empty answer.
2. Reject length greater than 255.
3. Reject any non-integer.
4. Reject any value outside `[0, 255]`.
5. Create command 43.
6. Write `true`.
7. Write the answer length as one byte.
8. Write every answer value as one byte.
9. Call `session.send()` once.

The project writer masks `writeByte` to one byte and encodes booleans as 0/1 in `avatar-web/server/src/proto/writer.ts:6-20`. Validation must occur before encoding so masking cannot silently convert an invalid value.

### 6.7 Environment gate

```ts
function isFishingAutoTx43Enabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.FISHING_AUTO_TX43_ENABLED === 'true';
}
```

Semantics are intentionally strict:

| Raw value | Send permitted |
|---|---:|
| `true` | yes |
| absent | no |
| empty string | no |
| `TRUE` | no |
| `True` | no |
| `1` | no |
| `yes` | no |
| `on` | no |
| ` true` | no |
| `true ` | no |
| any non-string/indeterminate access result | no |

The value is read immediately before every send. It is not cached at module load, constructor time, connection time, or challenge time.

### 6.8 Cryptographic random selection

Use `randomInt` from `node:crypto`:

```ts
import { randomInt } from 'node:crypto';

function randomAnswer(domain: FishingAnswerDomain): number[] {
  return domain.validValuesByQuery.map(
    (values) => values[randomInt(values.length)]!,
  );
}
```

Requirements:

- one independent draw per query;
- uniform selection over that query’s proven valid values;
- no `Math.random()`;
- no seeded pseudo-random fallback;
- no modulo reduction of raw random bytes;
- any randomness API failure returns an indeterminate decision and does not send.

The existing `AvatarSession.random` injection is used for reconnect jitter and defaults to `Math.random()` in `avatar-web/server/src/session/avatarSession.ts:229-239`; it must not be reused for fishing answers.

## 7. Detailed Processing Flow

### 7.1 RX79 receipt

When `GameClient.onMessage` receives command 79:

1. Read the original body with `msg.getData()`.
2. Call `decodeCanCau(body)`.
3. If decoding throws, emit only a sanitized fishing error code and do not emit a challenge.
4. If decoding succeeds, emit:

```ts
client.emit('fishing-challenge', payload);
```

5. Continue to the existing generic `message` event.

No image saving occurs. The existing save utilities are explicitly dataset/probe functions and must not be called by production automation; their current behavior is in `avatar-web/server/src/game/fishingDecode.ts:71-105` and `avatar-web/server/src/game/fishingDecode.ts:162-269`.

### 7.2 Challenge admission in `AvatarSession`

The `fishing-challenge` listener first checks synchronously:

```text
isCurrent(client, epoch)
client.status === online
wanted === true
payload is structurally processable
```

If any check fails, no asynchronous decision begins.

For an admitted challenge:

1. Increment `fishingChallengeGeneration`.
2. Record the new generation as the current challenge.
3. Clear the consumed marker for the new generation.
4. Capture:

```text
client reference
connectionEpoch
automationGeneration
challengeGeneration
```

5. Start exactly one `autoDecision.decide()` promise.
6. Do not await it in the EventEmitter callback.
7. Attach a terminal catch that converts unexpected exceptions into a sanitized suppressed outcome.

A newer RX79 invalidates the earlier challenge by incrementing `fishingChallengeGeneration`. The older inference may finish, but it becomes unable to send.

### 7.3 ML answer path

`autoDecision`:

1. Builds the complete answer domain.
2. If the domain is indeterminate, returns `indeterminate`.
3. Calls the no-breaker inference operation exactly once.
4. Requires:
   - `status === 'ok'`;
   - exactly one prediction per query;
   - every query index from `0` through `queryCount - 1` exactly once;
   - every `referenceIndex` within the reference array;
   - every predicted reference index to map to one proven TX43 value in that query’s domain.
5. Sorts predictions by `queryIndex`.
6. Converts each `referenceIndex` to its TX43 answer value.
7. Does not read `accepted`.
8. Does not compare similarity or margin.
9. Returns `source: 'ml'`.

The Node response validator already rejects duplicate and out-of-range indices in `avatar-web/server/src/fishing/inferenceClient.ts:275-308`. `autoDecision` still verifies completeness because the current response contract permits an empty or partial prediction array.

### 7.4 Random fallback path

The following all invoke cryptographic fallback when, and only when, the complete valid answer domain was already established:

- checkpoint unavailable;
- Python service unavailable;
- connection failure;
- HTTP non-200 response;
- inference busy;
- inference timeout;
- malformed JSON;
- oversized response;
- unsupported or invalid schema;
- invalid model ID;
- model identity mismatch;
- incomplete predictions;
- response prediction invalid for the current challenge;
- unexpected decision-layer exception.

Fallback behavior:

1. Do not retry inference.
2. Do not increment a persistent failure counter.
3. Do not open or consult a circuit breaker.
4. Generate a complete random answer.
5. Return `source: 'random'` with one stable fallback code.
6. Proceed to the same final send gate as an ML answer.
7. Process the next challenge normally regardless of prior failures.

The random fallback is a decision fallback, not a send fallback. If the final send gate fails, the answer is discarded. It must not be regenerated or sent later.

### 7.5 Immediate pre-send gate

After `autoDecision` resolves, `AvatarSession` performs one synchronous, non-awaiting critical section. All conditions must pass in this order:

1. The result contains a complete answer.
2. The challenge has not already been consumed.
3. Captured `challengeGeneration` equals current `fishingChallengeGeneration`.
4. Captured `automationGeneration` equals current `automationGeneration`.
5. Captured `connectionEpoch` equals current `connectionEpoch`.
6. `this.client === capturedClient`.
7. `isCurrent(capturedClient, capturedEpoch)` is true.
8. `wanted === true`.
9. `capturedClient.status === 'online'`.
10. The complete answer is still valid under the captured domain.
11. `process.env.FISHING_AUTO_TX43_ENABLED === 'true'`.

No asynchronous operation may occur between condition 11 and marking the challenge consumed.

After all checks pass:

1. Mark the challenge consumed.
2. Call `capturedClient.finishFishing(answer)` synchronously.
3. Record `sent_ml` or `sent_random` if the call returns.
4. If the send call throws, record `send_failed`.
5. Do not unconsume or retry.

Marking consumption before the send prevents a synchronous reentrant RX or duplicate completion from sending the same challenge twice.

### 7.6 Manual Stop

`AvatarSession.stop()` must invalidate fishing work before or as part of teardown:

1. Increment `fishingChallengeGeneration`.
2. Clear the current challenge reference.
3. Leave old challenges consumed or unreachable.
4. Continue existing `wanted=false` and teardown behavior.

Because `stop()` currently sets `wanted=false` and tears down the active client in `avatar-web/server/src/session/avatarSession.ts:334-344`, any pending inference continuation will fail both the wanted and epoch/client checks.

There is no random fallback or delayed send after Stop.

### 7.7 Disconnect and reconnect

When status becomes `idle` or `error`:

1. Invalidate the current fishing challenge immediately.
2. Do not wait for inference completion.
3. Do not send a random fallback.
4. Let existing reconnect behavior proceed independently.

A reconnect creates a new `connectionEpoch` and `GameClient`. No pending answer from the old connection can migrate to the new one.

The current disconnect and teardown paths already stop automation and replace epoch/client ownership in `avatar-web/server/src/session/avatarSession.ts:1496-1525` and `avatar-web/server/src/session/avatarSession.ts:1560-1582`.

### 7.8 Kill-switch changes during inference

If the flag is `true` when RX79 arrives but becomes anything else before inference returns, no TX43 is sent.

If the flag is disabled when RX79 arrives, the implementation may skip inference as an optimization, but the challenge must still be assigned and terminated as `suppressed_disabled`. It must not be retained in case the flag becomes enabled later.

If the flag becomes `true` only after the challenge has already been suppressed, the old challenge stays suppressed. Enabling affects future, currently live challenges only.

## 8. Concurrency and Race Handling

### 8.1 One challenge, one decision

Each admitted RX79 starts at most one inference request. No retry, hedge, or duplicate fallback task is created.

### 8.2 One challenge, at most one TX43

The consumed bit is keyed by `challengeGeneration`, not by `idFish`, image hash, time, or payload equality. Packet fields may repeat legitimately across later challenges.

State transition:

```text
received
   |
   v
deciding
   |
   +---- invalidated --------------------> suppressed
   |
   +---- decision result
             |
             v
      final gate + consume
             |
       +-----+------+
       |            |
       v            v
     sent       suppressed/send_failed
```

There is no transition back from any terminal state.

### 8.3 Overlapping challenges

If challenge N+1 arrives while N is awaiting inference:

- N+1 becomes current.
- N continues only as an inert promise.
- N cannot send ML or random output.
- N+1 is processed normally.
- The bounded Python worker may report busy for N+1; that is an inference failure and therefore produces random fallback for N+1, subject to the final send gate.

This preserves “continue indefinitely” without allowing stale sends.

### 8.4 Stop during inference

Stop increments lifecycle/challenge state synchronously. When inference resolves, final checks suppress the result. No fallback occurs after Stop because fallback generation does not authorize sending and final authorization has been revoked.

### 8.5 Disconnect during inference

Status/epoch/client checks suppress the result. A reconnect cannot revive it.

### 8.6 Kill-switch flip immediately before send

JavaScript runs the final predicate checks, consumed assignment, and synchronous `finishFishing()` call in one event-loop turn with no `await`. This is the narrowest enforceable application-level boundary.

The flag must be the last external authorization check. No logging, telemetry, promise creation, random generation, or other user code may run between the flag check and consumption/send.

### 8.7 Send throws

Once the challenge is marked consumed, a thrown transport error produces `send_failed`. It does not cause:

- a second TX43;
- random fallback;
- inference retry;
- scheduling after reconnect.

### 8.8 Stale listener or replaced client

Every fishing listener is guarded by `isCurrent(client, epoch)`, matching existing event listeners in `avatar-web/server/src/session/avatarSession.ts:762-787`. Teardown also removes all listeners from the old client in `avatar-web/server/src/session/avatarSession.ts:1571-1581`.

### 8.9 Model service restart

A service restart or temporary outage yields a typed inference failure. The current challenge uses random fallback if its valid domain is known. Later challenges attempt inference again because production inference has no breaker.

### 8.10 Checkpoint unavailable at service startup

The Python service intentionally fails startup if the frozen directory is absent, tampered, revision-mismatched, or missing model identity in `avatar-web/fishing-ml/src/fishing_ml/inference_service.py:240-291`.

Node therefore observes the service as unavailable and produces a random answer for each valid live challenge. The session does not stop and does not open a breaker.

## 9. Error Model

### 9.1 Decision errors that permit random fallback

These errors permit random fallback only after the valid-answer domain is established:

| Category | Stable code |
|---|---|
| Inference disabled/unconfigured | `disabled` |
| Deadline exceeded | `timeout` |
| Connection or HTTP failure | `unavailable` |
| Malformed or invalid response | `invalid_response` |
| Missing query predictions | `incomplete_predictions` |
| Duplicate query index | `duplicate_query_index` |
| Query index invalid | `query_index_out_of_range` |
| Reference index invalid | `reference_index_out_of_range` |
| Frozen identity changed | `model_identity_mismatch` |
| Service cannot load checkpoint | `checkpoint_unavailable` |
| Unclassified internal failure | `unexpected_error` |

No one of these changes the handling of the next challenge.

### 9.2 Errors that forbid both ML and random send

| Condition | Outcome |
|---|---|
| Reference list absent or empty | `suppressed_invalid_domain` |
| Query list absent or empty | `suppressed_invalid_domain` |
| Answer length cannot fit one byte | `suppressed_invalid_domain` |
| Complete reference-to-wire mapping unavailable | `suppressed_invalid_domain` |
| Any query has no proven valid TX43 values | `suppressed_invalid_domain` |
| Cryptographic RNG throws | `suppressed_invalid_domain` |
| Manual Stop | `suppressed_stopped` |
| Offline/disconnected client | `suppressed_disconnected` |
| Replaced client or epoch | `suppressed_stale_session` |
| Newer RX79 superseded the challenge | `suppressed_stale_challenge` |
| Flag not exact `true` | `suppressed_disabled` |
| Challenge already consumed | `suppressed_duplicate` |

### 9.3 No circuit breaker

Production code must not contain:

- consecutive inference failure state;
- breaker generation;
- open-until timestamps;
- half-open probes;
- max-failure shutdown;
- “disable after N errors” behavior;
- cooldown before trying ML again.

The existing shadow breaker at `avatar-web/server/src/fishing/inferenceClient.ts:349-443` stays limited to shadow behavior.

### 9.4 Final and replay failures

Final and replay failures:

- may be logged in offline evidence;
- may inform later operator review;
- must not mutate `FISHING_AUTO_TX43_ENABLED`;
- must not stop `AvatarSession`;
- must not change ML-vs-random selection;
- must not suppress TX43.

## 10. Security and Privacy

### 10.1 Authorization

`FISHING_AUTO_TX43_ENABLED` is the only environment authorization for automated TX43. Exact-string comparison prevents permissive parsing mistakes.

Manual Stop is authoritative regardless of the environment value.

### 10.2 Protocol safety

A dedicated encoder prevents automated code from composing TX43 through the generic `sendRaw` interface. The encoder validates before `writeByte` masks values.

The direction-specific TX43 body must follow the verified outgoing contract in `avatar-re/notes/fishing.md:37-54`, not the RX43 decoder at `avatar-web/server/src/game/fishingDecode.ts:288-289`.

### 10.3 Randomness

Only `node:crypto.randomInt` is allowed. The fallback must remain unpredictable and unbiased over the proven valid domain.

The dataset helper’s `randomHex6()` uses `Math.random()` in `avatar-web/server/src/game/fishingDecode.ts:154-160`; it is not suitable and must not be imported or copied into production decision logic.

### 10.4 Telemetry allowlist

One terminal telemetry record may contain only:

```ts
interface FishingAutoTelemetry {
  readonly event: 'fishing_auto_decision';
  readonly outcome:
    | 'sent_ml'
    | 'sent_random'
    | 'suppressed_stopped'
    | 'suppressed_disconnected'
    | 'suppressed_stale_session'
    | 'suppressed_stale_challenge'
    | 'suppressed_disabled'
    | 'suppressed_invalid_domain'
    | 'suppressed_duplicate'
    | 'send_failed';
  readonly fallbackCode?: AutoDecisionFailureCode;
  readonly referenceCount: number;
  readonly queryCount: number;
  readonly latencyBucket?: '<=50' | '51-100' | '101-250' | '251-500' | '>500';
}
```

The record must not contain:

- account ID;
- player ID or `idUser`;
- `idFish`;
- map or area;
- raw latency with high-resolution correlation value;
- model ID or run ID;
- image bytes;
- base64;
- image checksum;
- raw packet or packet hex;
- predicted indices;
- sent answer bytes;
- similarity;
- margin;
- accepted flags;
- hostname or inference endpoint;
- credentials, tokens, cookies, or environment values;
- stack traces or arbitrary exception messages.

Use stable error codes, never `error.message`, for decision telemetry.

The existing shadow telemetry follows a comparable explicit allowlist in `avatar-web/server/src/fishing/shadowMatcher.ts:53-68`.

### 10.5 In-memory handling

Challenge images and predictions exist only until the decision promise becomes unreachable. Phase 3 does not save them to disk or attach them to session snapshots, WebSocket events, traffic metadata, or exception text.

### 10.6 Denial-of-service bounds

Existing request limits remain active:

- maximum 64 images per list;
- aggregate PNG byte limit;
- canonical request size limit;
- bounded response size;
- deadline;
- exact response schema.

These limits are defined in `avatar-web/server/src/fishing/inferenceClient.ts:43-49` and enforced in `avatar-web/server/src/fishing/inferenceClient.ts:106-168` and `avatar-web/server/src/fishing/inferenceClient.ts:195-244`.

An invalid local payload does not call inference. It may use random fallback only if the valid answer domain remains independently determinate; otherwise it is suppressed.

## 11. Final and Replay as Non-Blocking Evidence

### 11.1 Final evaluation

The final evaluator requires the exact run ID, prevents replacement of a prior result, verifies the frozen artifact, and uses a one-shot lock in `avatar-web/fishing-ml/src/fishing_ml/evaluate.py:109-188`.

This remains valuable evidence, but it is not a production authorization dependency.

Production startup and the TX43 send gate must not read:

- `final-evaluation.json`;
- `final-evaluation.lock`;
- a final gate report;
- final `passed`;
- final accuracy;
- final wrong-count metrics.

### 11.2 Replay

Replay validates existing batches and prints aggregate, sanitized evidence without writing images, requests, labels, or model artifacts in `avatar-web/fishing-ml/src/fishing_ml/replay.py:1-6`.

Its `ReplayReport` records aggregate counts, latency percentiles, model identity sets, and labeled quality metrics in `avatar-web/fishing-ml/src/fishing_ml/replay.py:97-184`. Replay isolates failures per batch and does not invent checkpoint identity in `avatar-web/fishing-ml/src/fishing_ml/replay.py:722-779`.

Replay remains operational evidence only. Production must not import `replay.py`, parse replay output, or require a replay gate pass.

### 11.3 Gate policy

The existing Phase 2 gate model distinguishes final and replay and includes quality, coverage, latency, error, and model-identity checks in `avatar-web/fishing-ml/src/fishing_ml/phase2_gate.py:20-62` and `avatar-web/fishing-ml/src/fishing_ml/phase2_gate.py:130-167`.

Phase 3 intentionally does not use that policy as an online circuit, launch dependency, or send predicate.

## 12. Rollout

### 12.1 Default state

Deployment defaults to:

```text
FISHING_AUTO_TX43_ENABLED absent
```

Therefore all automated TX43 sends are disabled after deployment until explicitly enabled.

There is no permissive default and no migration from `FISHING_SHADOW_ENABLED`.

### 12.2 Rollout sequence

1. Deploy production code with `FISHING_AUTO_TX43_ENABLED` absent.
2. Confirm the server starts and ordinary account/session behavior is unchanged.
3. Start the Python inference service with the verified frozen directory:
   `avatar-web/fishing-ml/artifacts/p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01/frozen`.
4. Confirm the service validates the frozen candidate at startup.
5. Complete protocol verification of the immutable `referenceIndex → TX43 byte` mapping for every reference position that production RX79 can contain.
6. Confirm disabled-mode RX79 produces no TX43.
7. Set `FISHING_AUTO_TX43_ENABLED=true`.
8. Exercise one controlled account/session.
9. Confirm exactly one TX43 per challenge.
10. Confirm ML decisions send even when `accepted=false`.
11. Stop the session while inference is pending and confirm no TX43.
12. Disable the flag while inference is pending and confirm no TX43.
13. Stop the inference service and confirm valid challenges use random fallback without stopping future processing.
14. Expand to additional sessions only after telemetry shows no duplicate sends or lifecycle violations.

### 12.3 Rollback

Immediate rollback is:

```text
unset FISHING_AUTO_TX43_ENABLED
```

or set it to any value other than exact lowercase `true`.

Because the flag is checked immediately before each send, rollback does not require waiting for in-flight inference. A process restart is not required if the process environment is updated through the runtime’s actual environment-management mechanism; if that mechanism cannot mutate `process.env` in the running process, restart with the variable absent.

Manual Stop remains an immediate per-session rollback.

### 12.4 No automatic rollback

Inference error counts, replay failures, final failures, low confidence, low accepted rate, or random-fallback frequency must not automatically disable automation. Operators may manually disable the flag, but production code does not do so.

## 13. Verification Plan

Verification is performed only after all production code is written.

The repository explicitly prohibits test-first development and permits tests only after production code. Phase 3 follows that rule.

### 13.1 Production-code-first order

1. Implement `autoDecision.ts`.
2. Modify the Node inference result contract and add a no-breaker operation.
3. Implement the typed TX43 encoder.
4. Add RX79 event decoding and `GameClient.finishFishing`.
5. Integrate challenge lifecycle handling into `AvatarSession`.
6. Complete production telemetry.
7. Only then add or update automated tests.
8. Then run automated verification.
9. Then run manual production-path verification.

### 13.2 Automated verification after production code

#### `autoDecision` verification

Add `avatar-web/server/src/fishing/autoDecision.test.ts` after production code.

Verify:

1. Complete valid inference uses ordered top-1 outputs.
2. `accepted=false` does not trigger random fallback.
3. Low or negative similarity does not trigger random fallback.
4. Low or null margin does not trigger random fallback.
5. Timeout produces random fallback.
6. Unavailable service produces random fallback.
7. Invalid response produces random fallback.
8. Checkpoint unavailable produces random fallback.
9. Partial prediction set produces random fallback.
10. Crypto RNG is called once per query.
11. Random values always belong to the per-query valid domain.
12. RNG failure returns indeterminate and never an answer.
13. Invalid or incomplete domain returns indeterminate without inference.
14. Repeated failures do not suppress a later inference call.
15. No breaker state exists or affects later decisions.

#### Inference client verification

Extend `avatar-web/server/src/fishing/inferenceClient.test.ts` only after production changes.

The existing tests already verify canonical request construction and size rejection in `avatar-web/server/src/fishing/inferenceClient.test.ts:53-120`.

Add checks that:

1. Successful results expose the exact validated predictions.
2. Prediction order from the service does not bypass completeness handling.
3. No-breaker calls continue reaching `fetch` after repeated failure.
4. Model identity mismatch remains invalid.
5. Timeout remains typed.
6. Response fields stay bounded and exact.
7. The existing shadow breaker still works for shadow callers.

#### Protocol verification

Add or extend the relevant Park/GameClient test after production code.

Verify exact TX43 bytes:

```text
command = 43
body[0] = 1
body[1] = answer.length
body[2...] = answer bytes
```

Verify rejection of:

- empty answer;
- length above 255;
- non-integer values;
- negative values;
- values above 255.

#### `AvatarSession` verification

Extend `avatar-web/server/src/session/avatarSession.test.ts` after production code.

The current harness already models client replacement, Stop, disconnect, and stale callbacks in `avatar-web/server/src/session/avatarSession.test.ts:10-203`. Existing tests verify Stop prevents retry in `avatar-web/server/src/session/avatarSession.test.ts:472-479` and stale client callbacks do not affect a replacement client in `avatar-web/server/src/session/avatarSession.test.ts:416-428`.

Add checks for:

1. Exact `true` permits one TX43.
2. Every other flag spelling suppresses TX43.
3. Flag is read again after inference and immediately before send.
4. Stop during inference suppresses both ML and random output.
5. Disconnect during inference suppresses output.
6. Reconnect creates a new epoch and old output cannot send.
7. A newer RX79 suppresses an older in-flight decision.
8. Duplicate completion for one challenge sends only once.
9. A send throw does not trigger a second send.
10. Inference timeout sends random when all lifecycle checks remain valid.
11. Repeated inference failures continue producing one random decision per new valid challenge.
12. Invalid answer domain sends neither ML nor random.
13. Telemetry contains only allowlisted fields.
14. Telemetry never contains account, fish, images, predictions, answers, endpoint, or raw error text.

### 13.3 Commands after production and tests

From `avatar-web/server`:

```bash
npm test
npm run typecheck
npm run build
```

From `avatar-web/fishing-ml` using the approved Python 3.12 environment:

```bash
python -m pytest
python -m compileall src
```

Run a source scan confirming:

- only the dedicated production encoder creates TX43;
- `autoDecision` imports `node:crypto`;
- `autoDecision` does not call `Math.random`;
- production TX43 authorization uses exact equality;
- no production decision circuit breaker was added;
- final/replay modules are not imported by the live server path;
- no challenge image or answer vector is logged.

### 13.4 Manual verification after automated checks

1. Start the inference service with the exact frozen directory.
2. Start the server with the flag absent.
3. Produce one valid RX79.
4. Observe no TX43 and one sanitized `suppressed_disabled`.
5. Set exact `true` through the deployment environment and restart if required.
6. Produce one valid RX79.
7. Observe one TX43 with the verified body layout.
8. Force an inference response whose rows have `accepted=false`.
9. Observe ML top-1 is still used.
10. Stop the Python service.
11. Produce multiple valid RX79 challenges.
12. Observe one cryptographically generated valid TX43 per challenge and continued operation.
13. Restore inference service.
14. Observe the next challenge attempts ML immediately; there is no breaker cooldown.
15. Delay inference, then invoke manual Stop.
16. Observe no TX43 after the delayed result arrives.
17. Repeat with disconnect, client replacement, newer RX79, and kill-switch disable.
18. Confirm each stale result is suppressed.
19. Inspect logs and emitted events for prohibited data.
20. Optionally run final and replay evidence separately and confirm their result does not alter production behavior.

## 14. Acceptance Criteria

Phase 3 is accepted only when all of the following are true:

1. The deployed model is exactly `p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01`.
2. The checkpoint SHA-256 is verified as `6168b65abaf8ade9008c9611413167f76533d1e80926b2be852df6e7e3a67789`.
3. The service still verifies frozen artifacts and revision at startup.
4. RX79 is decoded into the existing `CanCauPayload`.
5. The complete reference-index-to-TX43 mapping is backed by verified protocol evidence and encoded immutably.
6. If that mapping or any query’s valid domain is indeterminate, no TX43 is sent.
7. A complete valid inference response always uses top-1 for every query.
8. `accepted`, similarity, confidence, margin, and abstention never control production selection.
9. Every inference failure category uses cryptographically random valid answers when the valid domain is known.
10. `Math.random()` is not used for answer generation.
11. Repeated inference failures do not stop, disable, cool down, or circuit-break future challenges.
12. Production attempts inference again on every new valid challenge.
13. Final and replay evidence do not gate startup, decisions, or TX43.
14. Only exact `FISHING_AUTO_TX43_ENABLED === 'true'` permits TX43.
15. The flag is checked immediately before every send.
16. Manual Stop invalidates every pending challenge.
17. Disconnect invalidates every pending challenge.
18. Teardown or connection replacement invalidates every pending challenge.
19. A newer challenge invalidates the older challenge’s pending answer.
20. No fallback or delayed send occurs after Stop, disconnect, stale generation, disabled gate, or indeterminate domain.
21. At most one TX43 is attempted per challenge.
22. A send failure does not cause retry or fallback.
23. TX43 serializes `true`, one-byte answer length, and the validated answer bytes.
24. Automated gameplay does not use generic `sendRaw` for TX43.
25. Telemetry contains only stable aggregate fields.
26. Telemetry contains no account identity, fish identity, images, raw packets, predictions, answers, model ID, credentials, endpoint, or raw exception messages.
27. Production code is completed before any Phase 3 test is written.
28. Server tests, typecheck, and production build pass after implementation.
29. Python verification passes without changing the frozen candidate.
30. Controlled manual verification demonstrates ML, random fallback, Stop, disconnect, stale challenge, duplicate suppression, and live kill-switch behavior.

## 15. Implementation Boundary for the Subsequent Plan

After this spec is approved, the implementation plan must cover production code first in this order:

1. inference-result exposure and no-breaker call;
2. `autoDecision`;
3. typed TX43 encoder;
4. RX79 `GameClient` event;
5. `AvatarSession` lifecycle integration;
6. sanitized telemetry;
7. automated tests after production code;
8. build and verification;
9. controlled production-path verification.

The plan must not introduce final/replay gating, TDD, a production inference circuit breaker, a broad fishing subsystem, or any placeholder for the valid TX43 answer mapping.