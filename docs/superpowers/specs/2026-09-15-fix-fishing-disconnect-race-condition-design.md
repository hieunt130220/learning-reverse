# Thiết Kế: Khắc Phục Race Condition & Ghost State Transition Khi Mất Kết Nối Trong Auto Câu Cá

> **Ngày lập:** 2026-09-15  
> **Trạng thái:** Chờ User Review (Dự thảo thiết kế)  
> **Chủ đề:** Khắc phục tình trạng bot câu cá gửi gói tin vào socket đã đóng, log điều hướng ảo (`moving` vào map 27) và log sai "không bắt được cá lượt này" khi socket bị ngắt kết nối (`remote-end`).  
> **Tham chiếu sự cố:**
> ```text
> 11:51:12 AM [câu cá] không bắt được cá lượt này — reset phiên câu và thử lại…
> 11:51:12 AM thử kết nối lại sau 11s (lần 1)
> 11:51:12 AM mất kết nối: remote-end 27.0.14.120:19129, sống 255734ms, rx=5163585B tx=1167B, trạng thái=online, im lặng 1ms
> 11:51:12 AM [câu cá] đang di chuyển vào map 27 (khu vực 0)…
> 11:51:12 AM [câu cá] handler context hiện tại: unknown — gửi enterParkContext
> ```

---

## 1. Mục Tiêu & Bối Cảnh (Context & Goals)

### 1.1. Bối cảnh & Nguyên nhân gốc rễ (Root Cause)
Chuỗi sự kiện xảy ra tại mốc `11:51:12 AM`:
1. **Socket đóng (`remote-end`)**: Server game chủ động đóng kết nối TCP. `client.session` kích hoạt event `closed`:
   - `client.ts` đặt `currentHandlerContext = 'unknown'` và chuyển `status` sang `'idle'`.
   - `avatarSession.ts` nhận sự kiện `status = 'idle'`, gọi `onDisconnected(epoch)`: kích hoạt `this.fishingAbortController.abort()` và `this.scheduleRetry(epoch)` (log `thử kết nối lại sau 11s (lần 1)`).
2. **Sai lệch phân loại trong `catchPromise`**:
   - Khi `signal.abort()` được gọi, `onAbort` trong `catchPromise` resolve giá trị `false`.
   - `runFishingLoop` không phân biệt được giữa việc "hết 35s không cắn câu / giật hụt" với việc "kết nối bị hủy / rớt mạng", dẫn đến đẩy log sai lệch: `[câu cá] không bắt được cá lượt này — reset phiên câu và thử lại…`.
3. **Thiếu guard sau `delayCancellable`**:
   - `runFishingLoop` gọi `await this.delayCancellable(1000, signal)`. Vì `signal.aborted` đã là `true`, hàm `delayCancellable` lập tức resolve.
   - Ngay sau delay, code không kiểm tra `signal.aborted` hay `client.status !== 'online'`, mà gọi thẳng `await this.startFishingSession(client, generation, epoch, signal)`.
4. **Thiếu guard tại đầu hàm `startFishingSession` & `enterFishingPark`**:
   - `startFishingSession` thấy `client.currentHandlerContext !== 9` (do đã bị reset về `'unknown'` khi đóng socket) nên lập tức gọi `enterFishingPark`.
   - `enterFishingPark` không có guard kiểm tra `signal.aborted` hay `client.status !== 'online'` ở đầu hàm, mà thực thi ngay các lệnh ghi log và gửi gói tin:
     - `this.pushLog('[câu cá] đang di chuyển vào map 27 (khu vực 0)…')`
     - `this.fishingRuntime.status = 'moving'`
     - `this.pushLog('[câu cá] handler context hiện tại: unknown — gửi enterParkContext')`
     - `client.enterParkContext()` (ghi dữ liệu vào socket đã chết).
   - Chỉ sau khi thực thi xong các bước trên, hàm mới kiểm tra `signal.aborted` và return `false`.

### 1.2. Mục tiêu
1. **Loại bỏ hoàn toàn hành vi điều hướng ma (ghost navigation)**: Không bao giờ cập nhật `status = 'moving'`, không ghi log di chuyển map, và không gửi gói tin `enterParkContext` khi socket đã đóng (`client.status !== 'online'`) hoặc signal đã hủy (`signal.aborted`).
2. **Chặn đứt vòng lặp ngay khi socket ngắt**: Bổ sung guard kiểm tra nghiêm ngặt sau mọi lời gọi `delayCancellable` và tại entry point của tất cả các hàm con (`startFishingSession`, `enterFishingPark`, `executeSellFish`, `executeParkPurchase`).
3. **Phân loại chính xác trong `catchPromise`**: `onAbort` của `catchPromise` trả về sentinel `'aborted'` (hoặc fail-fast), không bao giờ trả về `false` để tránh ghi log nhầm `không bắt được cá lượt này`.

---

## 2. Phạm Vi (Scope)

### 2.1. In-Scope
- `avatar-web/server/src/session/avatarSession.ts`:
  - Thêm guard `if (signal.aborted || client.status !== 'online' || !this.isCurrent(client, epoch) || !this.isAutomationGenerationCurrent(generation) || this.desiredMode !== 'auto_fishing') return false;` tại:
    - Đầu hàm `enterFishingPark`.
    - Đầu hàm `startFishingSession`.
    - Đầu hàm `executeSellFish`.
    - Đầu hàm `executeParkPurchase`.
    - Sau các điểm `await this.delayCancellable(1000, signal)` trong `runFishingLoop`.
  - Cập nhật `catchPromise`: Khi `signal.aborted` kích hoạt, resolve `'aborted'` và ngắt `runFishingLoop` lập tức trước khi kiểm tra `catchResult === false`.

### 2.2. Out-of-Scope
- Không can thiệp vào tầng TCP driver hoặc giao thức keep-alive ngoài việc đảm bảo client dọn dẹp sạch sẽ khi disconnect.
- Không thay đổi hành vi auto-retry kết nối lại sau 11s (hành vi này đã chuẩn xác).

---

## 3. Thiết Kế Chi Tiết & Giải Pháp Kỹ Thuật

### 3.1. Danh Sách Files Liên Quan
| File | Đường dẫn | Vai trò |
|---|---|---|
| `avatarSession.ts` | `avatar-web/server/src/session/avatarSession.ts` | Thêm guard cancellation & connection status, chuẩn hóa `catchPromise` |

### 3.2. Chi Tiết Thay Đổi Code

#### Điểm 1: Entry Guard cho `enterFishingPark` & `startFishingSession`
Thêm kiểm tra an toàn ngay đầu hàm trước khi push log hay set status:
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
  ...
```

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

  if (client.currentHandlerContext !== 9) {
    ...
```

#### Điểm 2: Chuẩn hóa `catchPromise` để phân biệt Abort với Missed Catch
Trong `runFishingLoop`:
```typescript
const catchPromise = new Promise<boolean | string>((resolve) => {
  ...
  const onAbort = () => {
    if (settled) return;
    settled = true;
    cleanup();
    resolve('aborted');
  };
  ...
});

const catchResult = await catchPromise;

// Fail-fast nếu bị hủy do rớt mạng hoặc người dùng dừng auto
if (
  signal.aborted
  || client.status !== 'online'
  || !this.isCurrent(client, epoch)
  || !this.isAutomationGenerationCurrent(generation)
  || this.desiredMode !== 'auto_fishing'
  || catchResult === 'aborted'
) break;
```

#### Điểm 3: Guard sau `delayCancellable` trong các nhánh xử lý lượt câu hỏng
Tại các nhánh `catchResult === false`, dialog `sổng cá / chạy mất`, `hết hạn vé`:
```typescript
if (catchResult === false) {
  this.pushLog('[câu cá] không bắt được cá lượt này — reset phiên câu và thử lại…');
  try { client.cauCaXong(); } catch { /* bỏ qua */ }
  await this.delayCancellable(1000, signal);

  // GUARD: Ngắt ngay nếu kết nối đã đóng hoặc signal bị hủy trong lúc delay
  if (
    signal.aborted
    || client.status !== 'online'
    || !this.isCurrent(client, epoch)
    || !this.isAutomationGenerationCurrent(generation)
    || this.desiredMode !== 'auto_fishing'
  ) break;

  if (this.fishingFarmDue) {
    ...
  }
  if (!(await this.startFishingSession(client, generation, epoch, signal))) return;
  continue;
}
```

---

## 4. Verification Plan

1. **Static Analysis & Typecheck**:
   - `cd avatar-web/server && npm run typecheck`
   - Đảm bảo exit code 0, không có lỗi type.
2. **Production Build**:
   - `cd avatar-web/server && npm run build`
3. **GitNexus Graph Analysis**:
   - Phân tích impact và detect_changes với GitNexus để xác nhận không phát sinh rủi ro ngoài ý muốn.
