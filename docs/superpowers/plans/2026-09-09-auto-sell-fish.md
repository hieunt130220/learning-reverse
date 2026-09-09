# Tự Động Bán Cá Khi Rương Đầy (Auto Sell Fish) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tự động phát hiện khi rương đồ đầy cá và gửi lệnh chat `banca` (Opcode 85) để bán toàn bộ cá trong rương, giúp bot câu cá chạy liên tục 24/7 không bị dừng lại.

**Architecture:** Mở rộng `ParkService` và `GameClient` để hỗ trợ gửi và nhận tin nhắn chat trong Park (`CMD_PARK_CHAT = 85`). Trong `avatarSession.ts`, thêm trạng thái `'selling'` và hàm `executeSellFish` để gửi chuỗi lệnh `banca` kèm delay nhân văn khi gặp dialog rương đầy, xác nhận việc bán cá qua sự kiện chat/dialog/metrics và tiếp tục vòng lặp câu cá sau khi dọn sạch rương.

**Tech Stack:** TypeScript, Node.js, Big-Endian Binary Protocol (`Message`, `MyReader`, `MyWriter`), GitNexus.

**Spec:** `docs/superpowers/specs/2026-09-09-auto-sell-fish-design.md`

## Global Constraints
- Tuân thủ quy ước mã nguồn hiện tại của `avatar-web`.
- KHÔNG thực hiện TDD (không viết test files mới trừ khi user yêu cầu).
- Trước khi chỉnh sửa bất kỳ symbol nào, PHẢI chạy `gitnexus_impact({target: "symbolName", direction: "upstream"})`.
- Trước khi commit, PHẢI chạy `gitnexus_detect_changes()`.
- Kết thúc commit message bằng: `Co-Authored-By: Claude Code <noreply@anthropic.com>`.

---

### Task 1: Cài đặt lệnh gửi và nhận Chat trong Park (`parkService.ts` & `client.ts`)

**Files:**
- Modify: `avatar-web/server/src/game/parkService.ts`
- Modify: `avatar-web/server/src/game/client.ts`

**Interfaces:**
- Consumes: `Message.create`, `Session.send`, `MyReader`
- Produces: `CMD_PARK_CHAT = 85`, `ParkService.chat(text, style)`, `GameClient.chatPark(text, style)`, event `park-chat`

- [x] **Step 1: Thêm opcode và method `chat` trong `parkService.ts`**
  Thêm hằng số `CMD_PARK_CHAT = 85`.
  Cài đặt hàm `chat(text: string, style = 0): void`:
  ```typescript
  export const CMD_PARK_CHAT = 85;

  /**
   * Gửi tin nhắn chat trong Park / Khu câu cá (TX-85).
   * Payload: utf text, i8 style (mặc định 0).
   * Dùng cho các lệnh chat in-game như "banca", "cauca"...
   */
  chat(text: string, style = 0): void {
    if (typeof text !== 'string' || text.length === 0) {
      throw new Error('chat: nội dung text không hợp lệ');
    }
    const m = Message.create(CMD_PARK_CHAT);
    m.writer!.writeUTF(text).writeByte(style);
    this.session.send(m);
  }
  ```

- [x] **Step 2: Cập nhật `GameClient` trong `client.ts`**
  - Thêm method ủy quyền:
    ```typescript
    chatPark(text: string, style = 0): void {
      this.park.chat(text, style);
    }
    ```
  - Trong `onMessage(msg: Message)`, thêm khối `case 85:` (`CMD_PARK_CHAT`):
    ```typescript
    case 85: { // PARK_CHAT — tin nhắn chat trong Park / phản hồi lệnh chat
      try {
        const r = msg.reader!;
        const idUser = r.readInt();
        const text = r.readUTF();
        let style = 0;
        if (r.available() >= 1) {
          style = r.readByte();
        }
        this.emit('park-chat', { idUser, text, style });
        this.emit('log', `[chat] ${idUser}: ${text}`);
      } catch (err) {
        this.emit('log', `decode park-chat (85) lỗi: ${(err as Error).message}`);
      }
      break;
    }
    ```

- [x] **Step 3: Kiểm tra build TypeScript**
  Run: `npm --prefix avatar-web/server run build`
  Expected: Build thành công không có lỗi syntax/type.

- [x] **Step 4: Commit Task 1**
  `git commit -m "feat(fishing): add park chat protocol support for opcode 85"`

---

### Task 2: Cài đặt logic tự động bán cá `executeSellFish` trong `avatarSession.ts`

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts`

**Interfaces:**
- Consumes: `client.chatPark`, `client.cauCaXong`, event `park-chat`, event `dialog`, event `metrics`
- Produces: `FishingStatus = 'selling'`, `executeSellFish`, tự động dọn rương khi `startFishing` hoặc `quanCau` gặp dialog rương đầy

- [ ] **Step 1: Mở rộng kiểu dữ liệu `FishingStatus`**
  Trong `avatarSession.ts` (hoặc nơi định nghĩa `FishingStatus`), bổ sung giá trị `'selling'`:
  ```typescript
  export type FishingStatus =
    | 'idle'
    | 'moving'
    | 'starting'
    | 'casting'
    | 'hooked'
    | 'caught'
    | 'resting'
    | 'buying'
    | 'selling'
    | 'rejected';
  ```

- [ ] **Step 2: Cài đặt phương thức `executeSellFish` trong `AvatarSession`**
  Cài đặt logic bán cá có chốt chặn an toàn:
  - Gửi `client.cauCaXong()` để thoát lượt câu cũ.
  - Vòng lặp tối đa 40 lần (số ô rương): gửi `client.chatPark('banca')`.
  - Lắng nghe sự kiện `park-chat` (`"Bạn vừa bán một con cá..."`), `dialog` (`"không có cá"`), `metrics` (Xu tăng).
  - Delay `800ms - 1200ms` giữa các lượt bán.
  - Dừng vòng lặp khi hết cá hoặc sau 2 lần không có phản hồi mới.
  - Trả về `true` nếu đã bán được ít nhất 1 con cá; `false` nếu không thể bán.

- [ ] **Step 3: Tích hợp `executeSellFish` vào `runFishingLoop` tại 2 điểm phát hiện rương đầy**
  - **Điểm 1 (Khi gọi `startFishing`)**:
    Tại dòng xử lý `if (errText.includes('rương') && (errText.includes('đầy') || errText.includes('không thể câu')))`:
    Thay vì `return`, gọi `const sold = await this.executeSellFish(client, epoch, signal);`
    Nếu `sold == true`: tiếp tục vòng lặp (`continue outerLoop;`).
    Nếu `sold == false`: dừng câu an toàn (`this.fishingRuntime.status = 'rejected'; return;`).
  - **Điểm 2 (Khi quăng cần `quanCau`)**:
    Tại dòng xử lý dialog lỗi quăng cần `castResult`:
    Bổ sung điều kiện kiểm tra:
    ```typescript
    if (castErrText.includes('rương') && (castErrText.includes('đầy') || castErrText.includes('không thể câu'))) {
      const sold = await this.executeSellFish(client, epoch, signal);
      if (!sold) return;
      continue outerLoop;
    }
    ```

- [ ] **Step 4: Kiểm tra build TypeScript**
  Run: `npm --prefix avatar-web/server run build`
  Expected: Build thành công không có lỗi type.

- [ ] **Step 5: Commit Task 2**
  `git commit -m "feat(fishing): implement auto sell fish loop on inventory full"`

---

### Task 3: Kiểm tra GitNexus Impact, Detect Changes & Verification

**Files:**
- Inspect: Toàn bộ diff của các file đã sửa đổi

- [ ] **Step 1: Chạy GitNexus Impact Analysis**
  Chạy `gitnexus_impact` cho các symbol đã chỉnh sửa: `chat`, `chatPark`, `executeSellFish`, `runFishingLoop`.

- [ ] **Step 2: Chạy GitNexus Detect Changes**
  Run: `gitnexus_detect_changes()`
  Expected: Chỉ các file `parkService.ts`, `client.ts`, `avatarSession.ts` nằm trong danh sách thay đổi.

- [ ] **Step 3: Kiểm tra toàn diện**
  Đảm bảo server build sạch sẽ, không có runtime exception hay warning chưa xử lý.
