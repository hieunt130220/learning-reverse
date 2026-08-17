# Spec: Sửa lỗi không hiển thị Xu, Lượng, Level trên Account Card (Account Metrics Display Fix)

**Date:** 2026-08-17  
**Topic:** fix-account-metrics-display  
**Status:** In-Review

---

## 1. Mục tiêu & Bối cảnh (Goal & Context)

### Vấn đề:
Trên giao diện Web Dashboard (`AccountCard.tsx`), các thông số **Xu, Lượng, Level (NV và Farm)** của tài khoản hiển thị dấu gạch ngang (`—`) mặc dù tài khoản đã kết nối hoặc đang chạy AutoFarm.

### Nguyên nhân gốc rễ (Root Causes):
1. **Xu (Money)**:
   - Server game chỉ gửi gói `-3` (`UPDATE_MONEY`) sau khi phát sinh giao dịch (mua hạt, mua thú, bán sản phẩm...). Khi tài khoản vừa kết nối, đăng nhập hoặc idle, server không gửi gói `-3`.
   - Gói `cmd 70` (`INVENTORY`) được gọi ngay sau khi vào nông trại (`enterFarm`) và trong các nhịp kiểm tra kho / keep-alive. Theo nghiên cứu giao thức (`notes/farm.md:534`), **12 byte ở phần đuôi của gói `70` chứa số dư Xu ở 4 byte đầu (`i32 BE`)**. Hàm `decodeInventory` trong `avatar-web/server/src/game/farmData.ts` hiện đang bỏ qua hoàn toàn 12 byte đuôi này.
2. **Lượng & Level**:
   - `GameClient.playerLevel` và `GameClient.farmLevel` chưa bao giờ được gán trong `onMessage`.
   - `avatarSession.ts` chỉ kích hoạt `updateCachedMetrics` khi nhận event `money` từ gói `-3`.
3. **Cache Database rỗng**:
   - Đối với tài khoản mới hoặc tài khoản chưa từng giao dịch, các cột `cached_xu`, `cached_luong`, `cached_player_level`, `cached_farm_level` trong SQLite là `NULL`. Do runtime không lấy được giá trị và fallback DB cũng là `NULL`, giao diện rơi về hiển thị `'—'`.

---

## 2. Phạm vi (Scope)

### In-scope:
- Nâng cấp `decodeInventory` trong `avatar-web/server/src/game/farmData.ts` để đọc và giải mã số dư `xu` từ 12 byte đuôi gói `cmd 70`.
- Cập nhật `GameClient` để gán `this.money = inv.xu` và phát sự kiện `money` / cập nhật trạng thái khi nhận gói `70`.
- Cập nhật `AvatarSession` để đồng bộ `cachedMetrics` (lưu DB `cached_xu` và phát sự kiện `metrics`) ngay khi nhận dữ liệu kho `cmd 70`.
- Đảm bảo snapshot trả về `xu`, `money`, `luong`, `playerLevel`, `farmLevel` đúng thứ tự fallback giữa runtime và `cachedMetrics`.
- Cập nhật unit test cho `decodeInventory`, `GameClient`, `AvatarSession` và `AccountCard`.

### Out-of-scope:
- Đổi giao diện UI ngoài việc render số liệu đã được cung cấp.
- Thay đổi cấu trúc bảng cơ sở dữ liệu (các cột `cached_xu`, `cached_luong`, `cached_player_level`, `cached_farm_level` đã có sẵn từ commit `aba0ccf`).

---

## 3. Thiết kế kiến trúc & Giải pháp kỹ thuật

### 3.1. Giải mã Xu từ gói Kho `cmd 70` (`decodeInventory`)
Trong `avatar-web/server/src/game/farmData.ts`:
- Cập nhật kiểu trả về của `decodeInventory`:
  ```typescript
  export interface InventoryData {
    seeds: InventoryItem[];
    items: InventoryItem[];
    other: InventoryItem[][];
    xu?: number;
    restHex: string;
  }
  ```
- Logic đọc phần đuôi:
  Sau khi duyệt hết 4 section (hoặc khi không còn section hợp lệ), kiểm tra phần byte còn lại trong stream (`r.available() >= 4`):
  - Đọc `i32` đầu tiên: `const rawXu = r.readInt()`.
  - Nếu `rawXu >= 0`, gán `xu = rawXu`.
  - Phần còn lại gom vào `restHex`.

### 3.2. Cập nhật `GameClient` và `AvatarSession`
- Trong `GameClient.onMessage` (case `70`):
  ```typescript
  case 70: {
    const inv = decodeInventory(msg.getData());
    this.inventory = [...inv.seeds, ...inv.items];
    this.produce = inv.other[0] ?? [];
    if (inv.xu !== undefined && inv.xu >= 0) {
      this.money = inv.xu;
      this.emit('money', { type: 1, balance: inv.xu, delta: 0 });
    }
    // ... emit log & inventory ...
    break;
  }
  ```
- Trong `AvatarSession.wire()`:
  - Khi client phát event `money`, `AvatarSession` bắt và gọi `this.updateCachedMetrics(patch)` -> Lưu vào DB qua `opts.onMetrics(valid)` và phát WS event `metrics` ra frontend.

### 3.3. Dữ liệu Snapshot và Frontend `AccountCard`
- `AvatarSession.snapshot()` trả về `xu` và `money` ưu tiên từ `c?.money ?? this.cachedMetrics.xu`.
- `AccountCard.tsx` hiển thị:
  - Xu: `formatMetric(xu)` với `xu = runtime?.xu ?? runtime?.money ?? cached?.xu`.
  - Lượng: `formatMetric(luong)` với `luong = runtime?.luong ?? cached?.luong`.
  - Level: `NV ${playerLevel ?? '—'} · Farm ${farmLevel ?? '—'}`.

---

## 4. Verification Plan

### 4.1. Unit Test
- `farmData.test.ts`: Test giải mã gói 70 có 12 byte đuôi -> `xu` được giải mã chính xác (`473574`).
- `client.test.ts`: Test nhận gói 70 có đuôi -> `client.money` được cập nhật và phát event `money`.
- `avatarSession.test.ts`: Test nhận gói 70 -> `session.snapshot().xu` cập nhật và `cachedMetrics` được đồng bộ.
- `AccountCard.test.tsx`: Test hiển thị đúng `xu`, `luong`, `level` khi offline (cached) và khi online (runtime).

### 4.2. Regression Test
- Chạy toàn bộ test suite:
  `cd avatar-web/server && npm test`
  `cd avatar-web/web && npm test`
  Tất cả các test phải pass 100%.
