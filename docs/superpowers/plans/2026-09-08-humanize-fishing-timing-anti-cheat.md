# Humanize Fishing Timing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mô phỏng nhịp độ bấm phím và nghỉ tay tự nhiên của con người trong auto fishing để ngăn chặn server AvatarHD anti-cheat ngắt kết nối.

**Architecture:** Bổ sung hằng số cấu hình thời gian và hàm ngẫu nhiên `randomBetween`; đưa độ trễ giải mini-game (perception delay + per-key typing delay) vào `handleFishingChallenge`; thêm jitter ngẫu nhiên cho post-catch delay và inter-cast delay kết hợp cơ chế nghỉ micro-break định kỳ vào `runFishingLoop`.

**Tech Stack:** TypeScript, Node.js, AbortSignal

**Spec:** `docs/superpowers/specs/2026-09-08-humanize-fishing-timing-anti-cheat-design.md`

## Global Constraints
- Không viết test trước (no TDD) theo quy định bắt buộc của CLAUDE.md.
- Mọi khoảng trễ (delay) PHẢI sử dụng `this.delayCancellable(ms, signal)` để hủy tức thời khi user tắt hoặc chuyển mode.
- Cổng kiểm tra trước khi gửi `TX 43` (Pre-Send Gate) phải được bảo vệ nghiêm ngặt sau khoảng chờ async.
- Tuân thủ quy tắc GitNexus (`gitnexus_impact` trước khi sửa, `gitnexus_detect_changes` trước khi commit).

---

### Task 1: Định nghĩa hằng số thời gian và hàm helper ngẫu nhiên

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts:180-210`

**Interfaces:**
- Consumes: None
- Produces: `FISHING_HUMAN_TIMING`, `randomBetween(min: number, max: number): number`

- [x] **Step 1: Khai báo hằng số và helper ngẫu nhiên**
  Thêm hằng số `FISHING_HUMAN_TIMING` và hàm `randomBetween` trong `avatarSession.ts`:
  ```typescript
  export const FISHING_HUMAN_TIMING = {
    /** Trễ nhận diện ban đầu khi bảng mini-game xuất hiện (ms) */
    PERCEPTION_MIN_MS: 700,
    PERCEPTION_MAX_MS: 1200,

    /** Trễ mô phỏng bấm từng phím mũi tên (ms / phím) */
    PER_KEY_MIN_MS: 300,
    PER_KEY_MAX_MS: 520,

    /** Trễ xem thông tin cá / animation kéo cần lên trước khi gửi TX 44 (ms) */
    POST_CATCH_MIN_MS: 1800,
    POST_CATCH_MAX_MS: 3200,

    /** Jitter ngẫu nhiên cộng thêm vào castDelayMs giữa 2 lần quăng cần (ms) */
    CAST_JITTER_MIN_MS: 500,
    CAST_JITTER_MAX_MS: 2000,

    /** Khoảng số lượt câu trước khi nghỉ tay định kỳ */
    MICRO_BREAK_INTERVAL_MIN_CATCHES: 8,
    MICRO_BREAK_INTERVAL_MAX_CATCHES: 14,

    /** Thời gian nghỉ tay mô phỏng người chơi uống nước/xem đồ (ms) */
    MICRO_BREAK_MIN_MS: 6000,
    MICRO_BREAK_MAX_MS: 12000,
  } as const;

  function randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  ```

- [x] **Step 2: Chạy kiểm tra biên dịch**
  Run: `npm run build -w avatar-web/server`
  Expected: Build thành công không có lỗi type.

---

### Task 2: Áp dụng Humanized Solving Delay vào `handleFishingChallenge`

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts:1925-1975`

**Interfaces:**
- Consumes: `FISHING_HUMAN_TIMING`, `randomBetween`, `this.fishingAbortController?.signal`
- Produces: Delay tự nhiên 2.5s–5.5s trước khi gửi gói `TX 43`

- [x] **Step 1: Cập nhật hàm `handleFishingChallenge`**
  Trong khối `.then(async (decision) => { ... })`:
  1. Kiểm tra điều kiện hợp lệ ban đầu của decision (`decision.status === 'answer'`).
  2. Tính toán tổng delay mô phỏng người:
     ```typescript
     const perception = randomBetween(
       FISHING_HUMAN_TIMING.PERCEPTION_MIN_MS,
       FISHING_HUMAN_TIMING.PERCEPTION_MAX_MS,
     );
     const perKey = randomBetween(
       FISHING_HUMAN_TIMING.PER_KEY_MIN_MS,
       FISHING_HUMAN_TIMING.PER_KEY_MAX_MS,
     );
     const totalSolvingDelay = perception + decision.answer.length * perKey;
     ```
  3. Lấy `abortSignal` từ `this.fishingAbortController?.signal`. Nếu có, chờ `await this.delayCancellable(totalSolvingDelay, abortSignal)`.
  4. Thực hiện Pre-Send Gate kiểm tra lại generation, epoch, mode, client status trước khi gọi `client.finishFishing(decision.answer)`.
  5. Ghi log rõ thời gian giải: `this.pushLog(`[câu cá] giải mini-game (${decision.answer.length} phím) sau ${(totalSolvingDelay / 1000).toFixed(2)}s`);`.

- [x] **Step 2: Kiểm tra biên dịch**
  Run: `npm run build -w avatar-web/server`
  Expected: Build thành công không có lỗi cú pháp.

---

### Task 3: Áp dụng Jitter và Micro-break vào `runFishingLoop`

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts:1820-1875`

**Interfaces:**
- Consumes: `FISHING_HUMAN_TIMING`, `randomBetween`, `signal`
- Produces: Post-catch jitter (1.8s–3.2s), inter-cast jitter (castDelay + 0.5s–2s), micro-break (6s–12s)

- [x] **Step 1: Khởi tạo biến theo dõi lượt câu cho micro-break**
  Trước vòng lặp `while (...)` trong `runFishingLoop`:
  ```typescript
  let catchesSinceBreak = 0;
  let nextBreakThreshold = randomBetween(
    FISHING_HUMAN_TIMING.MICRO_BREAK_INTERVAL_MIN_CATCHES,
    FISHING_HUMAN_TIMING.MICRO_BREAK_INTERVAL_MAX_CATCHES,
  );
  ```

- [x] **Step 2: Cập nhật delay kéo cá sau `await catchPromise`**
  Thay thế `await this.delayCancellable(1500, signal);` bằng:
  ```typescript
  const postCatchDelay = randomBetween(
    FISHING_HUMAN_TIMING.POST_CATCH_MIN_MS,
    FISHING_HUMAN_TIMING.POST_CATCH_MAX_MS,
  );
  await this.delayCancellable(postCatchDelay, signal);
  ```

- [x] **Step 3: Cập nhật nghỉ giữa các lượt quăng và micro-break**
  Sau khi hoàn tất `donePromise` (TX 44 -> RX 44):
  ```typescript
  catchesSinceBreak++;
  if (catchesSinceBreak >= nextBreakThreshold) {
    const breakMs = randomBetween(
      FISHING_HUMAN_TIMING.MICRO_BREAK_MIN_MS,
      FISHING_HUMAN_TIMING.MICRO_BREAK_MAX_MS,
    );
    this.pushLog(`[câu cá] nghỉ tay ${(breakMs / 1000).toFixed(1)}s mô phỏng người chơi…`);
    await this.delayCancellable(breakMs, signal);
    catchesSinceBreak = 0;
    nextBreakThreshold = randomBetween(
      FISHING_HUMAN_TIMING.MICRO_BREAK_INTERVAL_MIN_CATCHES,
      FISHING_HUMAN_TIMING.MICRO_BREAK_INTERVAL_MAX_CATCHES,
    );
  }

  this.fishingRuntime.status = 'resting';
  this.emitAutomation();

  const restJitter = randomBetween(
    FISHING_HUMAN_TIMING.CAST_JITTER_MIN_MS,
    FISHING_HUMAN_TIMING.CAST_JITTER_MAX_MS,
  );
  await this.delayCancellable(config.castDelayMs + restJitter, signal);
  ```

- [x] **Step 4: Kiểm tra biên dịch**
  Run: `npm run build -w avatar-web/server`
  Expected: Server build sạch 100%.

---

### Task 4: Kiểm tra tác động GitNexus, Xác minh Live & Commit

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts`

- [x] **Step 1: Chạy `gitnexus_detect_changes()`**
  Xác minh chỉ những symbol dự kiến bị ảnh hưởng.

- [x] **Step 2: Test live trực tiếp trên account 3**
  1. Bật auto fishing qua API POST `/api/accounts/3/automation/start`.
  2. Đo đạc traffic:
     - Kiểm tra khoảng cách `RX 79` -> `TX 43`: phải đạt từ **2.5s – 5.5s**.
     - Kiểm tra khoảng cách `RX 43` -> `TX 44`: biến thiên từ **1.8s – 3.2s**.
     - Kiểm tra tính ổn định: câu liên tục qua nhiều vòng mà không bị ngắt kết nối (`remote-end`).
  3. Dừng auto fishing an toàn qua API POST `/api/accounts/3/automation/stop`.

- [x] **Step 3: Commit code**
  Commit message: `fix(fishing): humanize fishing reaction delays to prevent server anti-cheat disconnect`
