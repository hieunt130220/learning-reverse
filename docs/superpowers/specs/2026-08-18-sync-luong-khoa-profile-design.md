# Spec: Đồng bộ và hiển thị số dư Lượng và Lượng khoá từ Game Server về Web UI

- **Ngày tạo**: 2026-08-18
- **Trạng thái**: Chờ duyệt (Pending Review)
- **Tác giả**: AI Assistant & devios

---

## 1. Mục tiêu & Bối cảnh

### 1.1 Vấn đề
Người dùng thông báo: **"Trong game tôi có 0 lượng và 337 lượng khoá nhưng trên web vẫn chưa hiển thị"** (web vẫn hiển thị gạch ngang `—` cho Lượng).

### 1.2 Nguyên nhân gốc rễ (Root Cause Analysis từ Disassembly Arm64)
1. **Lý do số dư Lượng và Lượng khoá chưa xuất hiện**:
   - Hiện tại, `GameClient` (`server/src/game/client.ts`) chỉ gán `luong` và `luongKhoa` khi nhận gói **`-3` (`UPDATE_MONEY`)**.
   - Tuy nhiên, server game **chỉ đẩy gói `-3` khi có giao dịch tài chính phát sinh** (ví dụ mua đồ bằng lượng/xu, nấu nhanh bằng lượng...). Khi tài khoản đăng nhập hoặc chạy auto-farm thông thường, server **không** tự động gửi gói `-3`.
   - Gói `INVENTORY (70)` chỉ chứa `xu` và `farmLevel` (không có `luong` hay `luongKhoa`).
   - Gói `REQUEST_YOUR_INFO (-94)` chỉ chứa `playerLevel` và `perLvMain` (không có `luong` hay `luongKhoa`).
   - Do đó, khi vừa đăng nhập hoặc chạy farm, `luong` và `luongKhoa` trong RAM và trong SQLite `avatar_accounts` luôn là `NULL` / `undefined`.
   - Tại component [AccountCard.tsx](file:///Users/devios/learning-reverse/avatar-web/web/src/accounts/AccountCard.tsx#L27-L34):
     ```ts
     const formatLuong = () => {
       if (luong === undefined && luongKhoa === undefined) return '—';
       const main = luong !== undefined ? Intl.NumberFormat('vi-VN').format(luong) : '0';
       if (luongKhoa !== undefined && luongKhoa > 0) {
         return `${main} (+${Intl.NumberFormat('vi-VN').format(luongKhoa)} khóa)`;
       }
       return main;
     };
     ```
     Vì cả `luong` và `luongKhoa` đều là `undefined`, hàm trả về `'—'`.

2. **Cách game client chính thức lấy thông tin Lượng & Lượng khoá (`GlobalMessageHandler$$onMessage` @0x5ec02c / `GlobalService$$requestInfoOf` @0x6990b8)**:
   - Client gửi lệnh `GlobalService.requestInfoOf(playerId)`: Gói TX **`-8`** mang `i32 playerId`.
   - Server phản hồi gói RX **`-8`** (`PARK_BUY_ITEM` / `PLAYER_PROFILE` / `USER_DATA`) có payload đầy đủ:
     - `i32 id` (id nhân vật)
     - `utf name` (tên nhân vật)
     - `i32 xu` (số dư xu)
     - `i16 playerLevel` (cấp độ nhân vật)
     - `i32 luong` (số dư Lượng mở — trong trường hợp user là `0`)
     - `i32 luongKhoa` (số dư Lượng khoá — trong trường hợp user là `337`)
     - `i32 exp` (điểm kinh nghiệm)
     - `i32 win`
     - `i32 lose`

---

## 2. Phạm vi thay đổi (Scope)

### 2.1 In-Scope
1. **Thêm bộ giải mã `decodePlayerProfile` trong `avatar-web/server/src/game/farmData.ts`**:
   - Giải mã gói phản hồi `-8` để trích xuất đầy đủ: `id`, `name`, `xu`, `playerLevel`, `luong`, `luongKhoa`, `exp`.
2. **Cập nhật `GameClient` (`avatar-web/server/src/game/client.ts`)**:
   - Thêm phương thức `requestPlayerProfile(idUser?: number)`: gửi `Message.create(-8)` với `i32 playerId`.
   - Xử lý gói `-8` trong `onMessage`:
     - Cập nhật `this.money`, `this.playerLevel`, `this.luong`, `this.luongKhoa`.
     - Phát event `metrics` với `{ xu, luong, luongKhoa, playerLevel }`.
     - Ghi log thông tin nhân vật: tên, level, xu, lượng, lượng khoá.
   - Gọi `requestPlayerProfile(id)` ngay sau khi đăng nhập thành công (`LOGIN_SUCESS -34`) và khi refresh farm profile.
3. **Đồng bộ tự động vào SQLite và Web UI**:
   - `AvatarSession` đã có sẵn cơ chế lắng nghe event `metrics` để lưu vào DB SQLite (`cached_xu`, `cached_luong`, `cached_luong_khoa`, `cached_player_level`) và phát WebSocket về UI.
   - UI `AccountCard` sẽ lập tức hiển thị `0 (+337 khóa)` (hoặc định dạng số lượng tương ứng).

### 2.2 Out-of-Scope
- Không thay đổi logic auto-farm cây trồng hay vật nuôi.
- Không thay đổi thiết kế giao diện UI (đã hỗ trợ đầy đủ `luong` và `luongKhoa`).

---

## 3. Thiết kế kiến trúc & Giải pháp kỹ thuật

### 3.1 Data Contract & Decoder (`farmData.ts`)

```ts
export interface DecodedPlayerProfile {
  id: number;
  name: string;
  xu: number;
  playerLevel: number;
  luong: number;
  luongKhoa: number;
  exp: number;
}

export function decodePlayerProfile(body: Buffer): DecodedPlayerProfile | null {
  const r = new MyReader(body);
  const id = r.readInt();
  if (id <= 0) return null;
  const name = r.readUTF();
  const xu = r.available() >= 4 ? r.readInt() : 0;
  const playerLevel = r.available() >= 2 ? r.readShort() : 0;
  const luong = r.available() >= 4 ? r.readInt() : 0;
  const luongKhoa = r.available() >= 4 ? r.readInt() : 0;
  const exp = r.available() >= 4 ? r.readInt() : 0;
  return { id, name, xu, playerLevel, luong, luongKhoa, exp };
}
```

### 3.2 Luồng xử lý (`client.ts` & `avatarSession.ts`)

```
1. Client đăng nhập thành công (LOGIN_SUCESS -34)
   │
   ├─► client.requestPlayerProfile(id) (gửi TX cmd -8 với i32 id)
   │
2. Server phản hồi RX cmd -8 (PLAYER_PROFILE)
   │
   ├─► decodePlayerProfile(body)
   │   └─► { id, name, xu, playerLevel, luong: 0, luongKhoa: 337, exp }
   │
   ├─► client cập nhật: this.luong = 0, this.luongKhoa = 337, this.money = xu, this.playerLevel = level
   │
   ├─► client.emit('metrics', { xu, luong, luongKhoa, playerLevel })
   │
3. AvatarSession nhận event 'metrics'
   │
   ├─► updateCachedMetrics({ xu, luong, luongKhoa, playerLevel })
   │   ├─► Lưu vào SQLite DB (cached_luong = 0, cached_luong_khoa = 337)
   │   └─► Phát WebSocket broadcast { type: 'metrics', payload: { ... } }
   │
4. Web UI (React Reducer + AccountCard)
   │
   └─► Format hiển thị: "0 (+337 khóa)"
```

---

## 4. Verification Plan

### 4.1 Kiểm tra tự động (Automated Tests)
- Chạy test suite `avatar-web/server` để đảm bảo code giải mã hoạt động chính xác và không gây regression:
  - `npm --prefix avatar-web/server test`
- Build kiểm tra TypeScript:
  - `npm --prefix avatar-web/server run build`
  - `npm --prefix avatar-web/web run build`

### 4.2 Kiểm tra thủ công (Manual Verification)
- Khởi động server backend và kiểm tra session khi kết nối:
  - Log server hiển thị thông tin nhân vật: `level=... · xu=... · lượng=0 · lượng khoá=337`.
  - Database SQLite lưu đúng `cached_luong = 0` và `cached_luong_khoa = 337`.
  - Web UI `AccountCard` hiển thị `Lượng: 0 (+337 khóa)`.
