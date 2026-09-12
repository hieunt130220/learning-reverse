# Fishing Live Review Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép người dùng bật capture từ tab Câu cá, thu tối đa 100 batch RX79 cùng inference response thực tế và mở HTML để review tỷ lệ nhận diện thủ công.

**Architecture:** Backend sở hữu registry local-only theo account, ghi tuần tự payload và prediction vào session riêng rồi gọi Python builder khi dừng hoặc đủ 100 batch. `AvatarSession` bọc đúng lời gọi `ProductionInferenceClient.match()` bằng callback dependency-injected, còn React card điều khiển start/status/stop và mở report đã xác thực.

**Tech Stack:** Node.js 20+, TypeScript 5.7, Express 4, React 18, Python 3.12 standard library, HTML5/CSS3/vanilla JavaScript.

**Spec:** `docs/superpowers/specs/2026-09-12-fishing-live-review-capture-design.md`

## Global Constraints

- Capture target cố định `100` batch và tự seal ngay sau batch thành công thứ 100.
- Không sửa model, checkpoint, threshold, `makeAutoDecision` hoặc dữ liệu Phase 2 train/dev/final.
- Chỉ ghi inference result có `status: "ok"`; failure/fallback không tạo review batch.
- Lỗi capture không được reject hoặc thay đổi inference result trả về cho Auto câu cá.
- Capture root phải tuyệt đối, tách khỏi `fishing-ml/data/phase2`, và bị cấm khi `NODE_ENV=production`.
- Route phải dùng auth và `requireOwnedAccount`; không trả absolute filesystem path.
- Không tạo test file mới vì user không yêu cầu. Chạy test/typecheck/build hiện có sau production code.
- Trước khi sửa từng symbol, chạy GitNexus impact upstream; HIGH/CRITICAL phải báo trước khi edit, UNKNOWN phải kiểm tra thêm bằng `rg`.
- Trước mỗi commit, chạy GitNexus `detect_changes(scope="all")`; partial/truncated không được xem là clean.
- Giữ nguyên mọi thay đổi ngoài phạm vi trong worktree.

---

### Task 1: Thêm cấu hình local-only và lifecycle registry

**Files:**
- Modify: `avatar-web/server/src/config.ts:1-105`
- Create: `avatar-web/server/src/fishing/liveReviewCapture.ts`

**Interfaces:**
- Consumes: `CanCauPayload` and `SuccessfulInferenceResult` from `fishing/autoDecision.ts`; Node `fs`, `crypto`, `path`, `child_process`.
- Produces: `LiveReviewCaptureRegistry`, `LiveReviewCaptureSnapshot`, `LiveReviewCaptureState`, and `Config.fishingLiveReviewCaptureRoot: string | null`.

- [x] **Step 1: Run mandatory impact analysis**

Run GitNexus impact upstream for `loadConfig` and `Config` in `avatar-web/server/src/config.ts`. Inspect direct callers and report risk. If either result is UNKNOWN, confirm all uses with:

```bash
rg -n 'loadConfig|fishingRx79CaptureRoot|Config' avatar-web/server/src
```

Expected: configuration is initialized in `server/src/index.ts`; tests may construct `Config` or call `loadConfig`, so the new property must always be returned.

- [x] **Step 2: Add the capture root configuration**

Extend `Config`:

```ts
fishingLiveReviewCaptureRoot: string | null;
```

In `loadConfig`, parse `FISHING_LIVE_REVIEW_CAPTURE_ROOT` using the same absolute-path rule as RX79 capture. Apply this exact policy:

```ts
const rawLiveReviewRoot = env.FISHING_LIVE_REVIEW_CAPTURE_ROOT;
if (isProduction && rawLiveReviewRoot !== undefined) {
  throw new Error('FISHING_LIVE_REVIEW_CAPTURE_ROOT bị cấm trong production');
}
const normalizedLiveReviewRoot = rawLiveReviewRoot?.trim();
if (normalizedLiveReviewRoot && !path.isAbsolute(normalizedLiveReviewRoot)) {
  throw new Error('FISHING_LIVE_REVIEW_CAPTURE_ROOT phải là đường dẫn tuyệt đối');
}
```

Return `path.resolve(normalizedLiveReviewRoot)` or `null`.

- [x] **Step 3: Define strict lifecycle and snapshot contracts**

Create:

```ts
export const LIVE_REVIEW_TARGET_BATCH_COUNT = 100 as const;
export type LiveReviewCaptureState = 'capturing' | 'sealing' | 'ready' | 'blocked';

export interface LiveReviewCaptureSnapshot {
  readonly enabled: true;
  readonly state?: LiveReviewCaptureState;
  readonly sessionId?: string;
  readonly targetBatchCount: 100;
  readonly savedBatchCount: number;
  readonly failedBatchCount: number;
  readonly startedAt?: string;
  readonly stoppedAt?: string;
  readonly reportReady: boolean;
  readonly lastError?: string;
}
```

Internal `CaptureState` must contain account ID, session ID/root, timestamps, counts, phase, a `writeTail: Promise<void>`, optional `sealPromise`, report path and sanitized last error.

- [x] **Step 4: Implement start and snapshot**

Implement:

```ts
constructor(captureRoot: string, options?: {
  now?: () => Date;
  randomBytes?: (size: number) => Buffer;
  buildReport?: (manifestPath: string, outputPath: string) => Promise<void>;
})
start(accountId: number): LiveReviewCaptureSnapshot
snapshot(accountId: number): LiveReviewCaptureSnapshot
```

Validate positive safe-integer account ID and absolute root. Generate session ID as `live-review-<compact UTC>-<8 lowercase hex>`, create `sessions/<session-id>/raw` with mode `0700`, and reject start with an existing `capturing` or `sealing` state. A previous `ready` or `blocked` state may be replaced by a new session without deleting its directory.

- [x] **Step 5: Implement atomic batch recording**

Implement:

```ts
record(accountId: number, payload: CanCauPayload, result: SuccessfulInferenceResult): void
```

Return immediately if no capturing state. Append work to `writeTail`, clone Buffer contents before returning, and validate six nonempty references, 1–255 queries, complete unique predictions, query/reference ranges and PNG buffers. Write into `<session>/staging/<batch-id>`, including `img/*.png`, `new/*.png`, checksums and `prediction.json`, then rename atomically to `raw/<batch-id>`. Increment `savedBatchCount` only after rename. On error increment `failedBatchCount`, sanitize the message to 300 characters, update `session.json`, and keep the state capturing.

Use batch ID `live-<compact UTC>-<8 lowercase hex>`. Publish each JSON file with `fs.open(path, 'wx', 0o600)` so an existing batch file causes an error and every new JSON file has mode `0o600`. When count reaches 100, invoke `stopAndSeal(accountId)` once without awaiting it from `record`.

- [x] **Step 6: Implement seal and report resolution**

Implement:

```ts
stopAndSeal(accountId: number): Promise<LiveReviewCaptureSnapshot>
reportPath(accountId: number, sessionId: string): string | null
abortAll(reason: string): void
```

`stopAndSeal` rejects when state is absent or has zero saved batches, transitions once to `sealing`, waits `writeTail`, writes immutable `manifest.json` with sorted batch records, invokes `buildReport(manifestPath, reviewPath)`, and transitions to `ready` only if `review.html` exists. Failures transition to `blocked`. `reportPath` accepts only the current account session or a retained session whose `session.json.accountId` matches; validate the session ID with `/^live-review-[A-Za-z0-9-]+$/` and confirm the resolved file stays below capture root.

Default `buildReport` runs:

```text
python3 <repo>/fishing-ml/scripts/build_live_review.py --manifest <path> --output <path>
```

Use `spawn` with an argument array, no shell, capture bounded stderr, and reject nonzero exit.

- [x] **Step 7: Verify Task 1**

Run:

```bash
cd avatar-web/server
npm run typecheck
npm test
```

Expected: TypeScript exits `0`; all existing server tests pass. No new test file is created.

- [x] **Step 8: Analyze changes and commit**

Run GitNexus `detect_changes(scope="all")`; require `partial != true` and `truncated != true`. Then:

```bash
git add avatar-web/server/src/config.ts avatar-web/server/src/fishing/liveReviewCapture.ts
git commit -m "feat(fishing): add live review capture registry"
```

### Task 2: Wire inference capture and authenticated routes

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts:182-215,3500-3545`
- Modify: `avatar-web/server/src/session/manager.ts:35-60,280-310`
- Modify: `avatar-web/server/src/index.ts:1-95`
- Create: `avatar-web/server/src/fishing/liveReviewCaptureRoutes.ts`

**Interfaces:**
- Consumes: `LiveReviewCaptureRegistry.record/start/snapshot/stopAndSeal/reportPath` from Task 1; `api account auth`, `SessionManager`, `CanCauPayload`, `InferenceResult`.
- Produces: `AvatarSessionOptions.onFishingInference(payload, result)`, `SessionManagerDeps.onFishingInference(accountId, payload, result)`, and four `/api/accounts/:id/fishing-live-review` routes.

- [x] **Step 1: Run mandatory impact analysis**

Run GitNexus impact upstream for `AvatarSessionOptions`, `handleFishingChallenge`, `SessionManager`, and `server/src/index.ts`. For UNKNOWN results, confirm constructors and option assembly with:

```bash
rg -n 'AvatarSessionOptions|new AvatarSession|new SessionManager|handleFishingChallenge' avatar-web/server/src
```

Report direct callers and affected processes before editing.

- [x] **Step 2: Inject the inference observer without changing auto-decision**

Add to `AvatarSessionOptions`:

```ts
onFishingInference?: (payload: CanCauPayload, result: InferenceResult) => void;
```

Replace the existing inference function argument with this wrapper:

```ts
const infer = async (challenge: CanCauPayload): Promise<InferenceResult> => {
  const result = await inferenceClient.match(challenge);
  try {
    this.opts.onFishingInference?.(challenge, result);
  } catch (error) {
    this.pushLog(`[câu cá] lỗi capture review: ${(error as Error).message}`);
  }
  return result;
};
void makeAutoDecision(payload, domain, infer)
```

Keep the existing continuation beginning with `.then(async (decision) => {` byte-for-byte after this call, including its complete current function body and closing tokens. The observer must run once per completed inference call and must return the original result unchanged.

- [x] **Step 3: Thread the observer through SessionManager**

Add to `SessionManagerDeps`:

```ts
onFishingInference?: (
  accountId: number,
  payload: CanCauPayload,
  result: InferenceResult,
) => void;
```

Include this adapter in the `AvatarSessionOptions` object constructed by `SessionManager`:

```ts
onFishingInference: (payload, result) => (
  this.deps.onFishingInference?.(accountId, payload, result)
),
```

- [x] **Step 4: Create authenticated account routes**

Implement `liveReviewCaptureRouter` with deps `{db, isProduction, sessions, registry}` and root `/:id/fishing-live-review`. Apply `makeRequireAuth(db,isProduction)` and `requireOwnedAccount(db)` to every enabled route.

Exact behavior:

```text
GET root                 -> {enabled:false,targetBatchCount:100,savedBatchCount:0,failedBatchCount:0,reportReady:false} when disabled
POST root/start          -> require online session, registry.start(accountId)
GET root                 -> registry.snapshot(accountId), or enabled idle snapshot
POST root/stop           -> await registry.stopAndSeal(accountId)
GET root/:session/report -> res.sendFile(registry.reportPath(accountId,sessionId))
```

Start/stop conflicts return `409`; missing reports return `404`; unexpected capture errors return sanitized `409`. Disabled mutation/report routes return `404`.

- [x] **Step 5: Initialize and mount in server entrypoint**

In `index.ts`, construct registry only when `config.fishingLiveReviewCaptureRoot` is non-null. Pass this callback to `SessionManager`:

```ts
onFishingInference: (accountId, payload, result) => {
  if (result.status === 'ok') liveReviewRegistry?.record(accountId, payload, result);
}
```

This uses the account ID owned by `SessionManager`, never `payload.idUser`. Mount routes under `/api/accounts` and call ``liveReviewRegistry?.abortAll(`server shutdown: ${signal}`)`` during shutdown.

- [x] **Step 6: Verify Task 2**

Run:

```bash
cd avatar-web/server
npm run typecheck
npm test
npm run build
```

Expected: all commands exit `0`; existing auto-decision and route tests remain green.

- [x] **Step 7: Analyze changes and commit**

Run GitNexus `detect_changes(scope="all")`; inspect `handleFishingChallenge` and startup flows. Then:

```bash
git add avatar-web/server/src/session/avatarSession.ts avatar-web/server/src/session/manager.ts avatar-web/server/src/index.ts avatar-web/server/src/fishing/liveReviewCaptureRoutes.ts
git commit -m "feat(fishing): capture live inference batches"
```

### Task 3: Build standalone HTML for unlabeled live sessions

**Files:**
- Create: `avatar-web/fishing-ml/scripts/build_live_review.py`
- Read-only reference: `avatar-web/fishing-ml/scripts/build_final_review.py`

**Interfaces:**
- Consumes: `--manifest PATH`, `--output PATH`; session manifest and `raw/<batch-id>/prediction.json` from Tasks 1–2.
- Produces: standalone `review.html`, exit `0` summary, or nonzero validation error without replacing a valid output.

- [x] **Step 1: Inspect existing report builder**

Run GitNexus context/impact upstream for `render_html` and `build_payload` in `build_final_review.py`. If their reuse would force the live schema to pretend it has `expectedImgIndex`, keep the live builder independent and reuse only CSS/interaction patterns.

- [x] **Step 2: Implement strict live manifest loading**

Define:

```python
def sha256_file(path: Path) -> str
def read_json_object(path: Path) -> dict[str, object]
def encode_verified_png(path: Path, expected_sha256: str) -> str
def build_payload(manifest_path: Path) -> dict[str, object]
def render_html(payload: dict[str, object]) -> str
def main(argv: Sequence[str] | None = None) -> int
```

Validate session/batch schema version 1, unique safe IDs, 1–100 batches, exactly six references, 1–255 queries per batch, complete predictions, index ranges, file containment, PNG signature, file existence and SHA-256. Sort batches by capture time then ID and queries by `newIndex`.

- [x] **Step 3: Emit the unlabeled review payload**

Use payload contract:

```json
{
  "schemaVersion": 1,
  "mode": "live-review",
  "sessionId": "live-review-20260912T120000000Z-a1b2c3d4",
  "manifestSha256": "64 lowercase hex",
  "modelIds": ["model-id"],
  "summary": {"totalBatches": 1, "totalQueries": 6, "acceptedCount": 4},
  "batches": []
}
```

Every query includes `newIndex`, data URL, `predictedImgIndex`, `similarity`, nullable `margin`, `accepted`, and `modelId`. Do not synthesize `expectedImgIndex`.

- [x] **Step 4: Implement manual review UI and metrics**

Copy the established visual language of final review, with manual selection 0–5 or `null`. Persist under:

```text
fishing-live-review:v1:<sessionId>:<manifestSha256>
```

Calculate and display captured batches/queries, accepted rate, review progress, manual top-1 accuracy, manual accepted accuracy and rejected-but-correct count. Filters: all, unreviewed, reviewed, accepted, rejected, manually correct, manually wrong, and batch. Export JSON with session metadata, integer metric summary and sorted reviews; exclude image data.

- [x] **Step 5: Verify builder against a bounded fixture directory created outside the repo**

Create a temporary session under `/tmp/fishing-live-review-plan-verification`, containing one batch with six valid PNG references and one query copied from existing Phase 2 raw data, plus a matching successful prediction and checksums. Run:

```bash
cd avatar-web/fishing-ml
.venv/bin/python scripts/build_live_review.py \
  --manifest /tmp/fishing-live-review-plan-verification/manifest.json \
  --output /tmp/fishing-live-review-plan-verification/review.html
.venv/bin/python -m py_compile scripts/build_live_review.py
```

Expected: build exits `0`, reports 1 batch/1 query, output contains embedded PNG data, no `http://`, `https://` or `fetch(`, and a DOM smoke check with existing `avatar-web/web/node_modules/jsdom` renders one query and updates manual accuracy after a reference click.

- [x] **Step 6: Analyze changes and commit**

Run GitNexus `detect_changes(scope="all")`; require a complete result. Then:

```bash
git add avatar-web/fishing-ml/scripts/build_live_review.py
git commit -m "feat(fishing): build live capture review reports"
```

### Task 4: Add web capture controls to FishingPanel

**Files:**
- Create: `avatar-web/web/src/accounts/panels/LiveReviewCaptureCard.tsx`
- Modify: `avatar-web/web/src/accounts/panels/FishingPanel.tsx:1-518`
- Read-only reuse: `avatar-web/web/src/api.ts`

**Interfaces:**
- Consumes: `apiGet`, `apiPost`; four API routes from Task 2; `accountId` and account online state from `FishingPanel`.
- Produces: `LiveReviewCaptureCard({accountId,isOnline}: Props)` and user-visible capture controls.

- [x] **Step 1: Run mandatory impact analysis**

Run GitNexus impact upstream for `FishingPanel`. Review `LoadedOperations` as its direct caller. Confirm the insertion point with:

```bash
rg -n 'FishingPanel|Cấu hình|Thống kê' avatar-web/web/src/accounts
```

- [x] **Step 2: Implement typed API state and polling**

Define the snapshot interface matching the backend and component props:

```ts
interface LiveReviewCaptureCardProps {
  accountId: number;
  isOnline: boolean;
}
```

Fetch status on mount/account change. While `state` is `capturing` or `sealing`, poll every 2 seconds with a cancellable effect. Ignore stale responses after unmount/account change. Disabled response renders nothing.

- [x] **Step 3: Implement start, stop and report actions**

Start calls `POST /api/accounts/${accountId}/fishing-live-review/start`; disable while request pending or account offline. Stop calls the corresponding `/stop` endpoint and holds pending state until seal returns. Open report with:

```ts
window.open(
  `/api/accounts/${accountId}/fishing-live-review/${encodeURIComponent(sessionId)}/report`,
  '_blank',
  'noopener,noreferrer',
);
```

Display `ApiError.message` inline and preserve the latest successful snapshot.

- [x] **Step 4: Render state-specific controls**

Render a card titled **Dữ liệu review model** below the ML statistics section in `FishingPanel`:

```text
idle       Bắt đầu thu thập 100 batch
capturing  progress saved/100, failed count, Dừng và tạo trang review
sealing    Đang tạo trang review… (disabled)
ready      captured count, Mở trang review, Bắt đầu phiên mới
blocked    sanitized error, Bắt đầu phiên mới
```

Use existing `.card`, `.hint`, `.primary`, `.ghost` styles and an accessible `<progress max={100}>` element. Mount with `accountId` and `account.status === 'online'`.

- [x] **Step 5: Verify frontend**

Run:

```bash
cd avatar-web/web
npm test
npm run build
```

Expected: existing Vitest suite passes and production frontend build exits `0` without TypeScript errors.

- [x] **Step 6: Analyze changes and commit**

Run GitNexus `detect_changes(scope="all")`; inspect any affected account-panel flow. Then:

```bash
git add avatar-web/web/src/accounts/panels/LiveReviewCaptureCard.tsx avatar-web/web/src/accounts/panels/FishingPanel.tsx
git commit -m "feat(fishing): add live review capture controls"
```

### Task 5: End-to-end local verification and documentation ledger

**Files:**
- Modify: `docs/superpowers/plans/2026-09-12-fishing-live-review-capture.md`
- Existing: `docs/superpowers/specs/2026-09-12-fishing-live-review-capture-design.md`

**Interfaces:**
- Consumes: completed server, builder and frontend from Tasks 1–4.
- Produces: checked plan, verified local workflow and documented commands/results.

- [ ] **Step 1: Configure a local capture root**

Pending until the feature branch is integrated into the active local checkout; the ignored `.env` there must point to its own absolute `avatar-web/server/data/fishing-review-captures` directory.

Set this absolute path in `avatar-web/server/.env` without changing production configuration:

```text
FISHING_LIVE_REVIEW_CAPTURE_ROOT=/Users/hieunt/learning-reverse/avatar-web/server/data/fishing-review-captures
```

If `.env` is ignored, leave it untracked. Confirm startup logs contain no absolute path or secrets.

- [x] **Step 2: Run complete automated verification**

Run:

```bash
cd avatar-web/server && npm run typecheck && npm test && npm run build
cd ../web && npm test && npm run build
cd ../fishing-ml && .venv/bin/python -m unittest discover -s tests
.venv/bin/python -m py_compile scripts/build_final_review.py scripts/build_live_review.py
git -C /Users/hieunt/learning-reverse diff --check
```

Expected: every command exits `0`; no new test file exists.

- [ ] **Step 3: Verify the live workflow with the user-operated Auto fishing session**

Pending user-operated live session. Registry smoke verification completed with 1 captured batch and 1 query; the generated report reached `ready` and resolved as `review.html`.

Start local services. In the web UI, start capture, then let the user enable Auto câu cá. Confirm status progresses, stop after at least one batch or allow it to reach 100, open report, select a manual answer, reload and confirm persistence. Record actual batch/query counts in this plan below this step.

- [x] **Step 4: Verify production guard**

Run `loadConfig` in a subprocess with `NODE_ENV=production` and `FISHING_LIVE_REVIEW_CAPTURE_ROOT` set while providing isolated dummy required configuration. Expected: process exits nonzero with `FISHING_LIVE_REVIEW_CAPTURE_ROOT bị cấm trong production` before server startup.

- [x] **Step 5: Run final GitNexus review**

Run `detect_changes(scope="all")` and `detect_changes(scope="compare", base_ref="main")`. Neither result may be partial/truncated. Investigate every HIGH/CRITICAL risk and read affected processes before committing.

- [x] **Step 6: Mark completed plan steps and commit docs**

Change only verified checkboxes to `- [x]`. Leave user-dependent or blocked verification unchecked with the exact reason and evidence. Then:

```bash
git add docs/superpowers/specs/2026-09-12-fishing-live-review-capture-design.md docs/superpowers/plans/2026-09-12-fishing-live-review-capture.md
git commit -m "docs(fishing): record live review capture workflow"
```
