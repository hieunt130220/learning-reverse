# Spec: Hỗ trợ Lượng Mở & Lượng Khoá và Sửa Giải Mã UPDATE_MONEY

- **Ngày tạo**: 2026-08-18
- **Trạng thái**: Chờ duyệt (Pending Review)
- **Tác giả**: AI Assistant & devios

---

## 1. Mục tiêu & Bối cảnh

### 1.1 Vấn đề
Người dùng thông báo: **Vẫn chưa thấy được số lượng**, và trong game Avatar có 2 loại lượng:
1. **Lượng (Lượng mở)**: Lượng nạp / có thể giao dịch (`Avatar.money[2]`).
2. **Lượng khoá**: Lượng nhận từ sự kiện / nhiệm vụ (`Avatar.luongKhoa` tại offset `0x90`).

### 1.2 Nguyên nhân gốc rễ (Root Cause Analysis từ Disassembly Arm64)
1. **Gói `UPDATE_MONEY (cmd -3)` trong `GlobalMessageHandler` @0x5ecdcc & 0x5ee1d0**:
   - Khi server gửi gói `-3`, cấu trúc wire protocol thật sự bao gồm **5 trường liên tiếp**:
     - `i32 delta`: Số lượng biến động
     - `i8 type`: Loại giao dịch
     - `i32 xu`: Số dư Xu hiện tại (`Avatar.setMoney` -> `Avatar.money[0]`)
     - `i32 luong`: Số dư Lượng mở hiện tại (`Avatar.setGold` -> `Avatar.money[2]`)
     - `i32 luongKhoa`: Số dư Lượng khoá hiện tại (`Avatar.luongKhoa` -> offset `0x90`)
   - **Bug trong code cũ**: `decodeMoney` trước đây chỉ đọc 3 trường (`delta`, `type`, `balance = readInt()`), tưởng nhầm byte thứ 3 là số dư riêng của `type`, do đó bỏ qua `luong` và `luongKhoa`. Khi `type === 2` thì `balance` bị đọc sai thành `xu` thay vì `luong`.
2. **Gói `-5` (CRE_CHARACTER / Player Data)** @0x5ed598:
   - Cũng gửi liên tiếp 3 `readInt()` cho `xu`, `luong`, và `luongKhoa`.
3. **Database & Cache**:
   - Database SQLite và `CachedAccountMetrics` mới chỉ có `cached_luong` (lượng mở), chưa có `cached_luong_khoa` để lưu và hiển thị lượng khoá.

---

## 2. Phạm vi thay đổi (Scope)

### 2.1 In-Scope
1. **Cập nhật `decodeMoney` trong `server/src/game/farmData.ts`**:
   - Đọc đầy đủ `delta` (`i32`), `type` (`i8`), `xu` (`i32`), `luong` (`i32`), `luongKhoa` (`i32`).
2. **Cập nhật `GameClient` (`server/src/game/client.ts`)**:
   - Thêm thuộc tính `luongKhoa?: number`.
   - Khi nhận gói `-3` (UPDATE_MONEY): Gán đồng thời `this.money = m.xu`, `this.luong = m.luong`, `this.luongKhoa = m.luongKhoa`.
   - Phát event `metrics` với `{ xu: m.xu, luong: m.luong, luongKhoa: m.luongKhoa }`.
3. **Cập nhật Database & Repository**:
   - Thêm cột `cached_luong_khoa INTEGER` vào bảng `avatar_accounts` (`schema.sql` và migration trong `server/src/db/index.ts`).
   - Cập nhật `repo.ts` (`AccountRow`, `CachedAccountMetrics`, `updateCachedMetrics`, `toAccount`).
4. **Cập nhật `AvatarSession`**:
   - Snapshot và `cachedMetrics` quản lý cả `luong` và `luongKhoa`.
5. **Cập nhật Web UI & Types**:
   - `web/src/types.ts`: Thêm `luongKhoa?: number` vào `AccountRuntime` và `CachedAccountMetrics`.
   - `web/src/accounts/AccountCard.tsx`: Hiển thị rõ Lượng mở và Lượng khoá (ví dụ: `10 · Khóa 5` hoặc `10 (+5 khóa)`).

---

## 3. Thiết kế chi tiết Data Contract

### 3.1 `MoneyUpdate` (`farmData.ts`)
```ts
export interface MoneyUpdate {
  delta: number;
  type: number;
  xu: number;
  luong: number;
  luongKhoa: number;
  /** Tương thích ngược */
  balance: number;
}

export function decodeMoney(body: Buffer): MoneyUpdate {
  const r = new MyReader(body);
  const delta = r.readInt();
  const type = r.readUnsignedByte();
  const xu = r.available() >= 4 ? r.readInt() : 0;
  const luong = r.available() >= 4 ? r.readInt() : 0;
  const luongKhoa = r.available() >= 4 ? r.readInt() : 0;
  return {
    delta,
    type,
    xu,
    luong,
    luongKhoa,
    balance: type === 2 ? luong : type === 3 ? luongKhoa : xu,
  };
}
```

### 3.2 UI Format Lượng (`AccountCard.tsx`)
```tsx
const luongDisplay = luong === undefined
  ? '—'
  : luongKhoa && luongKhoa > 0
    ? `${Intl.NumberFormat('vi-VN').format(luong)} (+${Intl.NumberFormat('vi-VN').format(luongKhoa)} khóa)`
    : Intl.NumberFormat('vi-VN').format(luong);
```

---

## 4. Verification Plan

1. **Unit Tests (`npm --prefix avatar-web/server test`)**:
   - Test `decodeMoney` với đủ 5 trường (`delta`, `type`, `xu`, `luong`, `luongKhoa`).
   - Test `updateCachedMetrics` lưu và đọc lại `luong` và `luongKhoa`.
   - Test `AvatarSession` snapshot có cả `luong` và `luongKhoa`.
2. **Build Verification**:
   - `npm --prefix avatar-web/server run build`
   - `npm --prefix avatar-web/web run build`
