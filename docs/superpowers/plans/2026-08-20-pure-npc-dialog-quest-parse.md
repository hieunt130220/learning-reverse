# Pure NPC Dialog Quest Parsing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đồng bộ tiến trình nhiệm vụ Tân Thủ và Nhà Nông hoàn toàn 100% từ thông báo hộp thoại NPC Lái buôn (không tự đếm nông trại), tự động gửi tương tác NPC khi vào farm và tối ưu thời gian phản hồi trên Web UI.

**Architecture:** Giữ nguyên trạng thái `quest` trong `syncQuestStateWithFarm` (không can thiệp dữ liệu farmState); tự động gọi `refreshProgressQuests()` trong `case 69 / case 61` của `client.ts` để tương tác NPC Lái buôn (`Cmd -59 / -61`); cập nhật cơ chế làm mới trên Web UI để nhận trọn vẹn kết quả từ NPC.

**Tech Stack:** TypeScript, Node.js, Express, React, Vite.

**Spec:** `docs/superpowers/specs/2026-08-20-pure-npc-dialog-quest-parse-design.md`

## Global Constraints
- **KHÔNG TDD:** Không tạo file test mới, chỉ chạy build và test suite hiện có.
- **KHÔNG đếm FarmState:** Tuyệt đối không đếm số lượng gà, cá, cây trong nông trại để ghi đè `cond.current` / `cond.isDone`.
- **GitNexus:** Chạy `npx gitnexus analyze` sau khi hoàn thành code.

---

### Task 1: Bảo toàn dữ liệu nhiệm vụ NPC trong `progressQuests.ts`

**Files:**
- Modify: `avatar-web/server/src/game/progressQuests.ts`

**Interfaces:**
- Consumes: `ProgressQuestChain`
- Produces: `syncQuestStateWithFarm(quest) => ProgressQuestChain | null`

- [x] **Step 1: Xác nhận và hoàn thiện `syncQuestStateWithFarm` thuần bảo toàn**
  Đảm bảo `syncQuestStateWithFarm` trả về `quest ?? null` nguyên vẹn, không tự đếm hay sửa đổi các điều kiện từ nông trại:
  ```typescript
  export function syncQuestStateWithFarm(
    quest: ProgressQuestChain | null | undefined,
    _farmState?: FarmState | null | undefined,
    _inventory?: readonly InventoryItem[] | null,
    _produce?: readonly InventoryItem[] | null,
  ): ProgressQuestChain | null {
    return quest ?? null;
  }
  ```

- [x] **Step 2: Verify unit tests**
  Run: `npm test` trong `avatar-web/server`
  Expected: 254/254 tests pass.

---

### Task 2: Tự động tương tác NPC Lái buôn khi vào Farm trong `client.ts`

**Files:**
- Modify: `avatar-web/server/src/game/client.ts`

**Interfaces:**
- Consumes: `FarmService.communicate(-1)`, `FarmService.doMenuOption(-1, 0, 1)`, `FarmService.doMenuOption(-1, 0, 0)`
- Produces: Kích hoạt tự động nhận hộp thoại `Cmd -40 / -88` từ máy chủ khi vào farm.

- [x] **Step 1: Tối ưu hàm `refreshProgressQuests`**
  Đảm bảo gửi lần lượt:
  1. NPC Lái buôn -> Tân Thủ (`subIndex = 1`) -> Chờ 400ms.
  2. NPC Lái buôn -> Nhà Nông (`subIndex = 0`) -> Chờ 400ms.
  3. `getInfoUpgradeFarm(3, 1)` và `getInfoUpgradeFarm(3, 0)`.

- [x] **Step 2: Tự động gọi `refreshProgressQuests` khi nhận gói nông trại (`Cmd 69 / 61`)**
  Trong `client.ts` tại `case 69 / 61`:
  ```typescript
  void this.refreshProgressQuests();
  ```

- [x] **Step 3: Verify build server**
  Run: `npm run build` trong `avatar-web/server`
  Expected: Build thành công không có lỗi TypeScript.

---

### Task 3: Cải thiện thời gian chờ làm mới trên Web UI `QuestsPanel.tsx`

**Files:**
- Modify: `avatar-web/web/src/accounts/panels/QuestsPanel.tsx`

**Interfaces:**
- Consumes: `/api/accounts/${accountId}/quests/progress/refresh`, `GET /api/accounts/${accountId}/quests`

- [x] **Step 1: Cập nhật `handleRefreshAll` và `handleRefreshProgress`**
  Thêm polling 1.5s và 3s sau khi gửi yêu cầu làm mới để đảm bảo UI tự động cập nhật khi hộp thoại NPC về từ máy chủ.

- [x] **Step 2: Verify build web**
  Run: `npm run build` trong `avatar-web/web`
  Expected: Build thành công không có lỗi TypeScript/Vite.

---

### Task 4: Kiểm thử toàn diện & GitNexus Index

**Files:**
- Modify: N/A

- [x] **Step 1: Chạy toàn bộ test suite và build**
  Run: `npm test` và `npm run build` ở `server` và `web`
  Expected: Mọi test và build đều pass.

- [x] **Step 2: Cập nhật GitNexus Index**
  Run: `npx gitnexus analyze`
  Expected: Index cập nhật thành công.
