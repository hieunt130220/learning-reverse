# Thiết Kế: Kích Hoạt Chu Kỳ Nông Trại Kèm Theo Trong Chế Độ `auto_fisherman_quest`

> **Ngày lập:** 2026-09-15  
> **Trạng thái:** Chờ User Review (Spec Gate)  
> **Chủ đề:** Cho phép bot tự động làm nông trại (thu hoạch, tưới nước, cho ăn, nấu bếp...) ban đầu và định kỳ mỗi 30 phút trong chế độ `auto_fisherman_quest` tương tự như `auto_fishing`.

---

## 1. Mục Tiêu & Bối Cảnh (Context & Goals)

### 1.1. Bối cảnh & Yêu cầu
- Hiện tại, chế độ `auto_fishing` (Auto câu cá) có tính năng làm nông trại kèm theo:
  - Khi bắt đầu: chạy 1 chu kỳ nông trại ban đầu (`runFishingFarmCycle('initial')`).
  - Trong khi câu: mỗi 30 phút (`FISHING_FARM_INTERVAL_MS = 1_800_000`), bot tự động đứng dậy (`cauCaXong()`), chạy 1 chu kỳ nông trại định kỳ (`serviceDueFishingFarm`), sau đó quay lại hồ câu tiếp tục quăng cần.
- Người dùng yêu cầu chế độ **Auto Nhiệm Vụ Thợ Câu** (`auto_fisherman_quest`) cũng phải tự động chạy chu kỳ nông trại kèm theo như `auto_fishing`, giúp vừa làm nhiệm vụ câu cá vừa chăm sóc nông trại không bị gián đoạn.

### 1.2. Phân tích kỹ thuật
Trong `avatarSession.ts`, các phương thức quản lý chu kỳ farm trong câu cá hiện vẫn đang giới hạn bởi `this.desiredMode === 'auto_fishing'`:
1. `scheduleFishingFarm` (dòng 2029): `if (... || this.desiredMode !== 'auto_fishing') return;` $\rightarrow$ chặn không hẹn giờ farm khi ở `auto_fisherman_quest`.
2. `isCurrentFishingFarmCycle` (dòng 2107): `(allowNonFishingMode ? this.desiredMode !== 'off' : this.desiredMode === 'auto_fishing')` $\rightarrow$ kiểm tra ownership của cycle farm từ chối `auto_fisherman_quest`.
3. `runFishingFarmCycle` (dòng 2143): `if (... || this.desiredMode !== 'auto_fishing') return 'cancelled';` $\rightarrow$ từ chối thực thi farm cycle khi ở `auto_fisherman_quest`.
4. `serviceDueFishingFarm` (dòng 3418, 3432): `|| this.desiredMode !== 'auto_fishing'` $\rightarrow$ dừng nếu không phải `auto_fishing`.
5. `runFishingLoop` (dòng 3453, 3473):
   - `if (this.desiredMode === 'auto_fishing')` bọc `runFishingFarmCycle('initial')`.
   - `if (this.desiredMode === 'auto_fishing')` bọc `scheduleFishingFarm`.

### 1.3. Mục tiêu giải pháp
- Thay thế các kiểm tra `this.desiredMode === 'auto_fishing'` / `this.desiredMode !== 'auto_fishing'` trong chuỗi nông trại câu cá bằng `this.isFishingAutomationActive()`.
- Cả `auto_fishing` và `auto_fisherman_quest` đều thực hiện chu kỳ nông trại ban đầu và định kỳ mỗi 30 phút.
- Nếu tài khoản chưa có cấu hình auto farm (`lastAutoConfig` rỗng), bot vẫn tự động bỏ qua farm (`skipped`) và câu cá bình thường mà không bị crash hay hủy phiên.

---

## 2. Phạm Vi (Scope)

### 2.1. In-Scope
- File `avatar-web/server/src/session/avatarSession.ts`:
  - Cập nhật `scheduleFishingFarm`: dùng `!this.isFishingAutomationActive()`.
  - Cập nhật `isCurrentFishingFarmCycle`: dùng `this.isFishingAutomationActive()`.
  - Cập nhật `runFishingFarmCycle`: dùng `!this.isFishingAutomationActive()`.
  - Cập nhật `serviceDueFishingFarm`: dùng `!this.isFishingAutomationActive()`.
  - Cập nhật `runFishingLoop`: kích hoạt `runFishingFarmCycle('initial')` và `scheduleFishingFarm` cho cả hai chế độ.

### 2.2. Out-of-Scope
- Không thay đổi logic chạy nông trại của `AutoFarm` (`autoFarm.ts`).
- Không sửa logic resolve quest cá trong `fishermanQuest.ts`.
- Không thay đổi chu kỳ 30 phút (`FISHING_FARM_INTERVAL_MS = 1_800_000`).

---

## 3. Thiết Kế Kiến Trúc & Giải Pháp Kỹ Thuật

### 3.1. Danh Sách Files Liên Quan
| File | Đường dẫn | Vai trò |
|---|---|---|
| `avatarSession.ts` | `avatar-web/server/src/session/avatarSession.ts` | Quản lý chu kỳ nông trại lồng ghép trong các chế độ câu cá |

### 3.2. Chi Tiết Thay Đổi

#### 1. `scheduleFishingFarm`
```typescript
if (
  !this.isAutomationGenerationCurrent(generation)
  || epoch !== this.connectionEpoch
  || !this.isFishingAutomationActive()
  || this.fishingAbortController !== parent
) return;
```

#### 2. `isCurrentFishingFarmCycle`
```typescript
&& (allowNonFishingMode ? this.desiredMode !== 'off' : this.isFishingAutomationActive())
```

#### 3. `runFishingFarmCycle`
```typescript
if (parentSignal.aborted || !this.isCurrent(client, epoch) || !this.isFishingAutomationActive()) {
  return 'cancelled';
}
```

#### 4. `serviceDueFishingFarm`
```typescript
if (
  signal.aborted
  || !this.isCurrent(client, epoch)
  || !this.isAutomationGenerationCurrent(generation)
  || !this.isFishingAutomationActive()
) {
  return 'stop';
}
```
(Áp dụng cho cả 2 chốt kiểm tra trong `serviceDueFishingFarm`).

#### 5. `runFishingLoop`
```typescript
// Chạy chu kỳ farm ban đầu cho cả auto_fishing và auto_fisherman_quest
if (this.isFishingAutomationActive()) {
  const initialFarm = await this.runFishingFarmCycle(
    'initial',
    client,
    generation,
    epoch,
    signal,
  );
  if (initialFarm === 'cancelled' || initialFarm === 'reconnect') return;
}
...
// Lên lịch farm định kỳ cho cả hai chế độ
if (this.isFishingAutomationActive()) {
  this.scheduleFishingFarm(generation, epoch);
}
```

---

## 4. Verification Plan

1. **Static Analysis & Typecheck:**
   - `npm --prefix avatar-web/server run typecheck`
   - Đảm bảo 0 lỗi compilation.
2. **Automated Test Suite:**
   - `npm --prefix avatar-web/server test`
   - Đảm bảo 274/274 tests pass.
3. **Graph Validation:**
   - Chạy `detect_changes` để kiểm tra độ an toàn trước khi commit.
