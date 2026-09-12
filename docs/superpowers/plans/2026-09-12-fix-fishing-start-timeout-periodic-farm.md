# Fix Fishing Start Timeout Periodic Farm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khắc phục triệt để lỗi timeout `Server từ chối bắt đầu câu: hết giờ chờ bắt đầu câu` khi chu kỳ nông trại định kỳ (30 phút) trong Auto Fishing hoàn tất và quay lại hồ câu cá.

**Architecture:** Kết thúc phiên câu cũ bằng `client.cauCaXong()` trước khi chuyển sang Farm để server không giữ trạng thái câu cá treo; xóa stale snapshot Park khi vào Farm; bổ sung cơ chế Retry thông minh (tối đa 2 lần thử lại) kèm giải phóng session và re-enter map trong `startFishingSession` khi gặp timeout; bổ sung retry cấp 2 trong `serviceDueFishingFarm`.

**Tech Stack:** TypeScript, Node.js, WebSocket / Game Packet protocol (AvatarHD)

**Spec:** `docs/superpowers/specs/2026-09-12-fix-fishing-start-timeout-periodic-farm-design.md`

## Global Constraints
- Tuân thủ quy định KHÔNG TDD (không viết test trước khi viết code, không tạo test files trừ khi user yêu cầu).
- Tuân thủ quy tắc GitNexus (`gitnexus_impact` trước khi sửa, `gitnexus_detect_changes` trước khi commit).
- Giữ nguyên convention logging hiện có với prefix `[câu cá]` và `[nông trại]`.
- Mọi thao tác async phải gắn `signal` có thể hủy và kiểm tra `isCurrent(client, epoch)` / `isAutomationGenerationCurrent(generation)`.

---

### Task 1: Thêm `clearParkSnapshot` và dọn dẹp Park snapshot trong `client.ts`

**Files:**
- Modify: `avatar-web/server/src/game/client.ts:405-425, 670-685`

**Interfaces:**
- Consumes: `latestParkSnapshot` trong `GameClient`
- Produces: `GameClient.clearParkSnapshot(): void`

- [x] **Step 1: Thêm `clearParkSnapshot` và gọi trong `enterFarm`**
Trong `avatar-web/server/src/game/client.ts`:
Thêm phương thức public `clearParkSnapshot()`:
```typescript
  clearParkSnapshot(): void {
    this.latestParkSnapshot = undefined;
  }
```
Và trong `enterFarm(idFarm?: number): void`:
Gọi `this.latestParkSnapshot = undefined;` ngay đầu hàm trước khi gửi request vào farm.

- [x] **Step 2: Kiểm tra typecheck**
Run: `npm run typecheck --prefix avatar-web/server`
Expected: `Exit code: 0`, không có lỗi type.

- [x] **Step 3: Commit**
```bash
git add avatar-web/server/src/game/client.ts
git commit -m "fix(game): clear stale park snapshot when entering farm"
```

---

### Task 2: Dọn dẹp phiên câu cá và thêm retry cứu vãn trong `serviceDueFishingFarm`

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts:3048-3085`

**Interfaces:**
- Consumes: `GameClient.cauCaXong()`, `GameClient.clearParkSnapshot()`, `this.prepareFishingAtPark()`
- Produces: Luồng chuyển tiếp an toàn giữa câu cá và chu kỳ nông trại định kỳ

- [x] **Step 1: Cập nhật `serviceDueFishingFarm` trong `avatarSession.ts`**
Cập nhật `serviceDueFishingFarm`:
1. Trước khi gọi `runFishingFarmCycle`:
   - Ghi log: `this.pushLog('[câu cá] Tạm dừng câu cá, đứng dậy để làm nông trại định kỳ…');`
   - Gọi `try { client.cauCaXong(); } catch { /* bỏ qua */ }`
   - Chờ `await this.delayCancellable(800, signal);`
2. Sau khi `runFishingFarmCycle` hoàn tất:
   - Gọi `client.clearParkSnapshot();`
   - Thử `prepareFishingAtPark(client, generation, epoch, signal)`. Nếu trả về `false`, ghi log cảnh báo và thử lại lần 2 sau delay 2000ms trước khi dừng hẳn.

Code cụ thể:
```typescript
  private async serviceDueFishingFarm(
    client: GameClient,
    generation: number,
    epoch: number,
    signal: AbortSignal,
  ): Promise<'continue-fishing' | 'stop'> {
    if (!this.fishingFarmDue) return 'continue-fishing';
    this.fishingChallengeGeneration += 1;
    this.fishingFarmDue = false;

    this.pushLog('[câu cá] Tạm dừng câu cá, đứng dậy để làm nông trại định kỳ…');
    try {
      client.cauCaXong();
    } catch {
      /* bỏ qua */
    }
    await this.delayCancellable(800, signal);

    const outcome = await this.runFishingFarmCycle(
      'periodic',
      client,
      generation,
      epoch,
      signal,
    );
    if (outcome === 'cancelled' || outcome === 'reconnect') return 'stop';
    if (
      signal.aborted
      || !this.isCurrent(client, epoch)
      || !this.isAutomationGenerationCurrent(generation)
      || this.desiredMode !== 'auto_fishing'
    ) {
      return 'stop';
    }

    this.pushLog('[câu cá] Đã xong farm, quay lại khu câu cá...');
    this.fishingFarmPhase = 'returning-to-park';
    client.clearParkSnapshot();
    let ok = await this.prepareFishingAtPark(client, generation, epoch, signal);
    if (!ok) {
      if (
        signal.aborted
        || !this.isCurrent(client, epoch)
        || !this.isAutomationGenerationCurrent(generation)
        || this.desiredMode !== 'auto_fishing'
      ) {
        return 'stop';
      }
      this.pushLog('[câu cá] Lần đầu vào lại khu câu cá sau farm chưa sẵn sàng — thử lại lần 2…');
      await this.delayCancellable(2000, signal);
      ok = await this.prepareFishingAtPark(client, generation, epoch, signal);
    }
    if (!ok) return 'stop';
    this.fishingFarmPhase = 'fishing';
    this.scheduleFishingFarm(generation, epoch);
    return 'continue-fishing';
  }
```

- [x] **Step 2: Kiểm tra typecheck**
Run: `npm run typecheck --prefix avatar-web/server`
Expected: `Exit code: 0`, không có lỗi type.

- [x] **Step 3: Commit**
```bash
git add avatar-web/server/src/session/avatarSession.ts
git commit -m "fix(fishing): close fishing session before farm and add fallback retry when returning"
```

---

### Task 3: Bổ sung cơ chế Timeout Retry thông minh trong `startFishingSession`

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts:2890-3035`

**Interfaces:**
- Consumes: `client.startFishing()`, `client.cauCaXong()`, `this.enterFishingPark()`
- Produces: `startFishingSession` tự phục hồi khi server timeout phản hồi `TX 45`

- [x] **Step 1: Thêm timeout retry loop trong `startFishingSession`**
Trong `startFishingSession`:
1. Định nghĩa các biến đếm:
   ```typescript
   let consecutiveFailures = 0;
   let lastMissingType: 'ticket' | 'rod' | 'bait' | null = null;
   let timeoutRetries = 0;
   const MAX_TIMEOUT_RETRIES = 2;
   ```
2. Khi `!startResult.iss` và `errText.includes('hết giờ chờ bắt đầu câu')`:
   - Nếu `timeoutRetries < MAX_TIMEOUT_RETRIES`:
     ```typescript
     timeoutRetries++;
     this.pushLog(`[câu cá] Hết giờ chờ bắt đầu câu (lần ${timeoutRetries}/${MAX_TIMEOUT_RETRIES}) — reset phiên câu và thử lại…`);
     try { client.cauCaXong(); } catch { /* bỏ qua */ }
     await this.delayCancellable(1500 * timeoutRetries, signal);
     if (timeoutRetries >= 2) {
       await this.enterFishingPark(client, generation, epoch, signal);
     }
     continue;
     ```
   - Nếu đã vượt quá `MAX_TIMEOUT_RETRIES`:
     Rơi xuống xử lý lỗi reject như bình thường.

- [x] **Step 2: Kiểm tra typecheck**
Run: `npm run typecheck --prefix avatar-web/server`
Expected: `Exit code: 0`, không có lỗi type.

- [x] **Step 3: Commit**
```bash
git add avatar-web/server/src/session/avatarSession.ts
git commit -m "fix(fishing): add smart retry loop on startFishing timeout"
```

---

### Task 4: Kiểm tra toàn diện, Test suite regression và GitNexus change detection

**Files:**
- Review: `avatar-web/server/src/game/client.ts`
- Review: `avatar-web/server/src/session/avatarSession.ts`

- [x] **Step 1: Chạy typecheck trên toàn bộ project**
Run: `npm run typecheck --prefix avatar-web/server`
Expected: `Exit code: 0`.

- [x] **Step 2: Chạy unit tests hiện có của server**
Run: `npm test --prefix avatar-web/server`
Expected: Toàn bộ test suite pass, không có regression.

- [x] **Step 3: Kiểm tra GitNexus graph change detection**
Run MCP tool `detect_changes({ scope: "all" })` hoặc CLI tương đương để xác nhận không có bất kỳ unhandled side-effects nào.
