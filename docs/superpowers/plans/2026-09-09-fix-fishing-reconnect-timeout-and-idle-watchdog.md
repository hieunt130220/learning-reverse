# Fix Fishing Reconnect Timeout & Idle Watchdog Disconnect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khắc phục triệt để lỗi mất kết nối "server im lặng 124s" bằng cơ chế keep-alive chuẩn theo ngữ cảnh Park, loại bỏ xung đột ngữ cảnh Farm Sync sau reconnect và đảm bảo bot câu cá không bị treo với lỗi timeout (-34) bằng `joinParkWithRetry`.

**Architecture:** Điều chỉnh `GameClient.startKeepAlive` phát `requestYourInfo` (CMD -94) khi ở Park; mở rộng `parkOwnsOrTargetsContext` trong `AvatarSession` để ngăn `syncFarmAfterOnline` can thiệp vào ngữ cảnh Park; thay thế cơ chế vào map một lần trong `runFishingLoop` bằng `joinParkWithRetry` kèm cooldown chống rate-limit và xử lý phục hồi vòng câu sau khi không dính cá.

**Tech Stack:** TypeScript, Node.js, EventEmitter, AbortSignal

**Spec:** `docs/superpowers/specs/2026-09-09-fix-fishing-reconnect-timeout-and-idle-watchdog-design.md`

## Global Constraints
- Không viết test trước (no TDD) theo quy định bắt buộc của CLAUDE.md.
- Mọi khoảng chờ async PHẢI sử dụng hoặc kế thừa `AbortSignal` (`signal`) để có thể hủy tức thời khi user dừng hoặc chuyển mode.
- Tuân thủ quy tắc GitNexus (`gitnexus_impact` trước khi sửa, `gitnexus_detect_changes` trước khi commit).

---

### Task 1: Cải tiến Keep-Alive và Xử lý Snapshot trong `GameClient`

**Files:**
- Modify: `avatar-web/server/src/game/client.ts:455-465,648-685`

**Interfaces:**
- Consumes: `this.currentHandlerContext`, `HANDLER_PARK`, `this.requestYourInfo()`, `PARK_ALREADY_IN_AREA_DIALOG`
- Produces: Keep-alive CMD -94 hoạt động trong Park; `waitForWorldSnapshot` resolve ngay khi nhận dialog xác nhận ở đúng khu vực; thông điệp timeout RX80 rõ ràng.

- [x] **Step 1: Kiểm tra impact analysis trước khi sửa**
  Chạy `gitnexus_impact({target: "startKeepAlive", direction: "upstream", repo: "learning-reverse"})` và `gitnexus_impact({target: "waitForWorldSnapshot", direction: "upstream", repo: "learning-reverse"})`.

- [x] **Step 2: Cập nhật `startKeepAlive` trong `client.ts`**
  Tại dòng 455-465, sửa hàm `startKeepAlive`:
  ```typescript
  private startKeepAlive(intervalMs = 45_000): void {
    this.stopKeepAlive();
    this.keepAliveTimer = setInterval(() => {
      if (this.status !== 'online') return this.stopKeepAlive();
      try {
        if (this.currentHandlerContext === HANDLER_PARK) {
          // Ngữ cảnh Park: CMD -94 (Global) luôn có phản hồi, CMD 70 (Farm) bị bỏ qua
          this.requestYourInfo();
        } else {
          // Ngữ cảnh Farm / Main: CMD 70 (getInventory)
          this.farm.getInventory();
        }
      } catch {
        this.stopKeepAlive();
      }
    }, intervalMs);
  }
  ```

- [x] **Step 3: Cập nhật `waitForWorldSnapshot` trong `client.ts`**
  Tại dòng 648-685, sửa `onSameArea` và thông báo lỗi timeout:
  ```typescript
      const onSameArea = (reason: string): void => {
        if (!expected || reason.trim() !== PARK_ALREADY_IN_AREA_DIALOG) return;
        cleanup();
        const cached = this.latestParkSnapshot;
        if (
          cached
          && cached.roomId === expected.map
          && cached.boardId === expected.area
        ) {
          this.emit(
            'log',
            `Park snapshot cache: server xác nhận đã ở map ${expected.map} khu ${expected.area}`,
          );
          resolve(cloneParkSnapshot(cached));
        } else {
          // Server xác nhận nhân vật đã ở đúng map/khu, tạo snapshot tối thiểu
          const synSnap: EnterWorldSnapshot = {
            playerId: this.playerId ?? 0,
            roomId: expected.map,
            boardId: expected.area,
            x: 0,
            y: 0,
            specials: [],
            totalBytes: 0,
            trailingBytes: 0,
          };
          this.latestParkSnapshot = synSnap;
          this.emit(
            'log',
            `Server xác nhận nhân vật đã ở map ${expected.map} khu ${expected.area} (chấp nhận dialog)`,
          );
          resolve(synSnap);
        }
      };
  ```
  Và sửa thông báo lỗi timeout trong `timer`:
  ```typescript
      timer = setTimeout(() => {
        cleanup();
        const msg = expected
          ? `hết giờ chờ vào map ${expected.map} khu ${expected.area} (RX80)`
          : 'hết giờ chờ gói enter-world (-34)';
        reject(new Error(msg));
      }, timeoutMs);
  ```

- [x] **Step 4: Kiểm tra biên dịch**
  Run: `npm run build -w avatar-web/server`
  Expected: Build thành công không có lỗi type.

---

### Task 2: Chặn Farm Sync và Xung Đột Ngữ Cảnh khi Chạy Auto Fishing

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts:675-685,1070-1085`

**Interfaces:**
- Consumes: `this.desiredMode`, `this.activeMode`, `this.fishingAbortController`
- Produces: `fishingOwnsOrTargetsContext()`, `parkOwnsOrTargetsContext()`, ngăn chặn `syncFarmAfterOnline` khi `auto_fishing` đang hoạt động.

- [x] **Step 1: Kiểm tra impact analysis trước khi sửa**
  Chạy `gitnexus_impact({target: "findNpcOwnsOrTargetsContext", direction: "upstream", repo: "learning-reverse"})`.

- [x] **Step 2: Thêm `fishingOwnsOrTargetsContext` & `parkOwnsOrTargetsContext` trong `avatarSession.ts`**
  Tại dòng 675, bổ sung logic:
  ```typescript
  private fishingOwnsOrTargetsContext(): boolean {
    return this.desiredMode === 'auto_fishing'
      || this.activeMode === 'auto_fishing'
      || this.fishingAbortController !== undefined;
  }

  private parkOwnsOrTargetsContext(): boolean {
    return this.findNpcOwnsOrTargetsContext() || this.fishingOwnsOrTargetsContext();
  }
  ```

- [x] **Step 3: Cập nhật `assertFarmContextAvailable` & `onOnline`**
  Cập nhật `assertFarmContextAvailable`:
  ```typescript
  private assertFarmContextAvailable(): void {
    if (this.findNpcOwnsOrTargetsContext()) {
      throw new Error('Find NPC đang sở hữu ngữ cảnh Park; không thể chuyển sang farm');
    }
    if (this.fishingOwnsOrTargetsContext()) {
      throw new Error('Auto Fishing đang sở hữu ngữ cảnh Park; không thể chuyển sang farm');
    }
  }
  ```
  Cập nhật `onOnline` tại dòng 1072:
  Thay thế `!this.findNpcOwnsOrTargetsContext()` bằng `!this.parkOwnsOrTargetsContext()`:
  ```typescript
    if (!this.parkOwnsOrTargetsContext()) {
      this.autoSyncKickoff = setImmediate(() => {
        this.autoSyncKickoff = undefined;
        if (this.parkOwnsOrTargetsContext()) return;
        const sync = this.syncFarmAfterOnline(client, epoch);
        this.farmSyncPromise = sync;
        void sync.finally(() => {
          if (this.farmSyncPromise === sync) this.farmSyncPromise = undefined;
        });
      });
    }
  ```

- [x] **Step 4: Kiểm tra biên dịch**
  Run: `npm run build -w avatar-web/server`
  Expected: Build thành công không có lỗi type.

---

### Task 3: Tích hợp `joinParkWithRetry` và Xử lý Chu Kỳ Không Dính Cá trong `runFishingLoop`

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts:2290-2358,2615-2630`

**Interfaces:**
- Consumes: `this.joinParkWithRetry`, `client.sendRaw`, `outerLoop`
- Produces: Vào map câu cá an toàn với retry 3 lần; phục hồi session câu bằng `outerLoop` khi cá không cắn hoặc sổng cá.

- [x] **Step 1: Kiểm tra impact analysis trước khi sửa**
  Chạy `gitnexus_impact({target: "joinParkWithRetry", direction: "upstream", repo: "learning-reverse"})`.

- [x] **Step 2: Áp dụng `joinParkWithRetry` trong `runFishingLoop`**
  Trong `avatarSession.ts`, thay thế đoạn one-shot `waitForWorldSnapshot` và `client.joinPark(map, area)` (dòng 2315-2356) bằng `this.joinParkWithRetry`:
  ```typescript
    // Gửi TX90 (board list request) — probe xác nhận server cần bước này trước joinPark
    this.pushLog(`[câu cá] gửi TX90 board-list request cho map ${map}`);
    const rx90Promise = new Promise<void>((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        client.session.removeListener('message', onMsg);
        resolve(); // timeout nhẹ: tiếp tục kể cả khi không nhận được RX90
      }, 3000);
      const onMsg = (msg: { command: number }): void => {
        if (msg.command !== 90) return;
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        client.session.removeListener('message', onMsg);
        resolve();
      };
      client.session.on('message', onMsg);
    });
    client.sendRaw(90, [{ t: 'i8', v: String(map) }]);
    await rx90Promise;
    this.pushLog(`[câu cá] nhận RX90 — di chuyển vào map ${map} (khu ${area})…`);

    if (signal.aborted || !this.isCurrent(client, epoch) || this.desiredMode !== 'auto_fishing') return;

    try {
      await this.joinParkWithRetry(client, map, area, signal, epoch);
    } catch (err) {
      if (signal.aborted || !this.isCurrent(client, epoch) || this.desiredMode !== 'auto_fishing') return;
      const msg = (err as Error).message;
      this.fishingRuntime.status = 'rejected';
      this.fishingRuntime.lastError = msg;
      this.pushLog(`[câu cá] vào map thất bại: ${msg}`);
      this.emitAutomation();
      return;
    }
  ```

- [x] **Step 3: Xử lý phục hồi phiên câu khi không dính cá (timeout 35s hoặc miss)**
  Trong cast loop của `runFishingLoop`:
  Khi `catchResult === false` (timeout 35s không cắn hoặc sổng cá):
  Thay vì để rơi tự do xuống `postCatchDelay` rồi gọi tiếp `quanCau()`, ta gửi `cauCaXong` dọn dẹp state và `continue outerLoop` để bắt đầu lại bằng `startFishing`:
  ```typescript
        // Xử lý khi không bắt được cá (hết 35s không cắn câu hoặc giật hụt/sổng cá)
        if (catchResult === false) {
          this.pushLog('[câu cá] không bắt được cá lượt này — reset phiên câu và thử lại…');
          try { client.cauCaXong(); } catch { /* bỏ qua */ }
          await this.delayCancellable(1000, signal);
          continue outerLoop;
        }
  ```

- [x] **Step 4: Kiểm tra biên dịch**
  Run: `npm run build -w avatar-web/server`
  Expected: Build thành công không có lỗi type.

---

### Task 4: Kiểm tra GitNexus, Test Suite và Commit

**Files:**
- Modify: `avatar-web/server/src/game/client.ts`
- Modify: `avatar-web/server/src/session/avatarSession.ts`

- [x] **Step 1: Kiểm tra GitNexus detect changes**
  Run: `gitnexus_detect_changes({scope: "unstaged", repo: "learning-reverse"})`
  Expected: Chỉ các symbol và file trong Task 1, 2, 3 bị ảnh hưởng, không có side-effect ngoài ý muốn.

- [x] **Step 2: Chạy kiểm tra test suite server**
  Run: `npm test -w avatar-web/server`
  Expected: Toàn bộ unit test hiện có pass 100%.

- [x] **Step 3: Commit code**
  Commit message:
  ```text
  fix(fishing): resolve idle watchdog disconnect, prevent farm sync context conflict, and add join retry
  ```
