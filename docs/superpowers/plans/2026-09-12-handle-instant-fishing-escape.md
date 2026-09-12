# Xử Lý Cá Chạy Mất Tiêu / Giật Hụt Khi Câu Cá — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chặn TX 43 lạc nhịp từ pending solver, không dừng auto khi dialog "Cá đã chạy mất tiêu rồi", và bỏ trạng thái `rejected` oan cho lượt sổng cá (`idFish < 0`) — tất cả trong `avatar-web/server/src/session/avatarSession.ts`.

**Architecture:** Tái sử dụng cơ chế generation có sẵn (`fishingChallengeGeneration` + Pre-Send Gate đồng bộ trong `handleFishingChallenge`): thêm `cancelPendingFishingChallenge()` chỉ bump generation, gọi ở 3 điểm kết thúc lượt (đầu handler `fishing-success-result`, nhánh dialog sổng cá mới, trước mỗi `quanCau()`). Dialog sổng cá thành nhánh reset phiên tương tự nhánh timeout: log → cancel → `cauCaXong()` → delay 1s → farm check → `startFishingSession` → `continue` (không `return`, không `rejected`).

**Tech Stack:** TypeScript 5.7, Node.js

**Spec:** `docs/superpowers/specs/2026-09-12-handle-instant-fishing-escape-design.md`

## Global Constraints

- Chỉ sửa `avatar-web/server/src/session/avatarSession.ts`; không sửa `isInformationalDialog`/protocol/`GameClient`/ML/Frontend/`FishingRuntimeState` type.
- Cơ chế hủy solver dùng đúng hoá đơn cơ chế generation có sẵn (Pre-Send Gate dòng 3464-3465): không thêm AbortController mới, không reset timer, không await trong gate.
- Nhánh sổng cá trong `runFishingLoop` KHÔNG được `return`/set `status='rejected'`/set `lastError`; phải `continue` và duy trì vòng lặp.
- Handler `fishing-success-result` với `idFish < 0`: chỉ log, KHÔNG set `status='rejected'`, KHÔNG set `lastError`; `status` do vòng lặp tự set ở lượt mới.
- Không đổi timing `FISHING_HUMAN_TIMING`, không tạo/sửa test files.
- GitNexus index đã biết stale + CLI rebuild fail (`@ladybugdb/core` node-gyp `spawnSync /bin/sh ENOENT`) + MCP tool báo input-validation error: mỗi gate impact/detect_changes phải ghi nhận cảnh báo, chạy theo quy trình, rồi bù bằng exhact text search trong task (danh sách gọi/định nghĩa) và `git diff --name-only`/`git diff --check`. Không lấy `UNKNOWN`/stale làm all-clear.
- Build bắt buộc sạch ở bước cuối mỗi task: `npm run build -w avatar-web/server` (chạy từ repo root).

---

### Task 1: `cancelPendingFishingChallenge()` + sửa handler `fishing-success-result`

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts` — thêm method cạnh `delayCancellable` (~dòng 3407), sửa handler X43 (~dòng 1087-1120)

**Interfaces:**
- Consumes: field `fishingChallengeGeneration` (dòng 332), handler `client.on('fishing-success-result')` (dòng 1087), `pushLog`, `emitAutomation`.
- Produces: `private cancelPendingFishingChallenge(): void` — dùng bởi chính Task 1 (handler X43) và Task 2 (nhánh sổng cá, trước `quanCau()`).

- [ ] **Step 1: Chạy stale-index impact gate cho `fishing-success-result` handler scope**

Chạy impact theo quy trình (MCP nếu được, CLI fallback), ghi nhận cảnh báo stale/fail. Rồi bù bằng text search xác nhận phạm vi:

```bash
cd /Users/hieunt/learning-reverse/avatar-web/server && \
rg -n "fishing-success-result|fishingChallengeGeneration" src/session/avatarSession.ts src --glob '*.ts' | head -40
```

Expected: `fishing-success-result` handler (dòng ~1087) và `fishingChallengeGeneration` (dòng 332, 451, 1763, 1792, 1862, 3039, 3434) là toàn bộ chỗ chạm; không có consumer ngoài `avatarSession.ts` sửa được/liên quan đến 2 thay đổi này với impact khác so với mô tả spec.

- [ ] **Step 2: Thêm method `cancelPendingFishingChallenge()`**

Chèn ngay sau method `delayCancellable` (kết thúc dòng ~3407, trước `handleFishingChallenge` dòng 3409):

```ts
  private delayCancellable(ms: number, signal: AbortSignal): Promise<void> {
    // ... giữ nguyên
  }

  /**
   * Hủy hiệu lực mọi pending fishing challenge solver: bump generation để
   * Pre-Send Gate trong handleFishingChallenge chặn TX 43 khi lượt câu đã
   * kết thúc (RX 43 thành công/thất bại, dialog sổng cá, hoặc quăng cần mới).
   */
  private cancelPendingFishingChallenge(): void {
    this.fishingChallengeGeneration += 1;
  }
```

- [ ] **Step 3: Wire vào đầu handler `fishing-success-result` + sửa nhánh `idFish < 0`**

Trong `client.on('fishing-success-result', ...)` (dòng 1087-1120), sau guard `idUser` (dòng 1090-1092) chèn dòng cancel; thay block `else` dòng 1114-1118:

Trước (step này thay 2 đoạn):

```ts
      // CHỈ xử lý kết quả thuộc về chính nhân vật của mình trong hồ!
      if (client.playerId === undefined || ev.idUser !== client.playerId) {
        return;
      }
      if (ev.idFish >= 0) {
```

```ts
      } else {
        this.pushLog(`[câu cá] giật hụt hoặc sổng cá (mã ${ev.idFish})`);
        this.fishingRuntime.status = 'rejected';
        this.fishingRuntime.lastError = `Giật hụt / sổng cá (${ev.idFish})`;
      }
      this.emitAutomation();
```

Sau:

```ts
      // CHỈ xử lý kết quả thuộc về chính nhân vật của mình trong hồ!
      if (client.playerId === undefined || ev.idUser !== client.playerId) {
        return;
      }
      // RX 43 chốt lượt câu (dù bắt được hay sổng) — solver của lượt này không còn hiệu lực
      this.cancelPendingFishingChallenge();
      if (ev.idFish >= 0) {
```

```ts
      } else {
        // Lượt trượt bình thường — không phải lỗi fatal. Vòng lặp runFishingLoop
        // tự reset qua catchResult === false hoặc nhánh dialog sổng cá;
        // không set status='rejected', không set lastError.
        this.pushLog(`[câu cá] giật hụt hoặc sổng cá (mã ${ev.idFish}) — lượt này không bắt được cá`);
      }
      this.emitAutomation();
```

- [ ] **Step 4: Typecheck nhanh**

Run: `npx tsc --noEmit -p /Users/hieunt/learning-reverse/avatar-web/server/tsconfig.json` (nếu workspace có tsconfig riêng; ngược lại `npm run build -w avatar-web/server`)
Expected: KHÔNG lỗi TypeScript (method mới được dùng ngay trong bước này).

- [ ] **Step 5: Text search xác nhận Task 1**

Run:

```bash
rg -n "cancelPendingFishingChallenge" avatar-web/server/src/session/avatarSession.ts
```

Expected: đúng 2 dòng — định nghĩa (1) + gọi trong handler X43 (1).

- [ ] **Step 6: Commit**

```bash
cd /Users/hieunt/learning-reverse && git add avatar-web/server/src/session/avatarSession.ts && \
git commit -m "fix(fishing): cancel pending challenge solver on catch result and keep status on missed catch"
```

> Pre-commit: `git diff --check` (sạch), `git diff --name-only` chỉ `avatar-web/server/src/session/avatarSession.ts`; chạy `detect_changes --scope all` theo quy trình nếu có được, ghi nhận cảnh báo stale.

---

### Task 2: Nhánh dialog sổng cá trong `runFishingLoop` + cancel trước `quanCau()`

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts` — vòng while `runFishingLoop` (dòng ~3103-3227)

**Interfaces:**
- Consumes: `cancelPendingFishingChallenge()` (Task 1), `catchResult: false | string` từ `catchPromise` (dòng 3123-3170), `serviceDueFishingFarm` (dòng 3032), `startFishingSession` (dòng 2862), `delayCancellable` (dòng 3393), `client.cauCaXong()`.
- Produces: hành vi vòng lặp — lượt sổng cá tự reset và quăng tiếp, không `return` (`status` vẫn do vòng lặp quản lý).

- [ ] **Step 1: Cancel trước `client.quanCau()`**

Trong `runFishingLoop`, ngay trước `client.quanCau()` (dòng 3119), sau `this.fishingRuntime.status = 'casting'` hiện có (hoặc ngay trước line 3119, giữ nguyên log):

```ts
        this.fishingRuntime.status = 'casting';
        this.pushLog('[câu cá] đang quăng cần…');
        this.emitAutomation();

        // Lượt câu mới bắt đầu — solver của lượt câu trước (nếu còn ngủ) hết hiệu lực
        this.cancelPendingFishingChallenge();
        client.quanCau();
```

- [ ] **Step 2: Thêm nhánh dialog sổng cá trong xử lý `catchResult` (string)**

Trong khối `if (typeof catchResult === 'string')` (dòng 3173), chèn nhánh mới **ngay sau khối rương đầy** (kết thúc dòng 3192, `}` của `if (castErrText.includes('rương') ...)` gồm cả `continue;`) và **trước** `let castMissingType` (dòng 3194):

```ts
          // Dialog cá chạy mất / sổng cá / trật rồi — server tự chốt lượt hỏng,
          // chỉ cần reset phiên và quăng cần tiếp, KHÔNG dừng auto.
          if (
            castErrText.includes('chạy mất')
            || castErrText.includes('sổng cá')
            || castErrText.includes('trật rồi')
          ) {
            this.pushLog(`[câu cá] ${catchResult} — bỏ qua, quăng cần tiếp…`);
            this.cancelPendingFishingChallenge();
            try { client.cauCaXong(); } catch { /* bỏ qua */ }
            await this.delayCancellable(1000, signal);
            if (this.fishingFarmDue) {
              const action = await this.serviceDueFishingFarm(client, generation, epoch, signal);
              if (action === 'stop') return;
              continue;
            }
            if (!(await this.startFishingSession(client, generation, epoch, signal))) return;
            continue;
          }
```

- [ ] **Step 3: Typecheck nhanh**

Run: `npx tsc --noEmit -p /Users/hieunt/learning-reverse/avatar-web/server/tsconfig.json` (nếu workspace có tsconfig riêng; ngược lại `npm run build -w avatar-web/server`)
Expected: KHÔNG lỗi TypeScript.

- [ ] **Step 4: Text search xác nhận Task 2**

Run:

```bash
cd /Users/hieunt/learning-reverse/avatar-web/server && \
rg -n "cancelPendingFishingChallenge|chạy mất|sổng cá|trật rồi" src/session/avatarSession.ts
```

Expected: `cancelPendingFishingChallenge` đúng 4 dòng (định nghĩa + X43 handler + trước `quanCau()` + nhánh sổng cá); từ khóa `chạy mất/sổng cá/trật rồi` xuất hiện đúng trong khối so sánh nhánh mới (3 dòng).

- [ ] **Step 5: Commit**

```bash
cd /Users/hieunt/learning-reverse && git add avatar-web/server/src/session/avatarSession.ts && \
git commit -m "fix(fishing): keep auto fishing alive on escaped-fish dialog and reset per-cast challenge"
```

> Pre-commit: `git diff --check`, `git diff --name-only` (chỉ 1 file), `detect_changes --scope all` theo quy trình stale-index, bù text search.

---

### Task 3: Build toàn workspace + verify tổng hợp

**Files:**
- Không sửa code — verify duy nhất.

**Interfaces:**
- Consumes: kết quả Task 1 + Task 2.

- [ ] **Step 1: Build bắt buộc**

Run: `cd /Users/hieunt/learning-reverse && npm run build -w avatar-web/server`
Expected: TypeScript compile SẠCH (exit 0, không lỗi/không warning mới; nếu build ra output, xác nhận file js mới được sinh).

- [ ] **Step 2: Verify toàn bộ 3 fix qua text search**

Run:

```bash
cd /Users/hieunt/learning-reverse/avatar-web/server && \
rg -n -A 3 "idFish >= 0" src/session/avatarSession.ts | head -20 && \
rg -n "Giật hụt / sổng cá \(\$\{ev\.idFish\}\)\)" src/session/avatarSession.ts ; \
rg -n "status = 'rejected'" src/session/avatarSession.ts
```

Expected: 
- Nhánh `else` của `idFish >= 0` = log mới, không còn `status = 'rejected'` (pattern cũ "Giật hụt / sổng cá" không còn `lastError`).
- `status = 'rejected'` còn lại chỉ ở các chỗ **ngoài** 3 fix: `runFishingLoop` rương đầy fail (:3180), fallback dialog lạ (:3224), `enterFishingPark` (:2834), `startFishingSession` (:2954, :2987, :2999, :3008) — KHÔNG còn ở handler X43.

- [ ] **Step 3: `git diff --check` + `git log` xác nhận 2 commimts**

Run: `cd /Users/hieunt/learning-reverse && git diff --check && git log --oneline -3`
Expected: `git diff --check` sạch; 2 commit mới với thông điệp của Task 1 và Task 2 trên đầu.

- [ ] **Step 4: Detect changes theo quy trình GitNexus**

Chạy `detect_changes({scope: "all"})` (MCP nếu được) hoặc `node .gitnexus/run.cjs detect-changes --scope all --repo .` (CLI fallback). Nếu index stale/truncated/partial hoặc CLI fail (như đã biết), ghi nhận là chưa giải quyết và bù bằng:
- `git diff --check`
- `git diff --name-only` — phải chỉ liệt kê `avatar-web/server/src/session/avatarSession.ts`
- Text search 3 fix ở Step 2
Kết luận: cả 3 lỗi trong spec đã được sửa, build sạch, commit kèm đầy đủ cảnh báo stale-index.

- [ ] **Step 5: Báo cáo hoàn thành cho user (không cần commit)**

Tóm tắt: 3 fix (race TX43, dialog sổng cá, UI rejected oan) + build output + 2 commits + lưu ý GitNexus stale + phần cần verify manual (video) theo Verification Plan spec.