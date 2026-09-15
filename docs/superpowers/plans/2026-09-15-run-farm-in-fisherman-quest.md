# Kích Hoạt Chu Kỳ Nông Trại Trong Chế Độ `auto_fisherman_quest` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép `auto_fisherman_quest` tự động chạy chu kỳ làm nông trại ban đầu và định kỳ mỗi 30 phút giống hệt `auto_fishing`.

**Architecture:** Sử dụng helper `isFishingAutomationActive()` trong các phương thức kiểm tra chu kỳ farm của phiên câu cá (`scheduleFishingFarm`, `isCurrentFishingFarmCycle`, `runFishingFarmCycle`, `serviceDueFishingFarm`, `runFishingLoop`), đảm bảo tính an toàn với cơ chế bỏ qua nhẹ nhàng (`skipped`) nếu chưa có cấu hình nông trại.

**Tech Stack:** TypeScript (Node.js/ESM), GameClient packet protocol, WebSocket RPC.

**Spec:** `docs/superpowers/specs/2026-09-15-run-farm-in-fisherman-quest-design.md`

## Global Constraints
- Tuân thủ quy định GitNexus: phân tích impact trước khi sửa và `detect_changes` trước khi commit.
- Không viết test files mới (tuân thủ quy định KHÔNG thực hiện TDD của CLAUDE.md).
- Không ảnh hưởng đến luồng `auto_farm` độc lập hoặc `auto_fishing` hiện tại.

---

### Task 1: Kích Hoạt Farm Cycle Cho `auto_fisherman_quest` trong `avatarSession.ts`

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts:2020-2035`
- Modify: `avatar-web/server/src/session/avatarSession.ts:2100-2115`
- Modify: `avatar-web/server/src/session/avatarSession.ts:2140-2150`
- Modify: `avatar-web/server/src/session/avatarSession.ts:3415-3440`
- Modify: `avatar-web/server/src/session/avatarSession.ts:3450-3480`

**Interfaces:**
- Consumes: `isFishingAutomationActive(): boolean`
- Produces: Chu kỳ nông trại chạy ban đầu và định kỳ cho mọi chế độ câu cá đang hoạt động.

- [x] **Step 1: Cập nhật `scheduleFishingFarm`, `isCurrentFishingFarmCycle`, `runFishingFarmCycle`**
1. Trong `scheduleFishingFarm` (dòng ~2029): thay `this.desiredMode !== 'auto_fishing'` thành `!this.isFishingAutomationActive()`.
2. Trong `isCurrentFishingFarmCycle` (dòng ~2107): thay `this.desiredMode === 'auto_fishing'` thành `this.isFishingAutomationActive()`.
3. Trong `runFishingFarmCycle` (dòng ~2143): thay `this.desiredMode !== 'auto_fishing'` thành `!this.isFishingAutomationActive()`.

- [x] **Step 2: Cập nhật `serviceDueFishingFarm` và `runFishingLoop`**
1. Trong `serviceDueFishingFarm` (dòng ~3418 & ~3432): thay `this.desiredMode !== 'auto_fishing'` thành `!this.isFishingAutomationActive()`.
2. Trong `runFishingLoop` (dòng ~3453): thay `if (this.desiredMode === 'auto_fishing')` thành `if (this.isFishingAutomationActive())` để chạy farm ban đầu.
3. Trong `runFishingLoop` (dòng ~3473): thay `if (this.desiredMode === 'auto_fishing')` thành `if (this.isFishingAutomationActive())` để lên lịch farm định kỳ.

- [x] **Step 3: Chạy Static Analysis và Test Suite**
Run: `npm --prefix avatar-web/server run typecheck`
Expected: `0 errors`
Run: `npm --prefix avatar-web/server test`
Expected: `pass 274, fail 0`

- [x] **Step 4: Kiểm tra thay đổi GitNexus & Commit**
Run: `detect_changes({scope: "all"})`
Expected: Chỉ ảnh hưởng các hàm farm cycle trong `avatarSession.ts`
`git commit -m "feat(quest): enable initial and periodic farm cycles in auto_fisherman_quest mode"`
