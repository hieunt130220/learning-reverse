# Spec: Sửa lỗi hiển thị Lượng và Level (Nhân vật & Nông trại) trên Avatar Web

- **Ngày tạo**: 2026-08-18
- **Trạng thái**: Chờ duyệt (Pending Review)
- **Tác giả**: AI Assistant & devios

---

## 1. Mục tiêu & Bối cảnh

### 1.1 Vấn đề
Hiện tại trên giao diện Web UI (`AccountCard`), thẻ tài khoản hiển thị đúng số dư **Xu** (được lấy từ đuôi gói INVENTORY 70 hoặc UPDATE_MONEY), nhưng **Lượng** và **Level (NV / Farm)** hiển thị gạch ngang `—` hoặc không có dữ liệu:
- `Lượng: —`
- `Level: NV — · Farm —`

### 1.2 Nguyên nhân gốc rễ (Root Cause Investigation)
Từ kết quả dịch ngược mã nguồn game `libil2cpp.so` (arm64, `AvatarHD 3.4.4`):
1. **Level Nông trại (`farmLevel`) & Level Kho**:
   - Nằm ngay trong **12 byte đuôi của gói INVENTORY (cmd 70)** (`FarmMsgHandler.onMessage` @0x63564c - 0x635730):
     - `i32 xu` (offset 0..3): Số dư Xu (`Avatar.money[1]`)
     - `i16 farmLevel` (offset 4..5): Cấp độ nông trại (`Avatar.lvFarm` tại offset `0xF2`)
     - `i8 perLvFarm` (offset 6): % EXP nông trại (`Avatar.perLvFarm` tại offset `0xF0`)
     - `i8 levelStore` (offset 7): Cấp độ nhà kho (`FarmScr.levelStore` tại offset `0x1AC`)
     - `i32 capacityStore` (offset 8..11): Sức chứa nhà kho (`FarmScr.capacityStore` tại offset `0x1B0`)
   - Hiện tại hàm `decodeInventory` trong `server/src/game/farmData.ts` chỉ đọc `i32 xu` và bỏ qua các byte còn lại, do đó `farmLevel` luôn là `undefined`.
2. **Level Nhân vật (`playerLevel`)**:
   - Được trả về từ các gói thông tin nhân vật:
     - Gói **`-94` (REQUEST_YOUR_INFO)**: Payload chứa `i32 idUser`, `i8 lvMain` (level nhân vật), `i8 perLvMain` (% exp level NV), các điểm thuộc tính và chỉ số của avatar.
     - Hoặc có thể chủ động truy vấn thông tin nhân vật bằng `GlobalService.requestInfoOf(playerId)` hoặc `requestYourInfo()`.
3. **Số dư Lượng (`luong`)**:
   - Được cập nhật qua gói **`UPDATE_MONEY (-3)`** khi `type === 2` (Lượng) hoặc khi nhận gói thông tin nhân vật. Khi `GameClient` kết nối vào farm/game, nếu chưa có giao dịch lượng phát sinh thì gói `-3` có thể chưa được gửi lại. Khi gửi request thông tin nhân vật hoặc nhận phản hồi cập nhật từ server, số dư và level sẽ được đồng bộ.

---

## 2. Phạm vi thay đổi (Scope)

### 2.1 In-Scope
1. **Giải mã đầy đủ 12 byte đuôi của gói INVENTORY (cmd 70)** trong `farmData.ts`:
   - Trích xuất: `xu` (`i32`), `farmLevel` (`i16`), `perLvFarm` (`i8`), `levelStore` (`i8`), `capacityStore` (`i32`).
2. **Cập nhật `GameClient` (`client.ts`)**:
   - Xử lý gói `70` (INVENTORY): Lưu `this.farmLevel = inv.farmLevel` và cập nhật thông tin kho.
   - Thêm handler cho gói `-94` (`REQUEST_YOUR_INFO`): Đọc `playerLevel` và `perLvMain` để gán vào `this.playerLevel`.
   - Cung cấp hàm gửi yêu cầu thông tin nhân vật sau khi login thành công (`LOGIN_SUCESS -34`).
3. **Cập nhật `AvatarSession` (`avatarSession.ts`)**:
   - Khi `GameClient` cập nhật `farmLevel`, `playerLevel`, `luong`, `xu`, gọi `updateCachedMetrics` để đồng bộ và lưu vào DB SQLite.
   - Snapshot của session trả về đầy đủ `farmLevel`, `playerLevel`, `luong`, `xu`.
4. **Kiểm thử tự động & Verify**:
   - Unit tests cho `decodeInventory` với đầy đủ 12 byte tail.
   - Unit tests cho `GameClient` & `AvatarSession` metric caching và event emission.

### 2.2 Out-of-Scope
- Thay đổi giao diện CSS của web (Web UI đã viết sẵn các field hiển thị này).
- Sửa đổi cơ chế auto-farm khác ngoài việc tích hợp đọc metrics.

---

## 3. Thiết kế kỹ thuật chi tiết

### 3.1 Cấu trúc dữ liệu gói INVENTORY (cmd 70) Tail
```ts
export interface DecodedInventory {
  seeds: InventoryItem[];
  items: InventoryItem[];
  other: InventoryItem[][];
  xu?: number;
  farmLevel?: number;
  perLvFarm?: number;
  levelStore?: number;
  capacityStore?: number;
  restHex: string;
}
```
Chi tiết đọc từ `MyReader`:
```ts
if (r.available() >= 12) {
  try {
    xu = r.readInt();
    farmLevel = r.readShort();
    perLvFarm = r.readByte();
    levelStore = r.readByte();
    capacityStore = r.readInt();
  } catch {
    // fallback an toàn nếu gói bị thiếu byte
  }
} else if (r.available() >= 4) {
  try {
    xu = r.readInt();
  } catch {}
}
```

### 3.2 Bộ giải mã gói REQUEST_YOUR_INFO (cmd -94)
Gói `-94` trả về từ server khi client gửi request thông tin nhân vật:
```ts
export function decodePlayerInfo(body: Buffer): { playerId: number; playerLevel: number; perLvMain?: number } {
  const r = new MyReader(body);
  const playerId = r.readInt();
  const playerLevel = r.readByte();
  const perLvMain = r.available() > 0 ? r.readByte() : undefined;
  return { playerId, playerLevel, perLvMain };
}
```

### 3.3 Luồng đồng bộ metrics
```
Game Server
    │
    ├─► INVENTORY (cmd 70) ──► decodeInventory() ──► GameClient (xu, farmLevel)
    │                                                      │
    ├─► UPDATE_MONEY (-3)  ──► decodeMoney()      ──► GameClient (xu/luong)
    │                                                      │
    └─► INFO_PLAYER (-94)  ──► decodePlayerInfo() ──► GameClient (playerLevel)
                                                           │
                                                           ▼
                                                     AvatarSession
                                                           │
                                        ┌──────────────────┴──────────────────┐
                                        ▼                                     ▼
                               updateCachedMetrics()                    WebSocket emit
                                        │                                     │
                                        ▼                                     ▼
                                SQLite Database                            Web UI
```

---

## 4. Verification Plan

1. **Unit Test**:
   - `npm test` trong `avatar-web/server` để kiểm tra toàn bộ test suite.
   - Thêm test case cho `decodeInventory` kiểm tra chính xác giá trị `xu`, `farmLevel`, `perLvFarm`, `levelStore`, `capacityStore`.
   - Thêm test case cho `AvatarSession` xác minh `cachedMetrics` được cập nhật và snapshot trả về đúng giá trị.
2. **Build Test**:
   - `npm run build` trong cả `avatar-web/server` và `avatar-web/web` đảm bảo không có lỗi TypeScript / JSX.
