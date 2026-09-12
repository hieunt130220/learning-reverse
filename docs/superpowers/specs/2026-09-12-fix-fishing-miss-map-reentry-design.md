# Fix Fishing Miss Map Re-entry Design Document

**Date:** 2026-09-12  
**Author:** AI Agent (Superpowers Workflow)  
**Topic:** Loại bỏ hành vi load lại map câu cá sau mỗi lượt câu trượt trong vòng lặp auto-fishing  

---

## 1. Mục tiêu & Bối cảnh (Goal & Context)

### 1.1. Vấn đề cần giải quyết
Trong quá trình tự động câu cá (`auto_fishing`), khi một lượt câu không bắt được cá (do hết 35 giây không có cá cắn câu, hoặc bấm trượt mũi tên minigame dẫn đến sổng cá), bot xuất hiện log:
```
15:23:44 [câu cá] không bắt được cá lượt này — reset phiên câu và thử lại…
15:23:45 [câu cá] đang di chuyển vào map 14 (khu vực 0)…
15:23:45 [câu cá] handler context hiện tại: 9 — gửi enterParkContext
15:23:46 [câu cá] gửi TX90 board-list request cho map 14
15:23:47 [câu cá] nhận RX90 — di chuyển vào map 14 (khu 0)…
15:23:49 [câu cá] đã vào khu vực câu cá map 14 — handler=9
```
Bot thực hiện rời map và kết nối lại vào map 14 (khu 0), gửi lại `enterParkContext`, request `TX 90`, chờ `RX 90`, gửi `joinPark` (`TX 80`) và chờ 3000ms delay đồng bộ trước khi quăng cần lại.

### 1.2. Nguyên nhân kỹ thuật
- **Nguồn gốc lịch sử:** Trước commit `3e5e2ce` (10/09/2026: *feat(fishing): run periodic farm between catches*), luồng câu cá có nhãn `outerLoop`. Việc vào map câu cá chỉ diễn ra **1 lần duy nhất lúc khởi động**. Khi câu trượt, code cũ thực hiện `continue outerLoop` — chỉ lặp lại việc gửi `TX 45` (`startFishing`) ngay tại map hiện tại mà không hề vào lại map.
- **Lỗi phát sinh khi refactor:** Trong commit `3e5e2ce`, tác giả gom chung cả hai việc:
  1. Vào map câu cá (`enterParkContext`, `TX 90`, `joinParkWithRetry`, delay 3000ms).
  2. Khởi tạo phiên câu cá (`TX 45 startFishing`, chờ `RX 45`, xử lý mua mồi/vé/bán cá nếu thiếu).
  vào trong một hàm duy nhất là `prepareFishingAtPark()`.
- Tại nhánh xử lý câu trượt (`catchResult === false` ở `avatarSession.ts:3220`), code đã thay thế `continue outerLoop` bằng:
  ```typescript
  if (!(await this.prepareFishingAtPark(client, generation, epoch, signal))) return;
  ```
  Tương tự, sau khi chat `banca` dọn rương cá đầy (dòng 3163), bot vẫn đang đứng trong map 14 nhưng cũng gọi `prepareFishingAtPark()`.
- **Hệ quả:** Mỗi lần câu trượt hoặc dọn rương cá, bot bị tốn thêm 5–6 giây vô ích, spam request chuyển map lên server Avatar và khiến nhân vật bị khựng/load lại map liên tục.

---

## 2. Phạm vi (Scope)

### 2.1. In-Scope
- Tách hàm `prepareFishingAtPark` trong `avatar-web/server/src/session/avatarSession.ts` thành hai hàm có trách nhiệm riêng biệt:
  1. `enterFishingPark(client, generation, epoch, signal)`: Chỉ chịu trách nhiệm di chuyển nhân vật vào map câu cá (Map 14, khu vực cấu hình), gửi `enterParkContext`, `TX 90`, `joinParkWithRetry` và delay 3s đồng bộ.
  2. `startFishingSession(client, generation, epoch, signal)`: Chỉ chịu trách nhiệm gửi `TX 45 startFishing`, chờ `RX 45`, và giải quyết các trường hợp từ chối (mua mồi, mua vé, mua cần, bán cá khi đầy rương).
  3. `prepareFishingAtPark`: Kết hợp gọi tuần tự `enterFishingPark` -> `startFishingSession` (dùng cho lúc mới khởi động câu hoặc sau khi quay lại từ farm).
- Cập nhật nhánh `catchResult === false` (câu trượt):
  - Reset phiên câu bằng `client.cauCaXong()`.
  - Chỉ gọi `startFishingSession(client, ...)` để ngồi câu lại ngay tại hồ câu hiện tại, **không gọi `enterFishingPark`**.
- Cập nhật nhánh sau khi bán cá in-place (`executeSellFish`):
  - Chỉ gọi `startFishingSession(client, ...)` để bắt đầu câu tiếp, **không vào lại map**.
- Cập nhật nhánh sau khi đi mua bổ sung mồi/vé/cần (`executeParkPurchase`):
  - Vì trong `executeParkPurchase` đã có bước quay trở lại map câu (`joinParkWithRetry`), sau đó chỉ cần gọi `startFishingSession(client, ...)`.

### 2.2. Out-of-Scope
- Không thay đổi luồng quăng cần (`TX 41`), giải captcha câu cá (`RX 79`, CNN solver), hay chốt kết quả câu thành công (`TX 44`).
- Không thay đổi luồng chuyển sang Nông Trại định kỳ (`serviceDueFishingFarm`) — khi đi farm và quay lại hồ câu, bot vẫn cần vào lại map đầy đủ qua `prepareFishingAtPark`.

---

## 3. Thiết kế kiến trúc & Giải pháp kỹ thuật

### 3.1. Danh sách file liên quan
- `avatar-web/server/src/session/avatarSession.ts`: Chứa toàn bộ state machine của `auto_fishing`, bao gồm `prepareFishingAtPark`, `runFishingLoop`, và các điểm chuyển trạng thái sau khi câu trượt/bán cá/mua vật phẩm.

### 3.2. Phân rã kiến trúc chi tiết

```
[Khởi động / Quay lại từ Farm]
        │
        ▼
   enterFishingPark() ──► Đổi handler context 9 ──► TX90 ──► RX90 ──► joinPark (TX80) ──► Chờ 3s
        │
        ▼
   startFishingSession() ──► Gửi TX45 (startFishing) ──► Chờ RX45
        │
        ▼
  [Vòng lặp quăng cần (while)]
        │
        ├──► Câu trúng: cauCaXong (TX44) ──► Nghỉ ngơi ──► quăng cần tiếp (TX41) [ở nguyên vị trí]
        │
        └──► Câu trượt (catchResult === false):
                 │
                 ├──► cauCaXong (TX44) để reset
                 │
                 ├──► Nếu đến giờ đi farm ──► serviceDueFishingFarm (đi farm rồi prepareFishingAtPark)
                 │
                 └──► Nếu không đi farm ──► startFishingSession() [KHÔNG vào lại map!]
                                                    │
                                                    ▼
                                            Tiếp tục quăng cần lượt mới
```

### 3.3. Chi tiết các hàm sau khi refactor

#### Hàm 1: `enterFishingPark`
Chỉ thực hiện việc di chuyển map:
```typescript
private async enterFishingPark(
  client: GameClient,
  generation: number,
  epoch: number,
  signal: AbortSignal,
): Promise<boolean> {
  const config = this.fishingConfig.config;
  const map = config.map;
  const area = config.area;

  this.pushLog(`[câu cá] đang di chuyển vào map ${map} (khu vực ${area})…`);
  this.fishingRuntime.status = 'moving';
  this.fishingRuntime.currentMap = map;
  this.fishingRuntime.currentArea = area;
  this.emitAutomation();

  this.pushLog(`[câu cá] handler context hiện tại: ${client.currentHandlerContext} — gửi enterParkContext`);
  client.enterParkContext();
  await this.delayCancellable(800, signal);
  // ... Gửi TX90 -> Chờ RX90 -> joinParkWithRetry -> delayCancellable(3000, signal) ...
  this.pushLog(`[câu cá] đã vào khu vực câu cá map ${map} — handler=${client.currentHandlerContext}`);
  return true;
}
```

#### Hàm 2: `startFishingSession`
Thực hiện handshake bắt đầu câu và xử lý mua mồi/bán cá nếu cần:
```typescript
private async startFishingSession(
  client: GameClient,
  generation: number,
  epoch: number,
  signal: AbortSignal,
): Promise<boolean> {
  // Nếu vì lý do nào đó handler context bị mất (không ở Park), tự động vào lại map an toàn
  if (client.currentHandlerContext !== 9) {
    const entered = await this.enterFishingPark(client, generation, epoch, signal);
    if (!entered) return false;
  }

  this.pushLog(`[câu cá] gửi TX45 startFishing — handler=${client.currentHandlerContext}`);
  // ... Vòng lặp gửi TX45 và xử lý startResult.iss ...
  return true;
}
```

#### Hàm 3: `prepareFishingAtPark`
Giữ nguyên tên hàm để tương thích với các điểm gọi hiện tại (`startFishingLoop`, `serviceDueFishingFarm`):
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

#### Cập nhật trong `runFishingLoop`
1. Khi `catchResult === false`:
```typescript
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

2. Khi bán cá in-place (`executeSellFish`):
```typescript
if (castErrText.includes('rương') && (castErrText.includes('đầy') || castErrText.includes('không thể câu'))) {
  const sold = await this.executeSellFish(client, epoch, signal);
  if (!sold) { ... return; }
  if (this.fishingFarmDue) { ... continue; }
  if (!(await this.startFishingSession(client, generation, epoch, signal))) return;
  continue;
}
```

3. Khi mua vé/cần/mồi (`executeParkPurchase`):
```typescript
if (castMissingType) {
  const bought = await this.executeParkPurchase(client, epoch, signal, castMissingType);
  if (!bought) return;
  try { client.cauCaXong(); } catch { /* bỏ qua */ }
  await this.delayCancellable(1000, signal);
  if (this.fishingFarmDue) { ... continue; }
  if (!(await this.startFishingSession(client, generation, epoch, signal))) return;
  continue;
}
```

---

## 4. Edge Cases & An Toàn (Safety Guards)

1. **Edge Case nhân vật bị disconnect hoặc văng map:**
   - Trong `startFishingSession`, thêm guard: nếu `client.currentHandlerContext !== 9`, hàm sẽ tự động kích hoạt `enterFishingPark` để khôi phục trạng thái park trước khi gửi `TX 45`.
2. **Cancellable & Automation Generation:**
   - Cả `enterFishingPark` và `startFishingSession` đều duy trì đầy đủ các kiểm tra hủy luồng: `signal.aborted`, `isCurrent(client, epoch)`, `isAutomationGenerationCurrent(generation)`, và `desiredMode !== 'auto_fishing'`.
3. **Tuân thủ quy tắc GitNexus:**
   - Trước khi sửa `avatarSession.ts`, chạy `impact` để phân tích ảnh hưởng.
   - Trước khi commit, chạy `detect_changes` để kiểm tra đồ thị thay đổi.

---

## 5. Verification Plan

1. **Kiểm tra biên dịch (TypeScript Compile Check):**
   - Chạy `npm run build -w avatar-web/server` để đảm bảo code biên dịch sạch, không có lỗi type.
2. **Kiểm tra luồng qua GitNexus:**
   - Kiểm tra `impact` và `detect_changes` của `AvatarSession` và `runFishingLoop`.
3. **Kiểm tra runtime / log:**
   - Khi chạy câu cá và gặp lượt câu trượt (timeout hoặc trượt captcha), xác nhận log chỉ ghi:
     `[câu cá] không bắt được cá lượt này — reset phiên câu và thử lại…`
     `[câu cá] gửi TX45 startFishing — handler=9`
     và **hoàn toàn không còn** các dòng `đang di chuyển vào map 14`, `gửi TX90 board-list`, `nhận RX90`, hay delay 3000ms.
