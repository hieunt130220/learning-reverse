# Fix Fishing Miss Map Re-entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Loại bỏ việc load lại map và gửi request chuyển map thừa thãi khi câu trượt hoặc dọn rương trong auto-fishing bằng cách tách biệt di chuyển map khỏi bắt đầu phiên câu.

**Architecture:** Tách `prepareFishingAtPark` trong `avatarSession.ts` thành hai hàm chuyên biệt: `enterFishingPark` (chỉ di chuyển vào map khi thực sự cần thiết) và `startFishingSession` (bắt đầu câu ngay tại vị trí hiện tại kèm fallback). Cập nhật các nhánh câu trượt (`catchResult === false`), bán cá in-place (`executeSellFish`), và sau khi mua đồ (`executeParkPurchase`) để gọi `startFishingSession` thay vì load lại map.

**Tech Stack:** TypeScript, Node.js, WebSocket / Packet protocol (Avatar game protocol)

**Spec:** `docs/superpowers/specs/2026-09-12-fix-fishing-miss-map-reentry-design.md`

## Global Constraints
- KHÔNG thực hiện TDD, không tạo file test mới (theo quy định CLAUDE.md của dự án).
- Luôn kiểm tra tính hủy bỏ (`signal.aborted`), epoch connection (`isCurrent`), và automation generation (`isAutomationGenerationCurrent`) tại mọi điểm chờ bất đồng bộ.
- Tuân thủ quy tắc GitNexus: chạy `impact` trước khi sửa hàm và `detect_changes` trước khi hoàn tất commit.

---

### Task 1: Tách `prepareFishingAtPark` thành `enterFishingPark` và `startFishingSession`

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts:2761-3003`

**Interfaces:**
- Consumes:
  - `client: GameClient`
  - `this.fishingConfig.config` (map, area)
  - `client.enterParkContext()`, `this.joinParkWithRetry()`
  - `client.startFishing()`, `client.currentHandlerContext`
- Produces:
  - `private async enterFishingPark(client: GameClient, generation: number, epoch: number, signal: AbortSignal): Promise<boolean>`
  - `private async startFishingSession(client: GameClient, generation: number, epoch: number, signal: AbortSignal): Promise<boolean>`
  - `private async prepareFishingAtPark(client: GameClient, generation: number, epoch: number, signal: AbortSignal): Promise<boolean>`

- [x] **Step 1: Phân tích impact bằng GitNexus**
  Chạy công cụ `impact` với target `prepareFishingAtPark` và direction `upstream` để ghi nhận các điểm gọi bị ảnh hưởng.

- [x] **Step 2: Hiện thực `enterFishingPark` trong `avatarSession.ts`**
  Tách phần di chuyển vào map, gửi TX 90, joinPark và delay 3s đồng bộ thế giới vào hàm riêng:
  ```typescript
  private async enterFishingPark(
    client: GameClient,
    generation: number,
    epoch: number,
    signal: AbortSignal,
  ): Promise<boolean> {
    const config = this.fishingConfig.config;
    const map = config.map; // 14: Khu cá rô mặc định
    const area = config.area; // 0

    this.pushLog(`[câu cá] đang di chuyển vào map ${map} (khu vực ${area})…`);
    this.fishingRuntime.status = 'moving';
    this.fishingRuntime.currentMap = map;
    this.fishingRuntime.currentArea = area;
    this.emitAutomation();

    this.pushLog(`[câu cá] handler context hiện tại: ${client.currentHandlerContext} — gửi enterParkContext`);
    client.enterParkContext();
    await this.delayCancellable(800, signal);

    if (
      signal.aborted
      || !this.isCurrent(client, epoch)
      || !this.isAutomationGenerationCurrent(generation)
      || this.desiredMode !== 'auto_fishing'
    ) return false;

    // Gửi TX90 (board list request) — probe xác nhận server cần bước này trước joinPark
    this.pushLog(`[câu cá] gửi TX90 board-list request cho map ${map}`);
    const rx90Promise = new Promise<void>((resolve) => {
      let settled = false;
      let timer: NodeJS.Timeout | undefined;
      const cleanup = (): void => {
        if (timer) clearTimeout(timer);
        client.session.removeListener('message', onMsg);
        signal.removeEventListener('abort', onAbort);
      };
      const finish = (): void => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };
      const onAbort = (): void => finish();
      const onMsg = (msg: { command: number }): void => {
        if (msg.command !== 90) return;
        finish();
      };
      signal.addEventListener('abort', onAbort, { once: true });
      client.session.on('message', onMsg);
      timer = setTimeout(finish, 3000);
    });
    client.sendRaw(90, [{ t: 'i8', v: String(map) }]);
    await rx90Promise;
    this.pushLog(`[câu cá] nhận RX90 — di chuyển vào map ${map} (khu ${area})…`);

    if (
      signal.aborted
      || !this.isCurrent(client, epoch)
      || !this.isAutomationGenerationCurrent(generation)
      || this.desiredMode !== 'auto_fishing'
    ) return false;

    try {
      await this.joinParkWithRetry(client, map, area, signal, epoch);
    } catch (err) {
      if (
        signal.aborted
        || !this.isCurrent(client, epoch)
        || !this.isAutomationGenerationCurrent(generation)
        || this.desiredMode !== 'auto_fishing'
      ) return false;
      const msg = (err as Error).message;
      this.fishingRuntime.status = 'rejected';
      this.fishingRuntime.lastError = msg;
      this.pushLog(`[câu cá] vào map thất bại: ${msg}`);
      this.emitAutomation();
      return false;
    }

    if (
      signal.aborted
      || !this.isCurrent(client, epoch)
      || !this.isAutomationGenerationCurrent(generation)
      || this.desiredMode !== 'auto_fishing'
    ) return false;
    this.pushLog(`[câu cá] đã vào khu vực câu cá map ${map} — handler=${client.currentHandlerContext}`);
    // Chờ 3000ms để server đồng bộ hoàn toàn trạng thái thế giới và nhân vật trước khi gọi startFishing.
    // Probe live xác nhận server cần ~3s sau RX80 để sẵn sàng nhận TX45; 2000ms gây timeout RX45.
    await this.delayCancellable(3000, signal);

    if (
      signal.aborted
      || !this.isCurrent(client, epoch)
      || !this.isAutomationGenerationCurrent(generation)
      || this.desiredMode !== 'auto_fishing'
    ) return false;

    return true;
  }
  ```

- [x] **Step 3: Hiện thực `startFishingSession` trong `avatarSession.ts`**
  Thực hiện handshake bắt đầu phiên câu cá kèm guard fallback:
  ```typescript
  private async startFishingSession(
    client: GameClient,
    generation: number,
    epoch: number,
    signal: AbortSignal,
  ): Promise<boolean> {
    // Nếu nhân vật chưa ở trong Park context (handler 9), tự động vào map trước
    if (client.currentHandlerContext !== 9) {
      const entered = await this.enterFishingPark(client, generation, epoch, signal);
      if (!entered) return false;
    }

    this.pushLog(`[câu cá] gửi TX45 startFishing — handler=${client.currentHandlerContext}`);

    let consecutiveFailures = 0;
    let lastMissingType: 'ticket' | 'rod' | 'bait' | null = null;

    // ── Vòng lặp chờ startFishing thành công ──
    while (true) {
      if (
        signal.aborted
        || !this.isCurrent(client, epoch)
        || !this.isAutomationGenerationCurrent(generation)
        || this.desiredMode !== 'auto_fishing'
      ) return false;

      this.fishingRuntime.status = 'starting';
      this.emitAutomation();

      const rx45Promise = new Promise<{ iss: boolean; error?: string }>((resolve) => {
        let settled = false;
        let timer: NodeJS.Timeout | undefined;
        const cleanup = () => {
          client.removeListener('fishing-start-result', onStartResult);
          client.removeListener('dialog', onDialog);
          signal.removeEventListener('abort', onAbort);
          if (timer) clearTimeout(timer);
        };
        const onStartResult = (res: { iss: boolean; error?: string }) => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(res);
        };
        const onDialog = (reason: string) => {
          // Bỏ qua các dialog thông tin/phần thưởng không liên quan đến lỗi câu cá
          if (isInformationalDialog(reason)) {
            if (isRewardDialog(reason)) {
              this.pushLog(`[câu cá] nhận phần thưởng: ${reason}`);
            }
            return;
          }
          if (settled) return;
          settled = true;
          cleanup();
          resolve({ iss: false, error: reason });
        };
        const onAbort = () => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve({ iss: false, error: 'bị hủy' });
        };
        client.on('fishing-start-result', onStartResult);
        client.on('dialog', onDialog);
        signal.addEventListener('abort', onAbort, { once: true });
        timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve({ iss: false, error: 'hết giờ chờ bắt đầu câu' });
        }, 8000);
      });

      client.startFishing();
      const startResult = await rx45Promise;

      if (
        signal.aborted
        || !this.isCurrent(client, epoch)
        || !this.isAutomationGenerationCurrent(generation)
        || this.desiredMode !== 'auto_fishing'
      ) return false;

      if (!startResult.iss) {
        const reason = startResult.error ?? 'server từ chối bắt đầu câu';
        const errText = reason.toLowerCase();
        this.pushLog(`[câu cá] Server từ chối bắt đầu câu: ${reason}`);

        if (errText.includes('rương') && (errText.includes('đầy') || errText.includes('không thể câu'))) {
          const sold = await this.executeSellFish(client, epoch, signal);
          if (!sold) {
            this.fishingRuntime.status = 'rejected';
            this.fishingRuntime.lastError = reason;
            this.pushLog(`[câu cá] Dừng câu: ${reason}`);
            this.emitAutomation();
            return false;
          }
          continue;
        }

        let missingType: 'ticket' | 'rod' | 'bait' | null = null;
        if (errText.includes('vé') || errText.includes('bến tàu')) {
          missingType = 'ticket';
        } else if (errText.includes('mồi')) {
          missingType = 'bait';
        } else if (
          errText.includes('cần câu')
          || errText.includes('sử dụng cần')
          || errText.includes('phải có cần')
          || errText.includes('cần tre')
          || errText.includes('cần sắt')
        ) {
          missingType = 'rod';
        }

        if (missingType) {
          if (missingType !== lastMissingType) {
            lastMissingType = missingType;
            consecutiveFailures = 0;
          }

          if (consecutiveFailures >= 1) {
            this.fishingRuntime.status = 'rejected';
            this.fishingRuntime.lastError = `Đã mua ${missingType} nhưng server vẫn từ chối: ${reason}`;
            this.pushLog(`[câu cá] Dừng câu: ${this.fishingRuntime.lastError}`);
            this.emitAutomation();
            return false;
          }

          const bought = await this.executeParkPurchase(client, epoch, signal, missingType);
          if (bought) {
            consecutiveFailures++;
            continue;
          } else {
            this.fishingRuntime.status = 'rejected';
            if (!this.fishingRuntime.lastError) {
              this.fishingRuntime.lastError = reason;
            }
            this.emitAutomation();
            return false;
          }
        }

        this.fishingRuntime.status = 'rejected';
        this.fishingRuntime.lastError = reason;
        this.emitAutomation();
        return false;
      }

      break;
    }

    this.fishingRuntime.lastError = null;
    return true;
  }
  ```

- [x] **Step 4: Cập nhật `prepareFishingAtPark` gọi kết hợp**
  ```typescript
  private async prepareFishingAtPark(
    client: GameClient,
    generation: number,
    epoch: number,
    signal: AbortSignal,
  ): Promise<boolean> {
    const entered = await this.enterFishingPark(client, generation, epoch, signal);
    if (!entered) return false;
    return this.startFishingSession(client, generation, epoch, signal);
  }
  ```

- [x] **Step 5: Kiểm tra biên dịch**
  Run: `npm run build -w avatar-web/server`
  Expected: Không có lỗi type.

---

### Task 2: Cập nhật các điểm gọi trong `runFishingLoop` không reload map thừa thãi

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts:3150-3230`

**Interfaces:**
- Consumes:
  - `startFishingSession(client, generation, epoch, signal)`
  - `prepareFishingAtPark(client, generation, epoch, signal)`
- Produces:
  - Luồng câu không bị chuyển map khi câu trượt, dọn rương, hoặc sau khi mua đồ.

- [x] **Step 1: Cập nhật nhánh câu trượt (`catchResult === false`)**
  Thay thế lời gọi `prepareFishingAtPark` bằng `startFishingSession`:
  ```typescript
  // Xử lý khi không bắt được cá (hết 35s không cắn câu hoặc giật hụt/sổng cá)
  if (catchResult === false) {
    this.pushLog('[câu cá] không bắt được cá lượt này — reset phiên câu và thử lại…');
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

- [x] **Step 2: Cập nhật nhánh bán cá in-place (`executeSellFish`)**
  Sau khi hoàn tất chat `banca` dọn rương thành công trong map, không vào lại map:
  ```typescript
  if (castErrText.includes('rương') && (castErrText.includes('đầy') || castErrText.includes('không thể câu'))) {
    const sold = await this.executeSellFish(client, epoch, signal);
    if (!sold) {
      this.fishingRuntime.status = 'rejected';
      this.fishingRuntime.lastError = catchResult;
      this.emitAutomation();
      return;
    }
    if (this.fishingFarmDue) {
      const action = await this.serviceDueFishingFarm(client, generation, epoch, signal);
      if (action === 'stop') return;
      continue;
    }
    if (!(await this.startFishingSession(client, generation, epoch, signal))) return;
    continue;
  }
  ```

- [x] **Step 3: Cập nhật nhánh mua vật phẩm (`executeParkPurchase`)**
  Trong `executeParkPurchase`, bot đã tự động di chuyển quay lại map câu mục tiêu. Do đó sau khi gửi `cauCaXong()`, chỉ cần `startFishingSession`:
  ```typescript
  if (castMissingType) {
    const bought = await this.executeParkPurchase(client, epoch, signal, castMissingType);
    if (!bought) return;
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

- [x] **Step 4: Kiểm tra biên dịch**
  Run: `npm run build -w avatar-web/server`
  Expected: Build thành công sạch sẽ.

---

### Task 3: Phân tích đồ thị GitNexus và xác nhận an toàn

**Files:**
- Verify: `avatar-web/server/src/session/avatarSession.ts`

- [x] **Step 1: Phân tích thay đổi đồ thị bằng `detect_changes`**
  Chạy `detect_changes({ scope: "all" })` để kiểm tra các symbol bị thay đổi và mức độ rủi ro liên quan.
  Đảm bảo không có chu trình import mới hoặc hàm bị vỡ interface.

- [x] **Step 2: Commit mã nguồn và tài liệu**
  Thực hiện commit với thông điệp chuẩn convention:
  ```bash
  git add avatar-web/server/src/session/avatarSession.ts docs/superpowers/
  git commit -m "fix(fishing): avoid reloading park map on missed catch and in-park actions"
  ```
