# Sửa Lỗi Mua Mồi Câu Xếp Chồng (Opcode -43 BUY_ITEM_STACK) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sửa lỗi bot mua mồi câu làm đầy rương và mua thất bại do sai opcode, chuyển sang opcode chuẩn AvatarHD `-43` (`BUY_ITEM_STACK`) để mồi câu được xếp chồng và kiểm tra phản hồi giao dịch chính xác.

**Architecture:** Thêm định nghĩa opcode `-43` (`CMD_AVATAR_BUY_ITEM_STACK`) và hàm `doBuyItemStack(idPart, num, typeMoney)` vào `ParkService` và `GameClient`. Trong `avatarSession.ts`, thay thế vòng lặp mua đơn lẻ bằng một lệnh mua xếp chồng duy nhất với số lượng cấu hình (`baitQuantity`), đồng thời sửa cơ chế xác nhận giao dịch (bắt buộc nhận phản hồi trừ tiền hoặc dialog/buy-item, loại bỏ false-positive).

**Tech Stack:** TypeScript, Node.js, Big-Endian Binary Protocol (`Message`, `MyReader`, `MyWriter`), GitNexus.

**Spec:** `docs/superpowers/specs/2026-09-09-fix-fishing-bait-purchase-design.md`

## Global Constraints
- Tuân thủ quy ước mã nguồn hiện tại của `avatar-web`.
- KHÔNG thực hiện TDD (không viết test files mới trừ khi user yêu cầu).
- Trước khi chỉnh sửa bất kỳ symbol nào, PHẢI chạy `gitnexus_impact({target: "symbolName", direction: "upstream"})`.
- Trước khi commit, PHẢI chạy `gitnexus_detect_changes()`.
- Kết thúc commit message bằng: `Co-Authored-By: Claude Code <noreply@anthropic.com>`.

---

### Task 1: Cập nhật ParkService & GameClient với Opcode -43 (`BUY_ITEM_STACK`)

**Files:**
- Modify: `avatar-web/server/src/game/parkService.ts:19-30, 122-133`
- Modify: `avatar-web/server/src/game/client.ts:610-618`

**Interfaces:**
- Consumes: `Message.create`, `Session.send`
- Produces: `CMD_AVATAR_BUY_ITEM_STACK = -43`, `ParkService.doBuyItemStack(id, num, typeMoney)`, `GameClient.buyItemStack(id, num, typeMoney)`

- [x] **Step 1: Thêm opcode và method trong `parkService.ts`**
  Thêm hằng số `CMD_AVATAR_BUY_ITEM_STACK = -43` (thay thế cho việc lạm dụng `-24` và `-92`).
  Cài đặt hàm `doBuyItemStack(id: number, num: number, typeMoney: number): void`:
  ```typescript
  export const CMD_AVATAR_BUY_ITEM_STACK = -43;

  doBuyItemStack(id: number, num: number, typeMoney: number): void {
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new Error(`doBuyItemStack: id không hợp lệ: ${id}`);
    }
    if (!Number.isSafeInteger(num) || num <= 0) {
      throw new Error(`doBuyItemStack: num không hợp lệ: ${num}`);
    }
    if (!Number.isSafeInteger(typeMoney) || (typeMoney !== 1 && typeMoney !== 2)) {
      throw new Error(`doBuyItemStack: typeMoney không hợp lệ: ${typeMoney}`);
    }
    const m = Message.create(CMD_AVATAR_BUY_ITEM_STACK);
    m.writer!.writeShort(id).writeInt(num).writeByte(typeMoney);
    this.session.send(m);
  }
  ```

- [x] **Step 2: Thêm method ủy quyền trong `GameClient` (`client.ts`)**
  Thêm hàm `buyItemStack(id: number, num: number, typeMoney: number)` gọi tới `this.park.doBuyItemStack(id, num, typeMoney)`.
  Giữ lại `parkBuyItem` gọi `doBuyItemStack(id, 1, typeMoney)` để tương thích ngược.

- [x] **Step 3: Kiểm tra build TypeScript**
  Run: `npm run build` tại `avatar-web/server`
  Expected: Build thành công không có lỗi type.

---

### Task 2: Cập nhật giải mã phản hồi mua hàng trong `GameClient`

**Files:**
- Modify: `avatar-web/server/src/game/client.ts:1020-1067`

**Interfaces:**
- Consumes: `msg: Message` từ server network
- Produces: Sự kiện `park-buy-item` khi server gửi phản hồi mua vật phẩm

- [x] **Step 1: Bổ sung lắng nghe `case -43` trong `onMessage` của `GameClient`**
  Tại khối xử lý `case -92: case -24: case -8:`, thêm `case -43:`.
  Đảm bảo giải mã an toàn các trường `itemId`, `price`, `typeMoney`, `message`, `xu`, `luong`, `luongKhoa`.

- [x] **Step 2: Kiểm tra build TypeScript**
  Run: `npm run build` tại `avatar-web/server`
  Expected: Build thành công không có lỗi syntax/type.

---

### Task 3: Cập nhật logic mua vật phẩm trong `avatarSession.ts`

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts:1910-2015`

**Interfaces:**
- Consumes: `client.buyItemStack`, `FISHING_BAITS`, `FISHING_TICKETS`, `FISHING_RODS`
- Produces: Giao dịch mua mồi/vé dạng stack an toàn, không mua trùng, xác nhận kết quả thật

- [x] **Step 1: Sửa logic mua mồi câu (`missingType === 'bait'`)**
  - Đọc số lượng cần mua từ `cfg.baitQuantity` (mặc định 50).
  - Gửi 1 lệnh duy nhất: `client.buyItemStack(bait.id, quantity, bait.typeMoney)`.
  - Lắng nghe đồng thời:
    - Sự kiện `park-buy-item`: Nếu `itemId === bait.id` hoặc `itemId !== -1` -> thành công.
    - Sự kiện `metrics`: Nếu `xu` giảm (hoặc `luong` giảm khi `typeMoney=2`) -> thành công.
    - Sự kiện `dialog`: Nếu có thông báo rương đầy hoặc không đủ tiền -> ghi nhận thất bại và lý do cụ thể.
  - Sửa điều kiện kết quả:
    - Loại bỏ hoàn toàn `if (successCount === 0 && failed)`.
    - Phải kiểm tra: `if (!isSuccess) { ... return false; }`.
    - Chỉ log `[câu cá] Đã mua thành công X` khi thực sự có xác nhận từ server.

- [x] **Step 2: Sửa logic mua vé câu (`missingType === 'ticket'`)**
  - Sử dụng `client.buyItemStack(ticket.id, 1, ticket.typeMoney)` thay vì opcode cũ.
  - Lắng nghe xác nhận tương tự.

- [x] **Step 3: Kiểm tra build TypeScript**
  Run: `npm run build` tại `avatar-web/server`
  Expected: Build thành công không có lỗi type.

---

### Task 4: Kiểm tra Impact, Detect Changes & Verification

**Files:**
- Inspect: Toàn bộ diff của các file đã sửa đổi

- [x] **Step 1: Chạy GitNexus Impact Analysis**
  Chạy `gitnexus_impact` cho các symbol đã chỉnh sửa: `doParkBuyItem`, `doBuyItemStack`, `parkBuyItem`, `executeParkPurchase`.

- [x] **Step 2: Chạy GitNexus Detect Changes**
  Run: `gitnexus_detect_changes()`
  Expected: Chỉ các file `parkService.ts`, `client.ts`, `avatarSession.ts` nằm trong danh sách thay đổi.

- [x] **Step 3: Test live trên tài khoản game của User & chuẩn hoá Inference Endpoint**
  - Chạy bot câu cá trên map 14.
  - Khi bot phát hiện cần mua mồi cơm: di chuyển về Map 13.
  - Gửi `TX-43` mua 50 mồi cơm (`doBuyItemStack`).
  - Server trừ xu (giảm 250 xu) và gửi xác nhận.
  - Bot quay trở lại Map 14, gửi `TX45` bắt đầu câu cá và nhận `RX45: iss=true`.
  - Chuẩn hoá endpoint fallback trong `avatarSession.ts` sang `http://127.0.0.1:8080/infer`.
