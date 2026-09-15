# Fix Fishing Rod Buy Packet (TX-92 CMD_AVATAR_BUY_ITEM) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sửa lỗi "Mua Cần câu Lục Sĩ thất bại: server không phản hồi gói mua vật phẩm" bằng cách chuyển opcode mua cần câu từ TX-43 (`BUY_ITEM_STACK`) sang TX-92 (`CMD_AVATAR_BUY_ITEM`), bổ sung xử lý dialog phản hồi từ chối và abort signal cleanup.

**Architecture:** Mở rộng `ParkService` để gửi TX-92 (`i16 idPart, i8 typeMoney, i8 saleFocus = -1`) theo đúng contract `AvatarService.doBuyItem` (RVA 0x9610B0); expose qua `GameClient.buyItem()`; cập nhật nhánh mua cần câu trong `AvatarSession` để dùng `client.buyItem()`.

**Tech Stack:** TypeScript, Node.js, AvatarHD protocol (Binary Message / DataOutputStream / DataInputStream).

**Spec:** `docs/superpowers/specs/2026-09-15-fix-fishing-rod-buy-packet-design.md`

## Global Constraints
- Tuân thủ quy tắc GitNexus: chạy `gitnexus_impact` trước khi sửa symbol, chạy `gitnexus_detect_changes` trước khi hoàn tất.
- KHÔNG tạo test files mới (tuân thủ quy định KHÔNG TDD của dự án trong CLAUDE.md).
- Giữ nguyên wire contract của các loại vật phẩm khác (vé câu, mồi câu vẫn giữ TX-43).

---

### Task 1: Thêm opcode TX-92 và phương thức `doBuyItem` trong `ParkService`, expose qua `GameClient`

**Files:**
- Modify: `avatar-web/server/src/game/parkService.ts:25-35`, `avatar-web/server/src/game/parkService.ts:150-160`
- Modify: `avatar-web/server/src/game/client.ts:745-755`

**Interfaces:**
- Produces: `CMD_AVATAR_BUY_ITEM = -92`, `ParkService.doBuyItem(id: number, typeMoney: number, saleFocus?: number): void`, `GameClient.buyItem(id: number, typeMoney: number, saleFocus?: number): void`
- Consumes: `Message.create`, `myWriter`

- [x] **Step 1: Khai báo constant và implement `doBuyItem` trong `ParkService`**
  Trong `avatar-web/server/src/game/parkService.ts`:
  1. Thêm constant:
     ```ts
     /**
      * AVATAR_BUY_ITEM: i16 idPart, i8 type (1=Xu, 2=Lượng), i8 saleFocus (-1=không giảm giá).
      * Opcode -92 (0xA4): AvatarService.doBuyItem(int part, int typeBuy)
      * RVA 0x9610B0, gọi từ MapScr.IActionSelectedMoney (0x854834).
      * Mua vật phẩm trang bị / cần câu / part từ shop.
      */
     export const CMD_AVATAR_BUY_ITEM = -92;
     ```
  2. Implement method `doBuyItem`:
     ```ts
     /**
      * BUY_ITEM (TX-92): Mua vật phẩm trang bị / cần câu / part từ shop.
      * Payload: i16 idPart, i8 typeMoney (1=Xu, 2=Lượng), i8 saleFocus (-1 = không giảm giá).
      */
     doBuyItem(id: number, typeMoney: number, saleFocus = -1): void {
       if (!Number.isSafeInteger(id) || id <= 0) {
         throw new Error(`doBuyItem: id không hợp lệ: ${id}`);
       }
       if (!Number.isSafeInteger(typeMoney) || (typeMoney !== 1 && typeMoney !== 2)) {
         throw new Error(`doBuyItem: typeMoney không hợp lệ: ${typeMoney}`);
       }
       if (!Number.isSafeInteger(saleFocus)) {
         throw new Error(`doBuyItem: saleFocus không hợp lệ: ${saleFocus}`);
       }
       const m = Message.create(CMD_AVATAR_BUY_ITEM);
       m.writer!.writeShort(id).writeByte(typeMoney).writeByte(saleFocus);
       this.session.send(m);
     }
     ```
  3. Cập nhật `doParkBuyItem`:
     ```ts
     doParkBuyItem(id: number, typeMoney: number): void {
       this.doBuyItem(id, typeMoney, -1);
     }
     ```

- [x] **Step 2: Expose `buyItem` trong `GameClient`**
  Trong `avatar-web/server/src/game/client.ts`:
  ```ts
  buyItem(id: number, typeMoney: number, saleFocus = -1): void {
    this.park.doBuyItem(id, typeMoney, saleFocus);
  }
  ```

- [x] **Step 3: Kiểm tra compile**
  Run: `cd avatar-web/server && npm run typecheck`
  Expected: Không có lỗi TypeScript.

---

### Task 2: Cập nhật nhánh mua cần câu trong `AvatarSession`

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts:2739-2778`

**Interfaces:**
- Consumes: `GameClient.buyItem(id, typeMoney, saleFocus)`
- Produces: Luồng mua cần câu hoàn chỉnh với TX-92, nhận diện phản hồi RX-92, RX-40 (sở hữu/đang dùng hoặc thiếu tiền), và abort signal.

- [x] **Step 1: Cập nhật logic mua cần câu trong `avatarSession.ts`**
  Thay thế đoạn xử lý `missingType === 'rod'` trong `avatarSession.ts` (khoảng dòng 2739–2778):
  ```ts
    } else if (missingType === 'rod') {
      const rod = FISHING_RODS.find((r) => r.id === cfg.rodType)!;
      this.pushLog(`[câu cá] Đang gửi lệnh mua ${rod.name}…`);
      let settled = false;
      let timer: NodeJS.Timeout | undefined;
      let onBuy: (evt: { itemId: number; message?: string }) => void;
      let onDialog: (reason: string) => void;
      let onAbort: () => void;

      const cleanup = () => {
        client.removeListener('park-buy-item', onBuy);
        client.removeListener('dialog', onDialog);
        signal.removeEventListener('abort', onAbort);
        if (timer) clearTimeout(timer);
      };

      const buyPromise = new Promise<{ ok: boolean; message?: string; alreadyOwned?: boolean }>((resolve) => {
        timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve({ ok: false, message: 'server không phản hồi gói mua vật phẩm (timeout 4s)' });
        }, 4000);

        onBuy = (evt: { itemId: number; message?: string }): void => {
          if (settled) return;
          settled = true;
          cleanup();
          if (evt.itemId === -1) {
            resolve({ ok: false, message: evt.message || 'server từ chối mua' });
          } else {
            resolve({ ok: true, message: evt.message });
          }
        };

        onDialog = (reason: string): void => {
          if (settled) return;
          const lower = reason.toLowerCase();
          if (lower.includes('đang sử dụng') || lower.includes('đã có')) {
            settled = true;
            cleanup();
            resolve({ ok: true, message: reason, alreadyOwned: true });
          } else if (lower.includes('không đủ') || lower.includes('hết tiền') || lower.includes('bạn không có đủ')) {
            settled = true;
            cleanup();
            resolve({ ok: false, message: reason });
          }
        };

        onAbort = () => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve({ ok: false, message: 'bị hủy bởi người dùng' });
        };

        client.on('park-buy-item', onBuy);
        client.on('dialog', onDialog);
        signal.addEventListener('abort', onAbort, { once: true });
      });

      client.buyItem(rod.id, rod.typeMoney, -1);
      const res = await buyPromise;
      if (!res.ok) {
        const msg = `Mua ${rod.name} thất bại: ${res.message || 'server từ chối'}`;
        this.pushLog(`[câu cá] ${msg} — Dừng câu`);
        this.fishingRuntime.lastError = msg;
        return false;
      }
      if (res.alreadyOwned) {
        this.pushLog(`[câu cá] Nhân vật đã sở hữu/đang sử dụng ${rod.name}`);
      } else {
        this.pushLog(`[câu cá] Đã mua thành công ${rod.name}`);
      }
      await this.delayCancellable(1000, signal);
  ```

- [x] **Step 2: Kiểm tra biên dịch**
  Run: `cd avatar-web/server && npm run typecheck`
  Expected: Exit code 0, không có lỗi.

---

### Task 3: Build & Kiểm tra GitNexus Graph

**Files:**
- Toàn bộ codebase đã thay đổi

- [x] **Step 1: Build production bundle**
  Run: `cd avatar-web/server && npm run build`
  Expected: Build thành công ra thư mục `dist/`.

- [x] **Step 2: GitNexus graph changes analysis**
  Run: `detect_changes({scope: "unstaged", repo: "learning-reverse"})`
  Expected: Đảm bảo không phá vỡ execution flow nào khác ngoài purchase handler.
