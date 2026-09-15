# Fix Fishing Disconnect Race Condition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khắc phục lỗi race condition khiến auto câu cá gửi gói tin vào socket đã đóng, log điều hướng ảo và log sai "không bắt được cá lượt này" khi socket bị ngắt kết nối (`remote-end`).

**Architecture:** Bổ sung entry guard (`signal.aborted || client.status !== 'online' || !this.isCurrent(...)`) tại đầu các phương thức điều hướng và bắt đầu phiên câu (`enterFishingPark`, `startFishingSession`, `executeSellFish`, `executeParkPurchase`); chuẩn hóa `catchPromise` resolve `'aborted'` khi bị hủy; bổ sung post-delay guards sau mọi điểm `delayCancellable` trong `runFishingLoop`.

**Tech Stack:** TypeScript, Node.js, Event-driven architecture, AbortSignal.

**Spec:** `docs/superpowers/specs/2026-09-15-fix-fishing-disconnect-race-condition-design.md`

## Global Constraints
- Tuân thủ quy tắc GitNexus: chạy `gitnexus_impact` trước khi sửa symbol, chạy `gitnexus_detect_changes` trước khi hoàn tất.
- KHÔNG tạo test files mới (tuân thủ quy định KHÔNG TDD của dự án trong CLAUDE.md).
- Bảo lưu toàn bộ hành vi auto-retry kết nối lại sau 11s đã có.

---

### Task 1: Thêm Entry Guards vào các hàm điều hướng và thao tác phụ trợ trong `avatarSession.ts`

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts:2595-2605`, `avatar-web/server/src/session/avatarSession.ts:2935-2945`, `avatar-web/server/src/session/avatarSession.ts:3059-3075`, `avatar-web/server/src/session/avatarSession.ts:3160-3172`

**Interfaces:**
- Consumes: `client.status`, `signal.aborted`, `this.isCurrent(client, epoch)`, `this.isAutomationGenerationCurrent(generation)`, `this.desiredMode`
- Produces: Ngăn chặn tuyệt đối việc đẩy log và gửi packet khi socket đã ngắt kết nối hoặc signal đã hủy.

- [x] **Step 1: Thêm guard tại đầu `enterFishingPark`**
  Trong `enterFishingPark`:
  ```typescript
  private async enterFishingPark(
    client: GameClient,
    generation: number,
    epoch: number,
    signal: AbortSignal,
  ): Promise<boolean> {
    if (
      signal.aborted
      || client.status !== 'online'
      || !this.isCurrent(client, epoch)
      || !this.isAutomationGenerationCurrent(generation)
      || this.desiredMode !== 'auto_fishing'
    ) return false;

    const config = this.fishingConfig.config;
    const map = config.map;
    const area = config.area;
  ```

- [x] **Step 2: Thêm guard tại đầu `startFishingSession`**
  Trong `startFishingSession`:
  ```typescript
  private async startFishingSession(
    client: GameClient,
    generation: number,
    epoch: number,
    signal: AbortSignal,
  ): Promise<boolean> {
    if (
      signal.aborted
      || client.status !== 'online'
      || !this.isCurrent(client, epoch)
      || !this.isAutomationGenerationCurrent(generation)
      || this.desiredMode !== 'auto_fishing'
    ) return false;

    // Nếu nhân vật chưa ở trong Park context (handler 9), tự động vào map trước
    if (client.currentHandlerContext !== 9) {
  ```

- [x] **Step 3: Thêm guard tại đầu `executeSellFish` và `executeParkPurchase`**
  Trong `executeSellFish`:
  ```typescript
  private async executeSellFish(
    client: GameClient,
    epoch: number,
    signal: AbortSignal,
  ): Promise<boolean> {
    if (
      signal.aborted
      || client.status !== 'online'
      || !this.isCurrent(client, epoch)
      || this.desiredMode !== 'auto_fishing'
    ) return false;
  ```
  Trong `executeParkPurchase`:
  ```typescript
  private async executeParkPurchase(
    client: GameClient,
    epoch: number,
    signal: AbortSignal,
    missingType: 'ticket' | 'rod' | 'bait',
  ): Promise<boolean> {
    if (
      signal.aborted
      || client.status !== 'online'
      || !this.isCurrent(client, epoch)
      || this.desiredMode !== 'auto_fishing'
    ) return false;
  ```

- [x] **Step 4: Kiểm tra typecheck**
  Run: `cd avatar-web/server && npm run typecheck`
  Expected: Không có lỗi TypeScript.

---

### Task 2: Chuẩn hóa `catchPromise` và Fail-Fast khi bị ngắt kết nối trong `runFishingLoop`

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts:3468-3520`

**Interfaces:**
- Consumes: `catchPromise`, `signal.on('abort')`
- Produces: Sentinel `'aborted'` phân biệt rõ ràng giữa miss cá và rớt mạng/hủy bỏ.

- [x] **Step 1: Cập nhật `onAbort` trong `catchPromise`**
  Tại `catchPromise` trong `runFishingLoop`:
  ```typescript
  const catchPromise = new Promise<boolean | string>((resolve) => {
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const cleanup = () => {
      client.removeListener('fishing-success-result', onSuccess);
      client.removeListener('dialog', onCastDialog);
      signal.removeEventListener('abort', onAbort);
      if (timer) clearTimeout(timer);
    };
    ...
    const onAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve('aborted');
    };
  ```

- [x] **Step 2: Thêm fail-fast guard ngay sau `await catchPromise`**
  ```typescript
  const catchResult = await catchPromise;

  if (
    signal.aborted
    || client.status !== 'online'
    || !this.isCurrent(client, epoch)
    || !this.isAutomationGenerationCurrent(generation)
    || this.desiredMode !== 'auto_fishing'
    || catchResult === 'aborted'
  ) break;
  ```

- [x] **Step 3: Kiểm tra typecheck**
  Run: `cd avatar-web/server && npm run typecheck`
  Expected: Exit code 0.

---

### Task 3: Bổ sung Post-Delay Guards sau `delayCancellable` trong `runFishingLoop`

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts:3530-3635`

**Interfaces:**
- Consumes: `delayCancellable`
- Produces: Ngăn chặn lặp tiếp hoặc gọi `startFishingSession` khi delay thức dậy do signal abort.

- [x] **Step 1: Bổ sung guard sau delay khi `catchResult === false`**
  ```typescript
  if (catchResult === false) {
    this.pushLog('[câu cá] không bắt được cá lượt này — reset phiên câu và thử lại…');
    try { client.cauCaXong(); } catch { /* bỏ qua */ }
    await this.delayCancellable(1000, signal);

    if (
      signal.aborted
      || client.status !== 'online'
      || !this.isCurrent(client, epoch)
      || !this.isAutomationGenerationCurrent(generation)
      || this.desiredMode !== 'auto_fishing'
    ) break;

    if (this.fishingFarmDue) {
      const action = await this.serviceDueFishingFarm(client, generation, epoch, signal);
      if (action === 'stop') return;
      continue;
    }
    if (!(await this.startFishingSession(client, generation, epoch, signal))) return;
    continue;
  }
  ```

- [x] **Step 2: Bổ sung guard sau delay trong các nhánh dialog cá chạy mất, sổng cá, hết vé**
  Tại nhánh `chạy mất / sổng cá / trật rồi`:
  ```typescript
  await this.delayCancellable(1000, signal);
  if (
    signal.aborted
    || client.status !== 'online'
    || !this.isCurrent(client, epoch)
    || !this.isAutomationGenerationCurrent(generation)
    || this.desiredMode !== 'auto_fishing'
  ) break;
  ```
  Tại nhánh `isMissingFishingTicketDialog`:
  ```typescript
  await this.delayCancellable(1000, signal);
  if (
    signal.aborted
    || client.status !== 'online'
    || !this.isCurrent(client, epoch)
    || !this.isAutomationGenerationCurrent(generation)
    || this.desiredMode !== 'auto_fishing'
  ) break;
  ```
  Tại nhánh `castMissingType`:
  ```typescript
  await this.delayCancellable(1000, signal);
  if (
    signal.aborted
    || client.status !== 'online'
    || !this.isCurrent(client, epoch)
    || !this.isAutomationGenerationCurrent(generation)
    || this.desiredMode !== 'auto_fishing'
  ) break;
  ```

- [x] **Step 3: Kiểm tra typecheck**
  Run: `cd avatar-web/server && npm run typecheck`
  Expected: Exit code 0.

---

### Task 4: Build, Kiểm tra GitNexus & Xác minh toàn bộ

**Files:**
- Toàn bộ thay đổi trong codebase

- [x] **Step 1: Production build**
  Run: `cd avatar-web/server && npm run build`
  Expected: Build thành công ra thư mục `dist/`.

- [x] **Step 2: GitNexus graph changes analysis**
  Run: `detect_changes({scope: "unstaged", repo: "learning-reverse"})`
  Expected: Nguy cơ rủi ro thấp (`risk: LOW`), không phá vỡ quan hệ phụ thuộc nào khác.
