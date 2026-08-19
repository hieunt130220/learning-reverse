# Sửa Lỗi Hiển Thị Nhiệm Vụ Tân Thủ Từ NPC Lái Buôn Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hiển thị chính xác Nhiệm Vụ Tân Thủ 2 (Mua 5 con gà 0/5, Mua 2 con cá chép 0/2; Phần thưởng 5000 xu, 2 vật phẩm Tiến Sĩ vĩnh viễn) từ NPC Lái buôn mà không làm ảnh hưởng đến Nhiệm Vụ Nhà Nông.

**Architecture:** Nâng cấp `parseQuestDialogText` trong `progressQuests.ts` để phân giải đầy đủ phần thưởng đa mục trên cùng 1 dòng; sửa `refreshProgressQuests` trong `client.ts` để gửi đúng tùy chọn `doMenuOption(-1, 0, 1)` (Nhiệm vụ Tân Thủ) và `doMenuOption(-1, 0, 0)` (Nhiệm vụ Nhà Nông) của NPC Lái buôn.

**Tech Stack:** TypeScript, Node.js, Express, React, Vite

**Spec:** `docs/superpowers/specs/2026-08-19-fix-npc-beginner-quests-dialog-design.md`

## Global Constraints
- Giữ nguyên 100% logic `action = 1` của `decodeProgressQuestPacket` cho **Nhiệm Vụ Nhà Nông - 1** (Thu hoạch 200 cà chua, Thu hoạch 200 cà rốt, Mua 2 con gà).
- Không tạo test files (no TDD workflow).

---

### Task 1: Cải Tiến Parser Dialog Nhiệm Vụ Trong `progressQuests.ts`

**Files:**
- Modify: `avatar-web/server/src/game/progressQuests.ts:140-166`

**Interfaces:**
- Consumes: `text: string` từ `Cmd -40` / `Cmd -88`
- Produces: `parseQuestDialogText(text: string): ProgressQuestChain | null`

- [x] **Step 1: Nâng cấp tách phần thưởng trong `parseQuestDialogText`**
  Hỗ trợ tách các phần thưởng phân tách bởi dấu gạch ngang ` - ` trên cùng một dòng, định dạng đúng Xu, Lượng, EXP và tên trang phục / vật phẩm vĩnh viễn.

- [x] **Step 2: Kiểm tra parse dialog mẫu từ ảnh**
  Chạy script kiểm tra với chuỗi:
  ```text
  Nhiệm vụ hiện tại của bạn là nhiệm vụ:Nhiệm Vụ Tân Thủ 2:
  - Mua 5 con gà  - 0/5
  - Mua 2 con cá chép  - 0/2

  Phần Thưởng:
  - 5000 xu - 1 Tiến Sĩ vĩnh viễn - 1 Tiến Sĩ vĩnh viễn
  ```
  Xác nhận trả về đúng 2 điều kiện và 3 phần thưởng riêng biệt.

---

### Task 2: Cập Nhật Lệnh Tương Tác Menu NPC Lái Buôn Trong `client.ts`

**Files:**
- Modify: `avatar-web/server/src/game/client.ts:477-505`

**Interfaces:**
- Consumes: `FarmService.communicate`, `FarmService.doMenuOption`, `FarmService.getInfoUpgradeFarm`
- Produces: `GameClient.refreshProgressQuests(force?: boolean)`

- [x] **Step 1: Cập nhật hàm `refreshProgressQuests()`**
  Gửi theo trình tự:
  1. `this.farm.communicate(-1)` (Tương tác NPC Lái buôn)
  2. `this.farm.doMenuOption(-1, 0, 0)` (Tùy chọn 0 của NPC Lái buôn: Nhiệm Vụ Nhà Nông)
  3. `this.farm.doMenuOption(-1, 0, 1)` (Tùy chọn 1 của NPC Lái buôn: Nhiệm Vụ Tân Thủ)
  4. `this.farm.getInfoUpgradeFarm(1)` & `this.farm.getInfoUpgradeFarm(5)`

- [x] **Step 2: Build và kiểm tra type check**
  Chạy `npm --prefix avatar-web/server run build` và `npm --prefix avatar-web/web run build`.
