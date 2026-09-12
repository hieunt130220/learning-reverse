# Fishing Model Review HTML Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tạo một HTML tự chứa để người dùng review trực quan 210 dự đoán final của model fishing, lưu lựa chọn thủ công và tính lại tỷ lệ nhận diện.

**Architecture:** Một Python builder chỉ đọc final report, frozen snapshot và raw PNG, kiểm tra toàn vẹn rồi sinh một HTML duy nhất có toàn bộ ảnh dưới dạng data URL. JavaScript chạy hoàn toàn trong trình duyệt để render, lọc, lưu review vào `localStorage`, tính metrics và xuất JSON.

**Tech Stack:** Python 3.12 standard library, HTML5, CSS3, vanilla JavaScript, browser `localStorage`, Blob download API.

**Spec:** `docs/superpowers/specs/2026-09-12-fishing-model-review-html-design.md`

## Global Constraints

- Không retrain model, chạy inference, thay checkpoint, threshold, deploy config hoặc nhãn dataset.
- Output phải là một file HTML tự chứa, mở trực tiếp bằng `file://` và không cần server hay kết nối mạng.
- Nguồn chuẩn là run `p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01` với đúng 30 final batch và 210 predictions.
- Mọi PNG phải được đối chiếu SHA-256 từ frozen dataset snapshot trước khi nhúng.
- Review “không xác định” được tính là đã review nhưng không thuộc mẫu số accuracy thủ công.
- Không tạo test file vì user không yêu cầu; dùng build validation, static checks và manual browser verification sau production code.
- Giữ nguyên mọi thay đổi không liên quan đang có trong worktree.
- Chạy GitNexus graph inspection trước production edit và `detect-changes --scope all` trước commit theo `AGENTS.md`.

---

### Task 1: Xây dựng deterministic HTML bundle generator

**Files:**
- Create: `avatar-web/fishing-ml/scripts/build_final_review.py`
- Create: `avatar-web/fishing-ml/review/final-model-review.html` (generated output)

**Interfaces:**
- Consumes: `final-evaluation.json` schema-v1 predictions; `frozen/dataset-snapshot.json` final batch records; raw files under `data/phase2/raw/<batchId>/{img,new}/*.png`.
- Produces: `build_payload(project_root: Path, run_id: str) -> dict[str, object]`, `render_html(payload: dict[str, object]) -> str`, `main(argv: Sequence[str] | None = None) -> int`, and a self-contained `review/final-model-review.html`.

- [x] **Step 1: Inspect the source flow and blast radius before production edits**

Run:

```bash
node .gitnexus/run.cjs query "fishing final evaluation predictions dataset snapshot" --repo .
node .gitnexus/run.cjs context "evaluate_final_once" --repo .
```

Expected: GitNexus identifies `evaluate_final_once` as the producer of `final-evaluation.json`; no existing production symbol is modified by this task. If the graph reports stale data, first run `node .gitnexus/run.cjs analyze --index-only` and repeat both commands.

- [x] **Step 2: Implement strict source loading and validation**

Create the builder with these constants and public boundaries:

```python
DEFAULT_RUN_ID = "p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01"
EXPECTED_BATCH_COUNT = 30
EXPECTED_QUERY_COUNT = 210
EXPECTED_REFERENCE_COUNT = 6

def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()

def read_json_object(path: Path) -> dict[str, object]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"expected JSON object: {path}")
    return value

def encode_verified_png(path: Path, expected_sha256: str) -> str:
    actual = sha256_file(path)
    if actual != expected_sha256.lower():
        raise ValueError(f"PNG checksum mismatch: {path}")
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:image/png;base64,{encoded}"
```

Also define `build_payload(project_root: Path, run_id: str) -> dict[str, object]`, which performs the complete join and validation below, and `render_html(payload: dict[str, object]) -> str`, which emits the standalone document.

`read_json_object` must reject a non-object root. `encode_verified_png` must compare the lowercase SHA-256 digest and return `data:image/png;base64,<payload>`. `build_payload` must enforce:

```python
report.get("schemaVersion") == 1
report.get("split") == "final"
len(report["predictions"]) == EXPECTED_QUERY_COUNT
len(final_batches) == EXPECTED_BATCH_COUNT
len(batch["manifest"]["images"]) == EXPECTED_REFERENCE_COUNT
```

It must reject duplicate `(batchId, newIndex)` pairs, missing final batches, non-integer indexes, reference indexes outside `0..5`, query indexes absent from the batch manifest, missing PNG files, and checksum mismatches. The returned payload must contain `schemaVersion`, `modelId`, `sourceReportSha256`, `generatedAt`, `summary`, and `batches`.

- [x] **Step 3: Implement deterministic payload shape**

Each embedded batch must use this shape:

```python
{
    "batchId": batch_id,
    "references": [
        {"index": reference.index, "src": encode_verified_png(reference_path, reference.sha256)}
        for reference in sorted(manifest.images, key=lambda item: item.index)
    ],
    "queries": [{
        "newIndex": prediction["newIndex"],
        "src": encode_verified_png(query_path, query_sha256),
        "expectedImgIndex": prediction["expectedImgIndex"],
        "predictedImgIndex": prediction["predictedImgIndex"],
        "similarity": prediction["similarity"],
        "margin": prediction["margin"],
        "accepted": prediction["accepted"],
    } for prediction in sorted(batch_predictions, key=lambda item: item["newIndex"])],
}
```

Sort batches by `batchId`, references by `index`, and queries by `newIndex`. Compute summary values independently from predictions and assert they equal `30 batches`, `210 queries`, `209 correct`, `116 accepted`, `29 batch-exact`, and `0 accepted-wrong`; abort if source evidence changes unexpectedly.

- [x] **Step 4: Implement safe HTML rendering and CLI**

Serialize the payload using compact JSON and neutralize HTML script terminators before interpolation:

```python
embedded_json = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
embedded_json = embedded_json.replace("<", "\\u003c")
```

Expose CLI options:

```text
--project-root PATH  default: parent of scripts/
--run-id ID          default: DEFAULT_RUN_ID
--output PATH        default: <project-root>/review/final-model-review.html
```

Write with UTF-8 only after all validation succeeds. Create the output parent directory with `mkdir(parents=True, exist_ok=True)`. On success print exactly one summary line containing output path, batch count, query count, correct count, accepted count, and output byte size. On validation failure, print a concise message to stderr and return nonzero without replacing a previously generated valid file.

- [x] **Step 5: Build the generated artifact**

Run:

```bash
cd avatar-web/fishing-ml
.venv/bin/python scripts/build_final_review.py
```

Expected: exit `0`; output reports `30 batches`, `210 queries`, `209 correct`, `116 accepted`; `review/final-model-review.html` exists and is nonempty.

- [x] **Step 6: Verify the bundle statically**

Run:

```bash
cd avatar-web/fishing-ml
rg -n 'p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01|data:image/png;base64|localStorage' review/final-model-review.html
rg -n 'https?://|fetch\(' review/final-model-review.html
```

Expected: the first command finds the model ID, embedded PNG data and local storage logic. The second command returns exit `1` with no matches, proving the page has no network URL or runtime fetch.

- [x] **Step 7: Commit**

Before committing, run:

```bash
node .gitnexus/run.cjs detect-changes --scope all --repo .
```

Expected: result is neither partial nor truncated and reports only the new builder/artifact plus already existing unrelated worktree changes. Stage only the files for this task:

```bash
git add avatar-web/fishing-ml/scripts/build_final_review.py avatar-web/fishing-ml/review/final-model-review.html
git commit -m "feat(fishing): add interactive model review report"
```

### Task 2: Hoàn thiện giao diện và tương tác review trong generated HTML

**Files:**
- Modify: `avatar-web/fishing-ml/scripts/build_final_review.py`
- Modify: `avatar-web/fishing-ml/review/final-model-review.html` (regenerated output)

**Interfaces:**
- Consumes: payload emitted by `build_payload()` with `summary` and `batches`; browser `localStorage` and Blob APIs.
- Produces: browser functions `loadReviews()`, `saveReviews()`, `calculateMetrics()`, `renderMetrics()`, `renderBatches()`, `setReview()`, `clearReview()`, `applyFilters()`, `exportReviews()`, and `resetAllReviews()`.

- [x] **Step 1: Implement the review dashboard layout in the HTML template**

Add semantic regions with stable IDs:

```html
<header id="report-header"></header>
<section id="dataset-metrics" aria-label="Chỉ số dataset"></section>
<section id="manual-metrics" aria-label="Chỉ số review thủ công"></section>
<section id="filters" aria-label="Bộ lọc"></section>
<main id="batch-list"></main>
<div id="storage-warning" role="status" hidden></div>
```

Use responsive CSS variables and grid rules. Query cards must show the query image prominently, six reference buttons, badges with both text and color, similarity to four decimals, margin to four decimals, and explicit labels for model/dataset/manual selections. Use visible keyboard focus, actual `<button>` controls, descriptive `alt` text, and a single-column mobile layout below 760px.

- [x] **Step 2: Implement review persistence with schema validation**

Use this exact key and stored shape:

```javascript
const storageKey = `fishing-model-review:v1:${DATA.modelId}:${DATA.sourceReportSha256}`;
const storedDocument = {
  schemaVersion: 1,
  modelId: DATA.modelId,
  sourceReportSha256: DATA.sourceReportSha256,
  reviews: {
    [queryKey]: { batchId, newIndex, reviewedImgIndex, reviewedAt }
  }
};
```

`loadReviews()` must accept only matching schema/model/report records and only indexes `0..5` or `null`. Catch parse, security and quota errors. Keep in-memory state functional and show `#storage-warning` when persistence fails.

- [x] **Step 3: Implement manual review actions**

Reference buttons call `setReview(batchId, newIndex, referenceIndex)`. “Không xác định” calls `setReview(batchId, newIndex, null)`. “Xóa review” removes only that query. Every mutation must set a fresh ISO timestamp, save state, recalculate metrics and rerender the affected UI without reloading the page.

The selected reference must expose these visual states without ambiguity:

```text
model choice       badge: "Model chọn"
dataset label      badge: "Nhãn dataset"
manual choice      badge: "Bạn chọn"
model and manual   combined badge when indexes coincide
```

- [x] **Step 4: Implement metric calculations**

`calculateMetrics()` must return integer numerators and denominators plus display ratios for:

```javascript
{
  datasetCorrect, totalQueries, datasetBatchExact, totalBatches,
  acceptedCount, acceptedCorrect,
  manualReviewed, manualComparable, manualCorrect,
  manualAcceptedComparable, manualAcceptedCorrect, labelDisagreements
}
```

Render the fixed source values as `209/210 (99,52%)`, `29/30 (96,67%)`, `116/210 (55,24%)`, and `116/116 (100%)`. Render manual accuracy as `—` when its denominator is zero, and always display the denominator so partial review cannot be confused with whole-dataset accuracy.

- [x] **Step 5: Implement filters and review navigation**

Add filters for:

```text
all | unreviewed | reviewed | model-wrong | accepted | rejected | label-disagreement
```

Add a batch selector with all 30 IDs, a visible result count, and “Tới mục chưa review tiếp theo”. `applyFilters()` must combine the status filter and batch filter. Empty results must show a Vietnamese empty-state message rather than a blank page.

- [x] **Step 6: Implement JSON export and guarded reset**

`exportReviews()` must download a UTF-8 JSON Blob containing `schemaVersion`, `modelId`, `sourceReportSha256`, `exportedAt`, the current integer metric summary, and reviews sorted by `(batchId, newIndex)`. Name it `fishing-model-review-<modelId>.json`.

`resetAllReviews()` must call `window.confirm("Xóa toàn bộ kết quả review đã lưu trên trình duyệt này?")`; cancel preserves all state, confirm clears only the active report’s storage key and rerenders zero manual progress.

- [x] **Step 7: Regenerate and verify source metrics**

Run:

```bash
cd avatar-web/fishing-ml
.venv/bin/python scripts/build_final_review.py
```

Expected: builder again reports `30 batches`, `210 queries`, `209 correct`, `116 accepted`, and produces no checksum or schema error.

- [ ] **Step 8: Verify behavior manually in a browser**

Blocked by the Codex in-app browser URL policy, which rejects direct `file://` navigation. Equivalent automated DOM verification using the existing `jsdom` dependency passed: 30 batches and 210 cards rendered; source metrics matched; a review persisted; manual metrics updated; and the unreviewed filter reduced the visible count to 209. The final HTML remains available for user review in a normal browser.

Open `avatar-web/fishing-ml/review/final-model-review.html` directly. Verify:

```text
all 30 batches and 210 query cards are reachable
all query and reference images render
dataset metrics show 209/210, 29/30, 116/210, and 116/116
selecting a reference updates manual reviewed/comparable/accuracy
"không xác định" increments reviewed but not comparable
reload restores saved review
each status filter and batch filter changes visible cards correctly
exported JSON matches visible decisions and metrics
canceling reset preserves reviews; confirming reset clears them
```

- [x] **Step 9: Run repository checks and commit**

Run:

```bash
git diff --check
node .gitnexus/run.cjs detect-changes --scope all --repo .
```

Expected: `git diff --check` exits `0`; GitNexus output is neither partial nor truncated and introduces no unexpected affected flow. Stage only task files:

```bash
git add avatar-web/fishing-ml/scripts/build_final_review.py avatar-web/fishing-ml/review/final-model-review.html
git commit -m "feat(fishing): complete manual model review workflow"
```

### Task 3: Hoàn tất tài liệu theo dõi plan

**Files:**
- Modify: `docs/superpowers/plans/2026-09-12-fishing-model-review-html.md`
- Existing: `docs/superpowers/specs/2026-09-12-fishing-model-review-html-design.md`

**Interfaces:**
- Consumes: verified completion evidence from Tasks 1–2.
- Produces: checked implementation plan recording exactly which steps completed and their verification results.

- [x] **Step 1: Mark completed execution steps**

Change only successfully completed task checkboxes from `- [ ]` to `- [x]`. Leave a failed or skipped step unchecked and add its concrete command result immediately below that step.

- [x] **Step 2: Verify documentation and final graph changes**

Run:

```bash
git diff --check -- docs/superpowers/specs/2026-09-12-fishing-model-review-html-design.md docs/superpowers/plans/2026-09-12-fishing-model-review-html.md
node .gitnexus/run.cjs detect-changes --scope all --repo .
```

Expected: whitespace validation exits `0`; GitNexus result is neither partial nor truncated.

- [x] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-09-12-fishing-model-review-html-design.md docs/superpowers/plans/2026-09-12-fishing-model-review-html.md
git commit -m "docs(fishing): record model review implementation"
```
