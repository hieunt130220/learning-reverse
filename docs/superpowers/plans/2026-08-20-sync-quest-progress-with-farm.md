# Đồng Bộ Tiến Trình Nhiệm Vụ Nông Trại Với Dữ Liệu Thực Tế Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khắc phục triệt để lỗi đã mua 2 cá chép (hoặc các vật nuôi/nông sản khác) nhưng tiến trình nhiệm vụ vẫn hiển thị 0/2 (0%) trên giao diện web.

**Architecture:** Bổ sung hàm `syncQuestStateWithFarm` trong `progressQuests.ts` để phân tích tên điều kiện nhiệm vụ và đối chiếu với số lượng vật nuôi (`farmState.animals`), ô đất (`cells`), kho nông sản (`produce`, `inventory`). Tích hợp tự động gọi đồng bộ `syncProgressQuests` trong `GameClient` (`client.ts`) và `AvatarSession` (`avatarSession.ts`).

**Tech Stack:** Node.js, TypeScript, Express, React.

**Spec:** `docs/superpowers/specs/2026-08-20-sync-quest-progress-with-farm-design.md`

## Global Constraints
- Không sửa cấu trúc wire protocol cơ bản của các packet game.
- Tiến độ điều kiện nhiệm vụ được cập nhật theo nguyên tắc không làm giảm tiến độ: `current = Math.min(total, Math.max(cond.current, derivedCurrent))`.
- Tuân thủ quy tắc GitNexus: kiểm tra blast radius trước khi chỉnh sửa.
- Không viết test trước khi viết code (No TDD).

---

### Task 1: Xây dựng hàm `syncQuestStateWithFarm` trong `progressQuests.ts`

**Files:**
- Modify: `avatar-web/server/src/game/progressQuests.ts`

**Interfaces:**
- Consumes: `ProgressQuestChain`, `FarmState`, `InventoryItem`
- Produces: `syncQuestStateWithFarm(quest: ProgressQuestChain | null, farmState: FarmState | null, inventory?: InventoryItem[] | null, produce?: InventoryItem[] | null): ProgressQuestChain | null`

- [x] **Step 1: Định nghĩa và implement `syncQuestStateWithFarm`**
- [x] **Step 2: Type check**
- [x] **Step 3: Commit**

---

### Task 2: Tích hợp `syncProgressQuests()` trong `client.ts` và `avatarSession.ts`

**Files:**
- Modify: `avatar-web/server/src/game/client.ts`
- Modify: `avatar-web/server/src/session/avatarSession.ts`

**Interfaces:**
- Consumes: `syncQuestStateWithFarm` từ `./progressQuests.js`
- Produces: `GameClient.syncProgressQuests(): boolean`, `AvatarSession.getQuestOverview(): QuestOverviewState`

- [x] **Step 1: Bổ sung phương thức `syncProgressQuests()` trong `GameClient` (`client.ts`)**
- [x] **Step 2: Gọi `syncProgressQuests()` khi nhận các gói liên quan trong `onMessage`**
- [x] **Step 3: Cập nhật `getQuestOverview()` trong `avatarSession.ts`**
- [x] **Step 4: Kiểm tra build TypeScript**
- [x] **Step 5: Commit**

---

### Task 3: Build & Xác Minh Toàn Diện

**Files:**
- Verification only

- [x] **Step 1: Chạy build toàn bộ project**
- [x] **Step 2: Chạy kiểm tra test suite hiện có**
- [x] **Step 3: Kiểm tra GitNexus scope trước khi hoàn tất**
