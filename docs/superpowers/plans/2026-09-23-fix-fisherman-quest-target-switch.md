# Fix Fisherman Quest Target Switch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khắc phục lỗi chế độ `auto_fisherman_quest` không tự động nhận biết nhiệm vụ mới và không chuyển map câu cá khi chuyển bước nhiệm vụ.

**Architecture:** Chuyển `refreshProgressQuests` sang async `Promise<void>` có hỗ trợ cờ `force`; thêm cơ chế `sleepOrQuestWake` phản ứng tức thì với event `'quests'` của `GameClient`; kiểm tra trạng thái bộ nhớ RAM ngay ở đầu mỗi tick 5s trong `runFishermanQuestLoop` để hủy câu map cũ và chuyển map mới ngay lập tức.

**Tech Stack:** TypeScript, Node.js, EventEmitter, Avatar GameClient protocol.

**Spec:** `docs/superpowers/specs/2026-09-23-fix-fisherman-quest-target-switch-design.md`

## Global Constraints
- KHÔNG viết test, KHÔNG tạo test files (tuân thủ quy tắc KHÔNG TDD trong CLAUDE.md).
- Trước khi sửa mỗi symbol, chạy `gitnexus_impact` kiểm tra rủi ro.
- Trước mỗi commit, chạy `gitnexus_detect_changes()` để kiểm tra phạm vi.
- Không thay đổi mapping cá trong `fishermanQuest.ts`.
- Log user-facing bằng tiếng Việt có tiền tố `[thợ câu]`.

---

### Task 1: Chuyển đổi `refreshProgressQuests` sang async Promise với cờ `force`

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts:465-469`

**Interfaces:**
- Consumes: `client.refreshProgressQuests(force?: boolean): Promise<void>`
- Produces: `async refreshProgressQuests(force = false): Promise<void>`

- [x] **Step 1: Cập nhật hàm `refreshProgressQuests` trong `avatarSession.ts`**
  Thay thế:
  ```typescript
  refreshProgressQuests(): void {
    if (this.client?.status === 'online') {
      void this.client.refreshProgressQuests();
    }
  }
  ```
  Thành:
  ```typescript
  async refreshProgressQuests(force = false): Promise<void> {
    if (this.client?.status === 'online') {
      await this.client.refreshProgressQuests(force);
    }
  }
  ```

- [x] **Step 2: Cập nhật vị trí quét ban đầu trong `runFishermanQuestLoop`**
  Tại dòng ~2571:
  ```typescript
  this.updateFishermanQuest({ phase: 'scanning', lastError: null });
  this.emitAutomation();
  await this.refreshProgressQuests(true);
  await this.sleepAbortable(1000, signal);
  ```

- [x] **Step 3: Kiểm tra biên dịch**
  Run: `cd avatar-web/server && npx tsc --noEmit`
  Expected: Không có lỗi type.

- [x] **Step 4: Commit thay đổi**
  Run: `gitnexus_detect_changes({scope: "all"})`
  `git commit -m "fix(quest): make refreshProgressQuests awaitable with force flag"`

---

### Task 2: Cơ chế Event-driven Wake-up và kiểm tra bộ nhớ tức thì trong `runFishermanQuestLoop`

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts`

**Interfaces:**
- Consumes: `client.on('quests')`, `client.fishermanQuestState`, `this.fishermanQuestRuntime`
- Produces: `wakeFishermanQuest()`, `sleepOrQuestWake(ms, signal)`

- [x] **Step 1: Thêm `fishermanQuestWake` và `sleepOrQuestWake`**
  Thêm field và phương thức vào `AvatarSession`:
  ```typescript
  private fishermanQuestWake?: () => void;

  private wakeFishermanQuest(): void {
    const wake = this.fishermanQuestWake;
    this.fishermanQuestWake = undefined;
    wake?.();
  }

  private sleepOrQuestWake(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      let timer: NodeJS.Timeout | undefined;
      const cleanup = () => {
        if (timer) this.clearTimeoutFn(timer);
        signal.removeEventListener('abort', onDone);
        if (this.fishermanQuestWake === onDone) {
          this.fishermanQuestWake = undefined;
        }
      };
      const onDone = () => {
        cleanup();
        resolve();
      };
      signal.addEventListener('abort', onDone, { once: true });
      this.fishermanQuestWake = onDone;
      timer = this.setTimeoutFn(onDone, ms);
    });
  }
  ```

- [x] **Step 2: Kích hoạt `wakeFishermanQuest` khi có event `quests`**
  Trong block listener `client.on('quests', ...)` (~ dòng 1131):
  ```typescript
  client.on('quests', () => {
    if (this.isCurrent(client, epoch)) {
      this.emit('quests', this.getQuestOverview());
      this.wakeFishermanQuest();
    }
  });
  ```

- [x] **Step 3: Viết lại vòng lặp chờ trong `runFishermanQuestLoop`**
  Thay thế đoạn `for (;;)` hiện tại bằng logic kiểm tra RAM ở đầu tick và sync chủ động:
  ```typescript
  for (;;) {
    await this.sleepOrQuestWake(5_000, signal);
    if (!alive()) return;

    // 1. Kiểm tra ngay trong bộ nhớ RAM
    const fresh = client.fishermanQuestState;
    if (!fresh || fresh.title !== quest.title || fresh.step !== quest.step) {
      this.pushLog(`[thợ câu] phát hiện nhiệm vụ thay đổi (${quest.title} → ${fresh?.title ?? 'mới'}), chuyển mục tiêu…`);
      break;
    }
    const freshCond = fresh.conditions.find((c) => c.name === next.name);
    if (!freshCond || freshCond.isDone || freshCond.current >= freshCond.total) {
      this.pushLog(`[thợ câu] điều kiện "${next.name}" đã hoàn thành trên server (${freshCond?.current ?? 0}/${freshCond?.total ?? next.total}).`);
      break;
    }

    // 2. Kiểm tra tiến độ local
    const runtime = this.fishermanQuestRuntime;
    if (runtime.needed > 0 && runtime.caught >= runtime.needed) {
      this.pushLog(`[thợ câu] đã câu đủ ${runtime.caught}/${runtime.needed} ${runtime.targetFishName} theo bộ đếm local.`);
      break;
    }

    // 3. Đồng bộ định kỳ (mỗi 5 con cá mới hoặc sau 60s)
    const dueCount = runtime.caught - syncedCaught >= 5;
    const dueTime = this.now() - lastSyncAt >= 60_000;
    if (!dueCount && !dueTime) continue;

    this.updateFishermanQuest({ phase: 'syncing' });
    this.emitAutomation();
    await this.refreshProgressQuests(true);
    await this.sleepAbortable(1000, signal);
    if (!alive()) return;

    lastSyncAt = this.now();
    syncedCaught = this.fishermanQuestRuntime.caught;

    const freshAfterSync = client.fishermanQuestState;
    if (!freshAfterSync || freshAfterSync.title !== quest.title || freshAfterSync.step !== quest.step) {
      this.pushLog(`[thợ câu] sau đồng bộ: nhiệm vụ đã chuyển sang ${freshAfterSync?.title ?? 'mới'}.`);
      break;
    }
    const freshCondAfterSync = freshAfterSync.conditions.find((c) => c.name === next.name);
    if (!freshCondAfterSync || freshCondAfterSync.isDone || freshCondAfterSync.current >= freshCondAfterSync.total) {
      this.pushLog(`[thợ câu] server báo xong "${next.name}" (local=${this.fishermanQuestRuntime.caught}).`);
      break;
    }
    if (freshCondAfterSync.current > next.current) {
      this.pushLog(`[thợ câu] tiến độ server: ${freshCondAfterSync.current}/${freshCondAfterSync.total}.`);
    }
    this.updateFishermanQuest({ phase: 'fishing' });
    this.emitAutomation();
  }
  ```

- [x] **Step 4: Kiểm tra biên dịch**
  Run: `cd avatar-web/server && npx tsc --noEmit`
  Expected: Build thành công không lỗi.

- [x] **Step 5: Commit thay đổi**
  Run: `gitnexus_detect_changes({scope: "all"})`
  `git commit -m "fix(quest): add event-driven quest wake and zero-latency state check"`

---

### Task 3: Build và xác minh toàn hệ thống

**Files:**
- None (Verification)

- [x] **Step 1: Build production server**
  Run: `cd avatar-web/server && npm run build`
  Expected: Build thành công không cảnh báo hoặc lỗi.

- [x] **Step 2: Kiểm tra GitNexus scope**
  Run: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})`
  Expected: Chỉ chứa các thay đổi mong muốn trên `avatarSession.ts`.
