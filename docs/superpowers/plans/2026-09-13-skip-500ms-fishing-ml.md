# Bỏ Qua ML Cho Lượt Câu Cá 500ms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Không gọi model hoặc ghi thống kê ML cho RX79 có `timeDelayMs === 500`, đồng thời gửi đáp án mặc định giống APK để server chốt lượt nhanh.

**Architecture:** Thêm một nhánh thoát sớm trong `AvatarSession.handleFishingChallenge` ngay sau khi dựng answer domain và generation. Nhánh này chờ 500ms, dùng cùng Pre-Send Gate với nhánh ML rồi gửi mảng `0` đúng số query mà không đặt nguồn `ml`; mọi challenge khác giữ nguyên đường inference hiện tại. Sau khi triển khai, sao lưu SQLite và reset aggregate ML cũ vì dữ liệu hiện tại không lưu deadline theo từng attempt.

**Tech Stack:** TypeScript 5.7, Node.js, better-sqlite3/SQLite

**Spec:** `docs/superpowers/specs/2026-09-13-skip-500ms-fishing-ml-design.md`

## Global Constraints

- Chỉ `timeDelayMs === 500` được phân loại là lượt thoát nhanh; không dùng ngưỡng rộng.
- Nhánh 500ms không được khởi tạo/gọi `ProductionInferenceClient`, `makeAutoDecision` hoặc `onFishingInference`.
- Nhánh 500ms không được đặt `currentFishingChallengeSource = 'ml'` và không được tăng `avatar_ml_fishing_statistics`.
- Đáp án mặc định gồm đúng `domain.queryCount` phần tử, tất cả bằng `0`.
- Phải giữ Pre-Send Gate đồng bộ; không có `await` giữa lần kiểm tra gate cuối cùng và `client.finishFishing`.
- Challenge có deadline khác 500ms giữ nguyên logic inference, capture, humanized delay và statistics hiện tại.
- Không sửa frontend, decoder RX79, inference API, model, threshold hoặc checkpoint.
- Không tạo hoặc sửa test file; project cấm TDD và user không yêu cầu test.
- Sao lưu SQLite trước khi xóa riêng aggregate `avatar_ml_fishing_statistics`; không xóa bảng thống kê cá theo ngày hoặc account.
- Phải chạy GitNexus impact trước khi sửa và detect-changes trước commit. Nếu CLI tiếp tục fail do `@ladybugdb/core`, ghi nhận failure và bù bằng text search callers/diff; không coi UNKNOWN hoặc output rỗng là an toàn.

---

### Task 1: Bỏ qua inference cho challenge 500ms

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts:241-265`
- Modify: `avatar-web/server/src/session/avatarSession.ts:3529-3634`

**Interfaces:**
- Consumes: `CanCauPayload.timeDelayMs`, `FishingAnswerDomain.queryCount` từ `buildAnswerDomain`, `delayCancellable`, `consumedFishingChallenges`, `fishingChallengeGeneration`, `automationGeneration`, `connectionEpoch`, `isCurrent`, `isFishingAutoTx43Enabled`, `GameClient.finishFishing`.
- Produces: `FISHING_INSTANT_ESCAPE_DELAY_MS = 500`; nhánh RX79 500ms gửi `readonly number[]` mặc định và return trước inference.

- [x] **Step 1: Chạy impact gate và xác nhận callers bằng text search**

Run:

```bash
cd /Users/hieunt/learning-reverse
node .gitnexus/run.cjs impact handleFishingChallenge --direction upstream --repo .
rg -n "handleFishingChallenge|fishing-challenge|timeDelayMs|finishFishing" \
  avatar-web/server/src/session/avatarSession.ts \
  avatar-web/server/src/game/client.ts \
  avatar-web/server/src/game/fishingDecode.ts
```

Expected:

- Impact trả risk/callers có thể đánh giá; nếu CLI lặp lại lỗi cài `@ladybugdb/core`, lưu nguyên output failure.
- Text search xác nhận `handleFishingChallenge` chỉ được gọi từ listener `fishing-challenge` của `AvatarSession` và `timeDelayMs` đã được decode từ RX79.
- Nếu risk HIGH/CRITICAL, dừng trước khi sửa và báo user; UNKNOWN phải được đối chiếu bằng text search vừa chạy.

- [x] **Step 2: Thêm hằng số deadline thoát nhanh**

Thêm ngay sau `FISHING_HUMAN_TIMING`:

```ts
const FISHING_INSTANT_ESCAPE_DELAY_MS = 500;
```

Không export hằng số vì đây là chi tiết protocol chỉ dùng trong `AvatarSession`.

- [x] **Step 3: Thêm nhánh 500ms trước khi khởi tạo inference client**

Trong `handleFishingChallenge`, giữ nguyên guard, status, domain validation và hai biến generation. Ngay sau:

```ts
    const challengeGen = ++this.fishingChallengeGeneration;
    const autoGen = this.automationGeneration;
```

thêm:

```ts
    if (payload.timeDelayMs === FISHING_INSTANT_ESCAPE_DELAY_MS) {
      const defaultAnswer = Object.freeze(
        Array.from({ length: domain.queryCount }, () => 0),
      );
      const abortSignal = this.fishingAbortController?.signal ?? new AbortController().signal;

      this.currentFishingChallengeSource = undefined;
      this.pushLog(
        `fishing: RX79 deadline ${payload.timeDelayMs}ms — bỏ qua ML, chờ gửi đáp án mặc định`,
      );

      void this.delayCancellable(payload.timeDelayMs, abortSignal)
        .then(() => {
          if (this.consumedFishingChallenges.has(challengeGen)) return;
          if (this.fishingChallengeGeneration !== challengeGen) return;
          if (this.automationGeneration !== autoGen) return;
          if (this.connectionEpoch !== epoch) return;
          if (this.client !== client) return;
          if (!this.isCurrent(client, epoch)) return;
          if (!this.wanted) return;
          if (this.desiredMode !== 'auto_fishing') return;
          if (client.status !== 'online') return;

          if (!isFishingAutoTx43Enabled()) {
            this.pushLog('fishing: TX43 mặc định bị chặn bởi FISHING_AUTO_TX43_ENABLED !== true');
            return;
          }

          this.consumedFishingChallenges.add(challengeGen);
          try {
            client.finishFishing(defaultAnswer);
            this.pushLog(
              `fishing: đã gửi TX43 mặc định cho deadline ${payload.timeDelayMs}ms — không tính ML`,
            );
          } catch (sendErr) {
            this.pushLog(`fishing: gửi TX43 mặc định lỗi: ${(sendErr as Error).message}`);
          }
        });
      return;
    }
```

Điểm kiểm soát bắt buộc:

- `return` nằm trước `this.fishingInferenceClient ??=` và `makeAutoDecision`.
- Không gọi `onFishingInference` trong nhánh.
- Không gán source `random`; source để `undefined` để `recordMlResult` bỏ qua.
- `defaultAnswer` luôn hợp lệ vì `buildAnswerDomain` đã yêu cầu ít nhất một reference và một query.

- [x] **Step 4: Build production code**

Run:

```bash
cd /Users/hieunt/learning-reverse
npm --prefix avatar-web/server run build
```

Expected: exit 0, không có lỗi TypeScript và `schema.sql` được copy vào `dist/db/schema.sql`.

- [x] **Step 5: Kiểm tra cấu trúc nhánh bằng source inspection**

Run:

```bash
cd /Users/hieunt/learning-reverse
rg -n -A 70 "timeDelayMs === FISHING_INSTANT_ESCAPE_DELAY_MS" \
  avatar-web/server/src/session/avatarSession.ts
rg -n "FISHING_INSTANT_ESCAPE_DELAY_MS|fishingInferenceClient|makeAutoDecision|onFishingInference" \
  avatar-web/server/src/session/avatarSession.ts
git diff --check
```

Expected:

- Nhánh 500ms xuất hiện trước dòng khởi tạo inference và trước `makeAutoDecision`.
- Nhánh có đúng một `finishFishing(defaultAnswer)` và không có gán source ML.
- `git diff --check` exit 0.

- [ ] **Step 6: Chạy detect-changes rồi commit production change**

Run:

```bash
cd /Users/hieunt/learning-reverse
node .gitnexus/run.cjs detect-changes --scope all --repo .
git diff --name-only
git diff --check
git add avatar-web/server/src/session/avatarSession.ts \
  docs/superpowers/specs/2026-09-13-skip-500ms-fishing-ml-design.md \
  docs/superpowers/plans/2026-09-13-skip-500ms-fishing-ml.md
git commit -m "fix(fishing): skip ml for instant escape challenges"
```

Expected:

- Detect-changes không báo HIGH/CRITICAL regression. Nếu CLI vẫn fail, lưu output và bù bằng `git diff --name-only`, source inspection ở Step 5 và build ở Task 2; không mô tả GitNexus là clean.
- Commit chứa một production file cùng hai tài liệu đã duyệt, không chứa generated capture hoặc database.

---

### Task 2: Xác minh không gọi ML cho dữ liệu 500ms

**Files:**
- Verify: `avatar-web/server/src/session/avatarSession.ts`
- Read: `avatar-web/server/data/fishing-review-captures/sessions/live-review-20260912T163337300Z-7b9c767a/raw/*/prediction.json`

**Interfaces:**
- Consumes: nhánh `FISHING_INSTANT_ESCAPE_DELAY_MS` từ Task 1 và capture RX79 hiện có.
- Produces: bằng chứng phân bố deadline được tái lập và nhánh 500ms không thể chạm inference theo control flow.

- [ ] **Step 1: Xác nhận build artifact từ Task 1**

Run:

```bash
cd /Users/hieunt/learning-reverse
test -f avatar-web/server/dist/db/schema.sql
git show --stat --oneline HEAD
```

Expected: exit 0; build artifact tồn tại và commit HEAD là `fix(fishing): skip ml for instant escape challenges`.

- [ ] **Step 2: Tái lập phân bố deadline từ capture**

Run:

```bash
cd /Users/hieunt/learning-reverse
python3 - <<'PY'
import collections
import glob
import json

paths = glob.glob(
    'avatar-web/server/data/fishing-review-captures/sessions/'
    'live-review-20260912T163337300Z-7b9c767a/raw/*/prediction.json'
)
counts = collections.Counter(json.load(open(path))['timeDelayMs'] for path in paths)
print(dict(sorted(counts.items())))
assert counts == {500: 62, 20000: 38}
PY
```

Expected: in `{500: 62, 20000: 38}` và assertion pass.

- [ ] **Step 3: Kiểm tra control flow không chạm ML**

Run:

```bash
cd /Users/hieunt/learning-reverse
sed -n '3529,3665p' avatar-web/server/src/session/avatarSession.ts
```

Expected: nhánh `timeDelayMs === 500` kết thúc bằng `return` trước cả ba điểm `fishingInferenceClient`, `onFishingInference` và `makeAutoDecision`; source được giữ `undefined`.

- [ ] **Step 4: Kiểm tra working tree sau build**

Run:

```bash
cd /Users/hieunt/learning-reverse
git status --short
git diff --check
```

Expected: build không tạo file tracked ngoài dự kiến; không có whitespace error.

---

### Task 3: Sao lưu, reset thống kê cũ và xác minh live

**Files:**
- Backup: `avatar-web/server/data/avatar-web.db.ml-reset-<timestamp>.bak`
- Modify runtime data only: `avatar-web/server/data/avatar-web.db`, table `avatar_ml_fishing_statistics`

**Interfaces:**
- Consumes: server build của Task 2 và SQLite table `avatar_ml_fishing_statistics(account_id, total_attempts, success_catches, updated_at)`.
- Produces: aggregate ML mới bắt đầu từ `0/0`; dữ liệu backup khôi phục được; log live chứng minh 500ms không gọi ML và 20000ms vẫn gọi ML.

- [ ] **Step 1: Dừng process server local và ghi nhận số liệu trước reset**

Run sau khi dừng `avatar-web/server` đang chạy:

```bash
cd /Users/hieunt/learning-reverse
sqlite3 avatar-web/server/data/avatar-web.db \
  "SELECT account_id,total_attempts,success_catches,updated_at FROM avatar_ml_fishing_statistics ORDER BY account_id;"
```

Expected: không còn process server ghi database; output ghi lại counter hiện có, gồm account 3 nếu row vẫn tồn tại.

- [ ] **Step 2: Tạo backup có timestamp và kiểm tra integrity**

Run:

```bash
cd /Users/hieunt/learning-reverse
db_path="avatar-web/server/data/avatar-web.db"
backup_path="${db_path}.ml-reset-$(date +%Y%m%dT%H%M%S).bak"
cp -p "$db_path" "$backup_path"
sqlite3 "$backup_path" "PRAGMA integrity_check;"
echo "$backup_path"
```

Expected: `PRAGMA integrity_check` in `ok`; output cuối là đường dẫn backup thực tế.

- [ ] **Step 3: Chỉ reset aggregate ML và kiểm tra các bảng khác còn nguyên**

Run:

```bash
cd /Users/hieunt/learning-reverse
db_path="avatar-web/server/data/avatar-web.db"
before_accounts=$(sqlite3 "$db_path" "SELECT COUNT(*) FROM avatar_accounts;")
before_daily=$(sqlite3 "$db_path" "SELECT COALESCE(SUM(catch_count),0) FROM avatar_daily_fishing_statistics;")
sqlite3 "$db_path" "BEGIN IMMEDIATE; DELETE FROM avatar_ml_fishing_statistics; COMMIT;"
after_accounts=$(sqlite3 "$db_path" "SELECT COUNT(*) FROM avatar_accounts;")
after_daily=$(sqlite3 "$db_path" "SELECT COALESCE(SUM(catch_count),0) FROM avatar_daily_fishing_statistics;")
test "$before_accounts" = "$after_accounts"
test "$before_daily" = "$after_daily"
test "$(sqlite3 "$db_path" "SELECT COUNT(*) FROM avatar_ml_fishing_statistics;")" = "0"
```

Expected: exit 0; account count và tổng daily catch không đổi; bảng ML có 0 row.

- [ ] **Step 4: Khởi động server và xác minh challenge 500ms**

Thực hiện trên web local với Auto câu cá và capture review bật:

1. Chờ log có `RX79 deadline 500ms — bỏ qua ML`.
2. Xác nhận không có log inference/capture gắn với RX79 đó.
3. Sau khoảng 500ms, xác nhận log có `đã gửi TX43 mặc định ... không tính ML`.
4. Đọc UI/SQLite và xác nhận `total_attempts` không tăng.
5. Xác nhận vòng câu reset và tiếp tục, không chờ đủ 35 giây.

Expected: challenge 500ms được server chốt nhanh, không tạo capture và không đổi thống kê ML.

- [ ] **Step 5: Xác minh challenge 20000ms**

Tiếp tục chạy đến RX79 20 giây:

1. Xác nhận có đúng một inference result và một capture batch.
2. Xác nhận log gửi `TX43 (ml)` sau humanized delay.
3. Khi RX43 trả về, đọc SQLite:

```bash
cd /Users/hieunt/learning-reverse
sqlite3 avatar-web/server/data/avatar-web.db \
  "SELECT account_id,total_attempts,success_catches,ROUND(100.0*success_catches/total_attempts,1) FROM avatar_ml_fishing_statistics ORDER BY account_id;"
```

Expected: `total_attempts` tăng đúng một cho lượt ML 20 giây; tỷ lệ chỉ dựa trên các lượt ML thật.

- [ ] **Step 6: Chạy soak verification 20 lượt**

Cho Auto câu cá chạy ít nhất 20 RX79 và đối chiếu log:

- Mỗi RX79 500ms có một log bỏ qua và không có inference request.
- Mỗi RX79 20 giây có một inference request.
- `total_attempts` bằng số TX43 có log source `(ml)`, không bằng tổng RX79.
- Không có late TX43, double count, session `rejected` hoặc timeout 35 giây do nhánh 500ms.

Expected: tất cả bốn điều kiện đúng. Nếu một điều kiện sai, dừng triển khai và giữ backup để phục hồi.

- [ ] **Step 7: Hoàn tất plan tracking**

Đánh dấu `- [x]` cho từng step đã hoàn thành trong file plan, chạy:

```bash
cd /Users/hieunt/learning-reverse
git diff --check
git status --short
```

Expected: chỉ file plan thay đổi checkbox sau commit Task 1; database và backup vẫn untracked/ignored, không được add vào git.
