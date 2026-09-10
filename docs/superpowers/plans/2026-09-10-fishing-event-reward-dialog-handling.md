# Fishing Event Reward Dialog Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xử lý chính xác các hộp thoại phần thưởng sự kiện/chúc mừng từ server khi câu cá để bot không bắt nhầm thành lỗi quăng cần và không dừng auto câu cá.

**Architecture:** Bổ sung các hàm kiểm tra phân loại `isRewardDialog` và `isInformationalDialog` trong `client.ts`. Tích hợp bộ lọc này vào `avatarSession.ts` tại các điểm tiếp nhận dialog khi quăng cần (`onCastDialog`), bắt đầu câu (`onStartDialog`), và vào map (`joinParkWithRetry`) để ghi nhận log phần thưởng và tiếp tục vòng lặp thay vì ngắt phiên câu.

**Tech Stack:** TypeScript, Node.js (avatar-web backend)

**Spec:** `docs/superpowers/specs/2026-09-10-fishing-event-reward-dialog-handling-design.md`

## Global Constraints
- Tuân thủ quy tắc GitNexus: chạy `gitnexus_impact` trước khi sửa hàm và `gitnexus_detect_changes` trước khi commit.
- KHÔNG thực hiện TDD: không tạo file test trước khi viết code theo quy định của CLAUDE.md.
- Đảm bảo typecheck `npm run build` trong `avatar-web/server` thành công không lỗi type.

---

### Task 1: Bổ sung helper phân loại `isRewardDialog` và `isInformationalDialog` trong `client.ts`

**Files:**
- Modify: `avatar-web/server/src/game/client.ts:170-195`

**Interfaces:**
- Consumes: `PARK_ALREADY_IN_AREA_DIALOG` (client.ts), `parseQuestDialogText` (progressQuests.ts)
- Produces: `isRewardDialog(text: string): boolean`, `isInformationalDialog(reason: string): boolean`

- [x] **Step 1: Định nghĩa và export `isRewardDialog` và `isInformationalDialog` trong `client.ts`**
  Thêm 2 hàm helper vào sau `PARK_ALREADY_IN_AREA_DIALOG` trong `avatar-web/server/src/game/client.ts`:
  ```typescript
  /**
   * Kiểm tra xem một dialog từ server có phải là thông báo phần thưởng / sự kiện hay không.
   */
  export function isRewardDialog(text: string): boolean {
    const normalized = text.trim().toLowerCase();
    if (normalized.includes('chúc mừng')) return true;
    if (
      normalized.includes('nhận được')
      && !normalized.includes('không thể')
      && !normalized.includes('không được')
      && !normalized.includes('thất bại')
    ) {
      return true;
    }
    if (normalized.includes('phần thưởng')) return true;
    return false;
  }

  /**
   * Kiểm tra xem một dialog từ server có phải là thông báo thông tin chung cần bỏ qua
   * (không phải lỗi từ chối thao tác câu cá, di chuyển, hay vào map).
   */
  export function isInformationalDialog(reason: string): boolean {
    const trimmed = reason.trim();
    if (!trimmed) return true;

    // 1. Dialog "đã ở trong khu vực này rồi"
    if (trimmed === PARK_ALREADY_IN_AREA_DIALOG) return true;

    // 2. Dialog cập nhật tiến trình nhiệm vụ (Tân Thủ, Nhà Nông, Thợ Câu)
    if (parseQuestDialogText(reason) !== null) return true;

    // 3. Hộp thoại thông báo nhận thưởng sự kiện / chúc mừng
    if (isRewardDialog(trimmed)) return true;

    // 4. Hộp thoại broadcast thông báo hệ thống / bảo trì định kỳ
    const lower = trimmed.toLowerCase();
    if (
      lower.startsWith('thông báo:')
      || lower.startsWith('hệ thống:')
      || lower.startsWith('server:')
    ) {
      return true;
    }

    return false;
  }
  ```

- [x] **Step 2: Kiểm tra biên dịch TypeScript**
  Run: `npm --prefix avatar-web/server run build`
  Expected: Không có lỗi typecheck hoặc build error.

- [x] **Step 3: Commit**
  Run: `git add avatar-web/server/src/game/client.ts`
  Run: `git commit -m "feat(game): add isRewardDialog and isInformationalDialog helpers"`

---

### Task 2: Áp dụng bộ lọc `isInformationalDialog` và ghi nhận phần thưởng trong `avatarSession.ts`

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts`

**Interfaces:**
- Consumes: `isRewardDialog`, `isInformationalDialog` từ `../game/client.js`
- Produces: Vòng lặp câu cá không bị ngắt khi nhận dialog thưởng hoặc thông báo hệ thống

- [x] **Step 1: Import helper vào `avatarSession.ts`**
  Cập nhật dòng import từ `../game/client.js`:
  ```typescript
  import {
    PARK_ALREADY_IN_AREA_DIALOG,
    isRewardDialog,
    isInformationalDialog,
    GameClient,
  } from '../game/client.js';
  ```

- [x] **Step 2: Cập nhật `onCastDialog` trong `catchPromise` (quăng cần)**
  Trong `runFishingLoop` (khoảng dòng 2527-2537), sửa `onCastDialog`:
  ```typescript
          const onCastDialog = (reason: string) => {
            // Bỏ qua quest dialogs, dialog "đã ở khu vực", và dialog nhận thưởng/thông tin
            if (isInformationalDialog(reason)) {
              if (isRewardDialog(reason)) {
                this.pushLog(`[câu cá] nhận phần thưởng: ${reason}`);
              }
              return;
            }
            if (settled) return;
            settled = true;
            cleanup();
            resolve(reason); // trả về lỗi để caller xử lý
          };
  ```

- [x] **Step 3: Cập nhật `onDialog` trong `rx45Promise` (bắt đầu câu)**
  Trong `runFishingLoop` (khoảng dòng 2380-2392), sửa `onDialog`:
  ```typescript
          const onDialog = (reason: string) => {
            // Bỏ qua các dialog thông tin không liên quan đến lỗi câu cá
            if (isInformationalDialog(reason)) {
              if (isRewardDialog(reason)) {
                this.pushLog(`[câu cá] nhận phần thưởng: ${reason}`);
              }
              return;
            }
            if (settled) return;
            settled = true;
            cleanup();
            resolve({ iss: false, error: reason });
          };
  ```

- [x] **Step 4: Cập nhật `onDialog` trong `joinParkWithRetry` (vào map)**
  Trong `joinParkWithRetry` (khoảng dòng 1807-1817), sửa `onDialog`:
  ```typescript
          const onDialog = (reason: string) => {
            // Bỏ qua dialog "đã ở đúng khu", dialog nhiệm vụ, và dialog thông tin/phần thưởng
            if (isInformationalDialog(reason)) {
              return;
            }
            reject(new Error(`server từ chối vào map: ${reason}`));
          };
  ```

- [x] **Step 5: Kiểm tra biên dịch TypeScript**
  Run: `npm --prefix avatar-web/server run build`
  Expected: Build thành công 0 lỗi.

- [x] **Step 6: Kiểm tra phạm vi thay đổi bằng GitNexus**
  Run: `gitnexus_detect_changes({scope: "unstaged"})`
  Expected: Chỉ các file `client.ts` và `avatarSession.ts` bị thay đổi trong phạm vi mong đợi.

- [x] **Step 7: Commit**
  Run: `git add avatar-web/server/src/session/avatarSession.ts`
  Run: `git commit -m "fix(fishing): ignore informational and reward dialogs in cast and join loops"`
