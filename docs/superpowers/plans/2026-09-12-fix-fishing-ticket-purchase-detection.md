# Fix Fishing Ticket Purchase Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khắc phục triệt để lỗi bot tự động mua thêm vé câu cá khi trong rương đã có vé hợp lệ bằng cách chuẩn hoá việc nhận diện thông báo thiếu vé từ server AvatarHD.

**Architecture:** Bổ sung helper `isMissingFishingTicketDialog` trong `client.ts` kiểm tra chuỗi thông báo thiếu vé chính xác theo giao thức game (loại bỏ việc match từ khóa `'vé'` lỏng lẻo gây dương tính giả với vé quay số/sự kiện). Cập nhật `startFishingSession` trong `avatarSession.ts` sử dụng helper này kèm log chi tiết, đồng thời loại bỏ việc tự mua vé giữa chừng trong vòng lặp quăng cần `runFishingLoop` để chuyển quyền xử lý về đầu chu kỳ handshake.

**Tech Stack:** TypeScript, Node.js (avatar-web backend)

**Spec:** `docs/superpowers/specs/2026-09-12-fix-fishing-ticket-purchase-detection-design.md`

## Global Constraints
- **Quy tắc GitNexus:** Chạy `impact` trước khi chỉnh sửa code và chạy `detect_changes` trước khi commit.
- **KHÔNG thực hiện TDD:** Không tạo file test mới trừ khi user yêu cầu; đi thẳng vào production code theo quy định của `CLAUDE.md`.
- **Compile Verification:** Chạy `npm run build` trong `avatar-web/server` sau mỗi task để đảm bảo không có lỗi type.
- **Nguyên tắc No Placeholders:** Không để lại TODO, TBD hoặc code mô tả mơ hồ.

---

### Task 1: Thêm helper `isMissingFishingTicketDialog` trong `client.ts`

**Files:**
- Modify: `avatar-web/server/src/game/client.ts:240-250`

**Interfaces:**
- Consumes: Không có (xử lý chuỗi string)
- Produces: `isMissingFishingTicketDialog(reason: string): boolean`

- [ ] **Step 1: Bổ sung và export hàm `isMissingFishingTicketDialog` trong `client.ts`**
  Tại [avatar-web/server/src/game/client.ts](avatar-web/server/src/game/client.ts), sau hàm `isInformationalDialog` (~dòng 248), thêm:
  ```typescript
  /**
   * Kiểm tra xem một dialog từ chối từ server có phải do nhân vật thiếu vé câu cá hay không.
   * Sử dụng cụm từ ngữ cảnh chính xác để tránh bắt nhầm các thông báo nhận vé quay số,
   * vé sự kiện, vé may mắn...
   */
  export function isMissingFishingTicketDialog(reason: string): boolean {
    const normalized = reason.trim().toLowerCase();
    if (
      normalized.includes('cần vé câu')
      || normalized.includes('phải có vé')
      || normalized.includes('vé câu cá')
      || (normalized.includes('vé') && normalized.includes('khu vực này'))
      || (normalized.includes('vé') && normalized.includes('bến tàu'))
    ) {
      return true;
    }
    return false;
  }
  ```

- [ ] **Step 2: Kiểm tra biên dịch TypeScript**
  Run: `npm run build -w avatar-web/server`
  Expected: Build thành công không có lỗi type.

- [ ] **Step 3: Kiểm tra GitNexus & Commit**
  Run GitNexus detect changes và commit:
  ```bash
  git add avatar-web/server/src/game/client.ts
  git commit -m "feat(fishing): add isMissingFishingTicketDialog helper for accurate ticket rejection detection"
  ```

---

### Task 2: Cập nhật logic phân loại lỗi mua vé trong `avatarSession.ts`

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts:15-20, 2975-2995, 3230-3265`

**Interfaces:**
- Consumes: `isMissingFishingTicketDialog` từ `./game/client.js`
- Produces: Logic xử lý mua vé câu chuẩn xác trong `startFishingSession` và loại bỏ false positive mua vé trong `runFishingLoop`.

- [ ] **Step 1: Import `isMissingFishingTicketDialog` vào `avatarSession.ts`**
  Tại đầu file `avatar-web/server/src/session/avatarSession.ts` (~dòng 15), cập nhật import từ `./game/client.js`:
  ```typescript
  import {
    GameClient,
    isInformationalDialog,
    isMissingFishingTicketDialog,
    isRewardDialog,
    PARK_ALREADY_IN_AREA_DIALOG,
  } from '../game/client.js';
  ```

- [ ] **Step 2: Cập nhật `startFishingSession` để sử dụng `isMissingFishingTicketDialog`**
  Tại `avatarSession.ts` (~dòng 2979-2993), thay thế đoạn code xác định `missingType`:
  ```typescript
  let missingType: 'ticket' | 'rod' | 'bait' | null = null;
  if (isMissingFishingTicketDialog(errText)) {
    missingType = 'ticket';
    this.pushLog(`[câu cá] Server từ chối vì thiếu vé câu: "${reason}"`);
  } else if (errText.includes('mồi')) {
    missingType = 'bait';
  } else if (
    errText.includes('cần câu')
    || errText.includes('sử dụng cần')
    || errText.includes('phải có cần')
    || errText.includes('cần tre')
    || errText.includes('cần sắt')
  ) {
    missingType = 'rod';
  }
  ```

- [ ] **Step 3: Cập nhật `runFishingLoop` loại bỏ nhánh mua vé đột ngột giữa chừng**
  Tại `avatarSession.ts` (~dòng 3234-3262), sửa khối kiểm tra dialog lỗi khi quăng cần:
  ```typescript
  let castMissingType: 'rod' | 'bait' | null = null;
  if (castErrText.includes('mồi')) {
    castMissingType = 'bait';
  } else if (
    castErrText.includes('cần câu')
    || castErrText.includes('sử dụng cần')
    || castErrText.includes('phải có cần')
    || castErrText.includes('cần tre')
    || castErrText.includes('cần sắt')
  ) {
    castMissingType = 'rod';
  } else if (isMissingFishingTicketDialog(castErrText)) {
    // Vé câu hết hạn trong lúc câu cá: kết thúc phiên câu hiện tại
    // và để startFishingSession ở chu kỳ sau xử lý mua vé đúng quy trình handshake
    this.pushLog(`[câu cá] Vé câu đã hết hạn: "${catchResult}" — kết thúc lượt để mua lại vé…`);
    try { client.cauCaXong(); } catch { /* bỏ qua */ }
    await this.delayCancellable(1000, signal);
    if (!(await this.startFishingSession(client, generation, epoch, signal))) return;
    continue;
  }

  if (castMissingType) {
    const bought = await this.executeParkPurchase(client, epoch, signal, castMissingType);
    if (!bought) return;
    // Sau khi mua mồi/cần, gửi cauCaXong để kết thúc session câu cũ
    // rồi bắt đầu lại từ startFishing qua startFishingSession
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

- [ ] **Step 4: Kiểm tra biên dịch TypeScript**
  Run: `npm run build -w avatar-web/server`
  Expected: Build thành công không có lỗi type.

- [ ] **Step 5: Kiểm tra GitNexus & Commit**
  Run GitNexus detect changes và commit:
  ```bash
  git add avatar-web/server/src/session/avatarSession.ts
  git commit -m "fix(fishing): use precise ticket rejection detection and eliminate false positive ticket purchases"
  ```
