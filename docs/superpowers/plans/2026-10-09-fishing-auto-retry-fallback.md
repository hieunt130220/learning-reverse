# Tự Động Thử Lại và Chuyển Sang Auto Farm Khi Auto Câu Cá & Thợ Câu Lỗi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm cơ chế tự động dừng và thử lại từ đầu tối đa 3 lần khi chế độ auto câu cá hoặc làm nhiệm vụ thợ câu gặp lỗi khiến dừng câu, và tự động chuyển sang chế độ auto nông trại (`auto_farm`) nếu vẫn lỗi sau 3 lần.

**Architecture:** Bổ sung bộ đếm `fishingRetryCount` (tối đa 3) và phương thức điều phối `handleFishingFailure` trong `AvatarSession`. Khi phát hiện lỗi dừng câu ở `auto_fishing` hoặc `auto_fisherman_quest`, hệ thống dừng sạch auto hiện tại (`stopActiveAutomation`), chờ 5 giây rồi gọi `startDesiredAutomation` để khởi động lại từ đầu; nếu vượt quá 3 lần lỗi thì gọi `switchAutomationMode` chuyển sang `auto_farm`.

**Tech Stack:** TypeScript, Node.js, `AvatarSession` coordinator.

**Spec:** `docs/superpowers/specs/2026-10-09-fishing-auto-retry-fallback-design.md`

## Global Constraints
- Tuân thủ quy tắc CLAUDE.md: KHÔNG thực hiện TDD (không tạo test files mới, không viết test trước).
- Trước khi chỉnh sửa code: Chạy `impact({ target, direction: "upstream" })` của GitNexus (đã phân tích: `startFishingLoop` và `startFishermanQuestLoop` là CRITICAL risk, giữ nguyên interface/chữ ký hàm).
- Khi retry: Bắt buộc gọi dừng auto trước (`await this.stopActiveAutomation(generation)`), không khởi động chồng chéo.
- Trước khi commit: Chạy kiểm tra graph thay đổi qua `detect_changes({ scope: "all" })`.

## Review Focus
- Trường hợp người dùng chủ động bấm Dừng hoặc chuyển chế độ bằng tay: Không được kích hoạt retry (kiểm tra `abort.signal.aborted` và `desiredMode`).
- Trường hợp mất kết nối mạng (socket disconnect): Không được can thiệp vào tiến trình reconnect mặc định của session.
- Trường hợp câu cá thành công hoặc quest có tiến triển: Bộ đếm retry phải được reset về 0 để tránh trừ oan lần thử.
- Trường hợp vòng lặp câu cá con trong quest thợ câu bị lỗi: Vòng lặp cha phải phát hiện ngay lập tức thay vì treo chờ vĩnh viễn.
- Trường hợp vượt quá 3 lần lỗi: Phải chuyển sang `auto_farm` an toàn bằng `switchAutomationMode` và reset `fishingRetryCount = 0`.

---

### Task 1: Thêm State `fishingRetryCount` và Phương Thức `handleFishingFailure` Trong `AvatarSession`

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts`

**Interfaces:**
- Consumes: `this.isAutomationGenerationCurrent`, `this.isCurrent`, `this.stopActiveAutomation`, `this.startDesiredAutomation`, `this.switchAutomationMode`, `this.pushLog`, `this.sleepAbortable`
- Produces: `private fishingRetryCount: number`, `private static readonly MAX_FISHING_RETRIES: number`, `private handleFishingFailure(client, generation, epoch, reason, mode): Promise<void>`

- [x] **Step 1: Khai báo thuộc tính và hằng số retry trong class `AvatarSession`**

Tại vùng khai báo private field của `AvatarSession` (quanh dòng 385):
```typescript
  private fishingRetryCount = 0;
  private static readonly MAX_FISHING_RETRIES = 3;
```

- [x] **Step 2: Thêm reset `fishingRetryCount = 0` tại các điểm mốc thành công và chuyển mode**

1. Trong `switchAutomationMode`: Khi người dùng chủ động kích hoạt chuyển mode:
```typescript
this.fishingRetryCount = 0;
```
2. Trong sự kiện `client.on('fishing-success-result')` (quanh dòng 1285): Khi câu thành công bất kỳ con cá nào:
```typescript
this.fishingRetryCount = 0;
```
3. Trong `runFishermanQuestLoop` (quanh dòng 2856): Khi server ghi nhận tiến độ điều kiện tăng lên:
```typescript
this.fishingRetryCount = 0;
```

- [x] **Step 3: Cài đặt phương thức `handleFishingFailure`**

Thêm phương thức xử lý lỗi tập trung vào `AvatarSession`:
```typescript
  /**
   * Xử lý khi auto câu cá hoặc nhiệm vụ thợ câu gặp lỗi khiến dừng câu.
   * Dừng auto hiện tại, khởi động lại từ đầu tối đa 3 lần. Nếu vẫn lỗi thì chuyển sang auto_farm.
   */
  private async handleFishingFailure(
    client: GameClient,
    generation: number,
    epoch: number,
    reason: string,
    mode: 'auto_fishing' | 'auto_fisherman_quest',
  ): Promise<void> {
    if (
      !this.isAutomationGenerationCurrent(generation)
      || !this.isCurrent(client, epoch)
      || client.status !== 'online'
      || this.desiredMode !== mode
    ) {
      return;
    }

    const modeTag = mode === 'auto_fishing' ? '[câu cá]' : '[thợ câu]';

    if (this.fishingRetryCount < AvatarSession.MAX_FISHING_RETRIES) {
      this.fishingRetryCount += 1;
      this.pushLog(
        `${modeTag} Gặp lỗi khiến dừng câu: ${reason}. Đã dừng auto, khởi động lại từ đầu (lần ${this.fishingRetryCount}/${AvatarSession.MAX_FISHING_RETRIES}) sau 5s...`,
      );

      // BẮT BUỘC DỪNG AUTO TRƯỚC: hủy controller, timer, farm schedule, gửi cauCaXong()
      await this.stopActiveAutomation(generation);

      await this.sleepAbortable(5_000, new AbortController().signal);

      if (
        !this.isAutomationGenerationCurrent(generation)
        || !this.isCurrent(client, epoch)
        || client.status !== 'online'
        || this.desiredMode !== mode
      ) {
        return;
      }

      this.pushLog(`${modeTag} Bắt đầu khởi động lại chế độ từ đầu (lần ${this.fishingRetryCount})...`);
      this.fishingRuntime.status = 'idle';
      this.fishingRuntime.lastError = null;

      await this.startDesiredAutomation(client, generation, epoch);
    } else {
      this.pushLog(
        `${modeTag} Đã thử lại ${AvatarSession.MAX_FISHING_RETRIES} lần nhưng vẫn gặp lỗi ("${reason}"). Chuyển sang chế độ tự động nông trại.`,
      );
      this.fishingRetryCount = 0;
      this.fishingRuntime.status = 'idle';
      this.fishingRuntime.lastError = null;

      void this.switchAutomationMode({
        desiredMode: 'auto_farm',
        findNpcConfig: this.findNpcConfig,
        fishingConfig: this.fishingConfig,
        miningConfig: this.miningConfig,
        mazeConfig: this.mazeConfig,
        schoolConfig: this.schoolConfig,
        location: this.automationLocation,
      });
    }
  }
```

- [x] **Step 4: Verify syntax & build**

Run: `cd avatar-web/server && npm run build`  
Expected: Build thành công không có lỗi type error.

- [x] **Step 5: Commit**

```bash
git add avatar-web/server/src/session/avatarSession.ts
git commit -m "feat(session): add fishing retry counter and failure handler"
```

---

### Task 2: Tích Hợp Cơ Chế Thử Lại Vào `auto_fishing`

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts`

**Interfaces:**
- Consumes: `this.startFishingLoop`, `this.runFishingLoop`, `this.handleFishingFailure`
- Produces: Phát hiện lỗi dừng câu trong `startFishingLoop` và kích hoạt `handleFishingFailure` khi ở `auto_fishing`.

- [x] **Step 1: Cập nhật `startFishingLoop` để bắt lỗi và phát hiện dừng bất thường**

Trong `startFishingLoop` (quanh dòng 2640-2665):
Ghi nhận `failureReason`:
```typescript
  private startFishingLoop(client: GameClient, generation: number, epoch: number): void {
    this.cancelFishingFarmSchedule();
    if (this.fishingAbortController) {
      this.fishingAbortController.abort();
    }
    const abort = new AbortController();
    this.fishingAbortController = abort;

    void (async () => {
      let failureReason: string | null = null;
      try {
        await this.runFishingLoop(client, generation, epoch, abort.signal);
      } catch (err) {
        failureReason = (err as Error).message;
        if (
          !abort.signal.aborted
          && this.fishingAbortController === abort
          && this.isAutomationGenerationCurrent(generation)
          && this.isCurrent(client, epoch)
        ) {
          this.pushLog(`[câu cá] lỗi vòng lặp: ${failureReason}`);
        }
      } finally {
        if (this.fishingAbortController === abort) {
          this.cancelFishingFarmSchedule();
          this.fishingAbortController = undefined;
        }
      }

      // Nếu vòng lặp câu cá kết thúc do lỗi khi đang ở mode auto_fishing (không phải do user abort hoặc disconnect)
      if (
        !abort.signal.aborted
        && this.desiredMode === 'auto_fishing'
        && this.isAutomationGenerationCurrent(generation)
        && this.isCurrent(client, epoch)
        && client.status === 'online'
      ) {
        if (this.fishingRuntime.status === 'rejected' || failureReason !== null) {
          const reason = failureReason ?? this.fishingRuntime.lastError ?? 'Lỗi không xác định';
          void this.handleFishingFailure(client, generation, epoch, reason, 'auto_fishing');
        }
      }
    })();
  }
```

- [x] **Step 2: Verify build**

Run: `cd avatar-web/server && npm run build`  
Expected: Build thành công không có lỗi type error.

- [x] **Step 3: Commit**

```bash
git add avatar-web/server/src/session/avatarSession.ts
git commit -m "feat(session): trigger retry and fallback on auto_fishing failure"
```

---

### Task 3: Tích Hợp Cơ Chế Thử Lại Vào `auto_fisherman_quest`

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts`

**Interfaces:**
- Consumes: `this.startFishermanQuestLoop`, `this.runFishermanQuestLoop`, `this.handleFishingFailure`
- Produces: Phát hiện lỗi dừng câu hoặc lỗi quest trong `runFishermanQuestLoop`/`startFishermanQuestLoop` và kích hoạt `handleFishingFailure`.

- [x] **Step 1: Phát hiện lỗi vòng lặp câu cá con và lỗi giải mã quest trong `runFishermanQuestLoop`**

1. Tại vòng lặp `for (;;)` trong `runFishermanQuestLoop` (quanh dòng 2810):
Kiểm tra nếu `this.fishingRuntime.status === 'rejected'`:
```typescript
        // Kiểm tra nếu vòng lặp câu cá bên dưới bị lỗi dừng lại (status === 'rejected')
        if (this.fishingRuntime.status === 'rejected') {
          const reason = this.fishingRuntime.lastError ?? 'Vòng lặp câu cá bị từ chối';
          this.pushLog(`[thợ câu] phát hiện vòng lặp câu cá bị lỗi: ${reason}`);
          this.updateFishermanQuest({ phase: 'stopped', lastError: reason });
          this.emitAutomation();
          throw new Error(reason);
        }
```

2. Tại bước phân giải mục tiêu cá `resolveFishQuestTarget` (quanh dòng 2774):
Khi không nhận diện được cá:
```typescript
      if (!resolved.ok) {
        const message = `Không nhận diện được cá "${resolved.unknownName}" trong quest "${quest.title}"`;
        this.pushLog(`[thợ câu] ${message}, kích hoạt thử lại/fallback.`);
        this.updateFishermanQuest({
          phase: 'stopped',
          lastError: message,
          targetFishName: next.name,
          targetFishId: null,
          targetMap: null,
        });
        this.emitAutomation();
        throw new Error(message);
      }
```

- [x] **Step 2: Cập nhật `startFishermanQuestLoop` để kích hoạt `handleFishingFailure`**

Trong `startFishermanQuestLoop` (quanh dòng 2705):
```typescript
  private startFishermanQuestLoop(client: GameClient, generation: number, epoch: number): void {
    this.fishermanQuestAbort?.abort();
    this.wakeFishermanQuest();
    const abort = new AbortController();
    this.fishermanQuestAbort = abort;
    void (async () => {
      let questError: string | null = null;
      try {
        await this.runFishermanQuestLoop(client, generation, epoch, abort.signal);
      } catch (err) {
        questError = (err as Error).message;
        if (
          !abort.signal.aborted
          && this.fishermanQuestAbort === abort
          && this.isAutomationGenerationCurrent(generation)
          && this.isCurrent(client, epoch)
        ) {
          this.pushLog(`[thợ câu] lỗi vòng lặp: ${questError}`);
          this.updateFishermanQuest({ phase: 'stopped', lastError: questError });
          this.emitAutomation();
        }
      } finally {
        if (this.fishermanQuestAbort === abort) this.fishermanQuestAbort = undefined;
      }

      // Nếu quest kết thúc do lỗi khi đang ở mode auto_fisherman_quest (không phải do user abort hoặc disconnect)
      if (
        !abort.signal.aborted
        && this.desiredMode === 'auto_fisherman_quest'
        && this.isAutomationGenerationCurrent(generation)
        && this.isCurrent(client, epoch)
        && client.status === 'online'
      ) {
        if (this.fishermanQuestRuntime.phase === 'stopped' || questError !== null) {
          const reason = questError ?? this.fishermanQuestRuntime.lastError ?? 'Lỗi không xác định';
          void this.handleFishingFailure(client, generation, epoch, reason, 'auto_fisherman_quest');
        }
      }
    })();
  }
```

- [x] **Step 3: Verify build**

Run: `cd avatar-web/server && npm run build`  
Expected: Build thành công không có lỗi type error.

- [x] **Step 4: Commit**

```bash
git add avatar-web/server/src/session/avatarSession.ts
git commit -m "feat(session): trigger retry and fallback on auto_fisherman_quest failure"
```

---

### Task 4: Kiểm Tra Toàn Diện & Graph Change Analysis

**Files:**
- None (Verification & Review)

**Interfaces:**
- Consumes: Test suites hiện tại, GitNexus CLI/MCP

- [x] **Step 1: Chạy toàn bộ test suites hiện tại của `avatarSession.test.ts`**

Run: `cd avatar-web/server && npm test -- src/session/avatarSession.test.ts`  
Expected: Toàn bộ 275 tests PASS, 0 fail.

- [x] **Step 2: Phân tích thay đổi đồ thị GitNexus trước khi hoàn tất**

Run GitNexus tool `detect_changes({ scope: "all" })`  
Expected: Không có cycle mới, quan sát các execution flow bị tác động (`startFishingLoop`, `startFishermanQuestLoop`).

- [x] **Step 3: Cập nhật tài liệu / checklist hoàn tất plan**
