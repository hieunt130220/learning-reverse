# Thiết Kế: Sửa Lỗi Dừng Auto Nhiệm Vụ Thợ Câu Do Hardcode Chế Độ `auto_fishing`

> **Ngày lập:** 2026-09-15  
> **Trạng thái:** Chờ User Review (Spec Gate)  
> **Chủ đề:** Khắc phục lỗi luồng câu cá (`runFishingLoop`) và các hàm phụ trợ bị hủy ngay khi chạy ở chế độ `auto_fisherman_quest`.

---

## 1. Mục Tiêu & Bối Cảnh (Context & Goals)

### 1.1. Bối cảnh & Hiện tượng lỗi
- Người dùng kích hoạt tính năng **Auto Nhiệm Vụ Thợ Câu** (`auto_fisherman_quest`).
- Bot kết nối, đăng nhập, quét danh sách nhiệm vụ và xác định thành công mục tiêu:
  ```text
  cập nhật Nhiệm Vụ Thợ Câu - 11: Câu 30 con cá lia thia (12/30), Câu 30 con cá chim (30/30), Câu 50 con cá rô (50/50)
  [thợ câu] mục tiêu: Câu 30 con cá lia thia 12/30 → map 27.
  [thợ câu] map 27 dùng vé bến tàu (12.000 xu/vé 4876).
  ```
- Ngay sau log trên, bot **dừng hoàn toàn**, không di chuyển sang Map 27, không mua vé bến tàu, không quăng cần câu.

### 1.2. Nguyên nhân gốc rễ (Root Cause)
Khi chế độ `auto_fisherman_quest` chạy, `this.desiredMode = 'auto_fisherman_quest'`.
Hàm `runFishermanQuestLoop` gọi `this.startFishingLoop(client, generation, epoch)` để tái dùng vòng lặp câu cá `runFishingLoop`.
Tuy nhiên, toàn bộ pipeline câu cá trong `avatarSession.ts` bị chặn bởi các điều kiện hardcode `this.desiredMode === 'auto_fishing'` / `this.desiredMode !== 'auto_fishing'`:
1. **Lỗi chặn ngay tại dòng đầu tiên của `runFishingLoop` (dòng 3448)**:
   - `runFishingLoop` gọi `const initialFarm = await this.runFishingFarmCycle('initial', ...);`
   - `runFishingFarmCycle` kiểm tra `if (... || this.desiredMode !== 'auto_fishing') return 'cancelled';`
   - Vì `this.desiredMode === 'auto_fisherman_quest'`, hàm trả về `'cancelled'`.
   - `runFishingLoop` gặp `if (initialFarm === 'cancelled') return;` $\rightarrow$ **hủy và thoát ngay lập tức ở mili-giây đầu tiên**!
2. **Lỗi chặn tại các chốt kiểm tra tiếp theo**:
   - `runFishingLoop` (dòng 3460): `if (... || this.desiredMode !== 'auto_fishing') return;`
   - `enterFishingPark` (dòng 3085, 3106, 3142, 3152, 3166, 3177): từ chối vào Map khi `this.desiredMode !== 'auto_fishing'`.
   - `startFishingSession` (dòng 3194, 3216, 3274): từ chối handshake câu cá khi `this.desiredMode !== 'auto_fishing'`.
   - `executeParkPurchase` (dòng 2600): từ chối mua vé bến tàu / mồi / cần khi `this.desiredMode !== 'auto_fishing'`.
   - `executeSellFish` (dòng 2952, 2972, 3043): từ chối bán cá khi `this.desiredMode !== 'auto_fishing'`.
   - Vòng lặp quăng cần `runFishingLoop` (dòng 3480): `while (... && this.desiredMode === 'auto_fishing')` $\rightarrow$ kết thúc ngay.
   - Các chốt trong vòng quăng cần (dòng 3557, 3600, 3635, 3657, 3679, 3692, 3714, 3757, 3786, 3801, 3818): `this.desiredMode !== 'auto_fishing'` $\rightarrow$ `break`.
   - Bộ giải mini-game mũi tên `handleFishingChallenge` (dòng 3899, 3938, 4002): bỏ qua gói thử thách câu cá khi `this.desiredMode !== 'auto_fishing'`, không gửi phím mũi tên.

### 1.3. Mục tiêu khắc phục
- Tách biệt rõ ràng:
  - Chu kỳ làm nông trại kèm theo (`runFishingFarmCycle`, `scheduleFishingFarm`) chỉ áp dụng cho chế độ `auto_fishing` (chế độ câu cá tự do kèm chăm farm). Chế độ `auto_fisherman_quest` chỉ tập trung câu cá làm quest, không chạy farm cycle.
  - Toàn bộ pipeline câu cá (`runFishingLoop`, `enterFishingPark`, `startFishingSession`, `executeParkPurchase`, `executeSellFish`, `handleFishingChallenge`) chấp nhận cả hai chế độ câu: `auto_fishing` HOẶC `auto_fisherman_quest`.
- Chuẩn hóa bằng helper method `isFishingAutomationActive()`.

---

## 2. Phạm Vi (Scope)

### 2.1. In-Scope
- File `avatar-web/server/src/session/avatarSession.ts`:
  - Thêm helper method `isFishingAutomationActive()`:
    ```typescript
    private isFishingAutomationActive(): boolean {
      return this.desiredMode === 'auto_fishing' || this.desiredMode === 'auto_fisherman_quest';
    }
    ```
  - Cập nhật `runFishingLoop`:
    - Chỉ chạy `runFishingFarmCycle('initial')` và `scheduleFishingFarm` khi `this.desiredMode === 'auto_fishing'`.
    - Thay thế các điều kiện kiểm tra `this.desiredMode !== 'auto_fishing'` thành `!this.isFishingAutomationActive()`.
    - Thay thế điều kiện vòng lặp `this.desiredMode === 'auto_fishing'` thành `this.isFishingAutomationActive()`.
  - Cập nhật `enterFishingPark`, `startFishingSession`, `executeParkPurchase`, `executeSellFish`:
    - Dùng `!this.isFishingAutomationActive()`.
  - Cập nhật `handleFishingChallenge`:
    - Dùng `!this.isFishingAutomationActive()`.

### 2.2. Out-of-Scope
- Không thay đổi `runFishingFarmCycle` hay logic nông trại của `auto_farm` / `auto_fishing`.
- Không sửa `fishermanQuest.ts` (mapping cá đã chuẩn).
- Không sửa frontend UI.

---

## 3. Thiết Kế Kiến Trúc & Giải Pháp Kỹ Thuật

### 3.1. Danh Sách Files Liên Quan
| File | Đường dẫn | Vai trò |
|---|---|---|
| `avatarSession.ts` | `avatar-web/server/src/session/avatarSession.ts` | Điều phối lifecycle bot, vòng lặp câu cá và nhiệm vụ thợ câu |

### 3.2. Chi Tiết Thay Đổi Logic

#### 1. Định nghĩa Helper Method
```typescript
/** Kiểm tra người dùng có đang yêu cầu một trong các chế độ tự động câu cá hay không (auto_fishing hoặc auto_fisherman_quest) */
private isFishingAutomationActive(): boolean {
  return this.desiredMode === 'auto_fishing' || this.desiredMode === 'auto_fisherman_quest';
}
```

#### 2. Trong `runFishingLoop`
```typescript
// Chỉ chạy chu kỳ farm ban đầu nếu là chế độ auto_fishing thường:
if (this.desiredMode === 'auto_fishing') {
  const initialFarm = await this.runFishingFarmCycle(
    'initial',
    client,
    generation,
    epoch,
    signal,
  );
  if (initialFarm === 'cancelled' || initialFarm === 'reconnect') return;
}

if (
  signal.aborted
  || !this.isCurrent(client, epoch)
  || !this.isAutomationGenerationCurrent(generation)
  || !this.isFishingAutomationActive()
) return;

this.fishingFarmPhase = 'moving-to-park';
if (!(await this.prepareFishingAtPark(client, generation, epoch, signal))) return;
this.fishingFarmPhase = 'fishing';

// Chỉ lên lịch farm định kỳ nếu là auto_fishing:
if (this.desiredMode === 'auto_fishing') {
  this.scheduleFishingFarm(generation, epoch);
}

// Vòng lặp quăng cần liên tục:
while (
  !signal.aborted
  && this.isCurrent(client, epoch)
  && this.isAutomationGenerationCurrent(generation)
  && this.isFishingAutomationActive()
  && client.status === 'online'
) {
  // ... bên trong vòng lặp thay this.desiredMode !== 'auto_fishing' thành !this.isFishingAutomationActive()
}
```

#### 3. Trong `enterFishingPark`, `startFishingSession`, `executeParkPurchase`, `executeSellFish`
Thay thế mọi đoạn kiểm tra:
```typescript
|| this.desiredMode !== 'auto_fishing'
```
thành:
```typescript
|| !this.isFishingAutomationActive()
```

#### 4. Trong `handleFishingChallenge`
Thay thế các chốt chặn kiểm tra:
```typescript
|| this.desiredMode !== 'auto_fishing'
```
và:
```typescript
if (this.desiredMode !== 'auto_fishing') return;
```
thành:
```typescript
|| !this.isFishingAutomationActive()
```
và:
```typescript
if (!this.isFishingAutomationActive()) return;
```

---

## 4. Verification Plan

1. **Static Analysis & Typecheck:**
   - Chạy `npm --prefix avatar-web/server run typecheck`
   - Đảm bảo 0 lỗi TypeScript compilation.
2. **Automated Test Suite:**
   - Chạy `npm --prefix avatar-web/server test`
   - Đảm bảo 274 unit tests hiện có tiếp tục pass 100%, không bị regression.
3. **Live Execution Verification:**
   - Bật auto `auto_fisherman_quest` với quest có mục tiêu Map 27.
   - Kiểm tra log hiển thị đúng trình tự:
     1. `[thợ câu] mục tiêu: ... → map 27`
     2. `[câu cá] đang di chuyển vào map 27 (khu vực 0)…`
     3. `[câu cá] gửi TX45 startFishing`
     4. Mua vé bến tàu nếu thiếu vé $\rightarrow$ handshake hoàn tất $\rightarrow$ `[câu cá] đang quăng cần…`
     5. Khi cá cắn câu $\rightarrow$ ML solver giải câu đố $\rightarrow$ bắt được cá $\rightarrow$ tăng tiến độ `[thợ câu] tiến độ: ...`.
