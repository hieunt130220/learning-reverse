# Sửa Lỗi Dừng Auto Nhiệm Vụ Thợ Câu Do Hardcode Chế Độ `auto_fishing` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép luồng câu cá `runFishingLoop` và toàn bộ các hàm phụ trợ (vào map, mua vé bến tàu, quăng cần, giải đố ML, bán cá) chạy thông suốt khi bật chế độ `auto_fisherman_quest`.

**Architecture:** Bổ sung helper `isFishingAutomationActive()` trong `avatarSession.ts` để gộp cả `auto_fishing` và `auto_fisherman_quest`. Cô lập chu kỳ nông trại (`runFishingFarmCycle`, `scheduleFishingFarm`) chỉ cho `auto_fishing`, đồng thời mở tất cả các chốt kiểm tra trong pipeline câu cá cho cả hai chế độ.

**Tech Stack:** TypeScript (Node.js/ESM), GameClient packet protocol, WebSocket RPC.

**Spec:** `docs/superpowers/specs/2026-09-15-fix-auto-fisherman-quest-fishing-loop-design.md`

## Global Constraints
- Tuân thủ quy định GitNexus: phân tích impact trước khi sửa và `detect_changes` trước khi commit.
- Không viết test files mới (tuân thủ quy định KHÔNG thực hiện TDD của CLAUDE.md).
- Giữ nguyên luồng nông trại `auto_farm` và các tính năng câu cá thông thường của `auto_fishing`.

---

### Task 1: Thêm `isFishingAutomationActive` và Mở Khóa Pipeline Câu Cá trong `avatarSession.ts`

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts:754-762`
- Modify: `avatar-web/server/src/session/avatarSession.ts:2596-2602`
- Modify: `avatar-web/server/src/session/avatarSession.ts:2948-2975`
- Modify: `avatar-web/server/src/session/avatarSession.ts:3040-3046`
- Modify: `avatar-web/server/src/session/avatarSession.ts:3080-3180`
- Modify: `avatar-web/server/src/session/avatarSession.ts:3188-3276`
- Modify: `avatar-web/server/src/session/avatarSession.ts:3445-3825`
- Modify: `avatar-web/server/src/session/avatarSession.ts:3895-4005`

**Interfaces:**
- Consumes: `this.desiredMode` (`AutomationMode`)
- Produces: `isFishingAutomationActive(): boolean`

- [x] **Step 1: Thêm helper `isFishingAutomationActive()` tại dòng ~754**
```typescript
  /** Kiểm tra người dùng có đang yêu cầu một trong các chế độ tự động câu cá hay không (auto_fishing hoặc auto_fisherman_quest). */
  private isFishingAutomationActive(): boolean {
    return this.desiredMode === 'auto_fishing' || this.desiredMode === 'auto_fisherman_quest';
  }
```

- [x] **Step 2: Cập nhật `runFishingLoop` để cô lập farm cycle và mở khóa vòng lặp câu cá**
1. Bọc gọi `runFishingFarmCycle('initial', ...)` trong `if (this.desiredMode === 'auto_fishing')`.
2. Bọc `this.scheduleFishingFarm(generation, epoch)` trong `if (this.desiredMode === 'auto_fishing')`.
3. Đổi điều kiện `while` thành `this.isFishingAutomationActive()`.
4. Đổi tất cả các kiểm tra `this.desiredMode !== 'auto_fishing'` trong `runFishingLoop` thành `!this.isFishingAutomationActive()`.

- [x] **Step 3: Mở khóa các hàm phụ trợ câu cá**
1. Trong `executeParkPurchase`: đổi `this.desiredMode !== 'auto_fishing'` thành `!this.isFishingAutomationActive()`.
2. Trong `executeSellFish`: đổi `this.desiredMode !== 'auto_fishing'` thành `!this.isFishingAutomationActive()`.
3. Trong `enterFishingPark`: đổi tất cả `this.desiredMode !== 'auto_fishing'` thành `!this.isFishingAutomationActive()`.
4. Trong `startFishingSession`: đổi tất cả `this.desiredMode !== 'auto_fishing'` thành `!this.isFishingAutomationActive()`.
5. Trong `handleFishingChallenge`: đổi 3 chốt `this.desiredMode !== 'auto_fishing'` thành `!this.isFishingAutomationActive()`.

- [x] **Step 4: Kiểm tra Static Analysis và Chạy Test Suite Hiện Có**
Run: `npm --prefix avatar-web/server run typecheck`
Expected: `0 errors`
Run: `npm --prefix avatar-web/server test`
Expected: `pass 274, fail 0`

- [x] **Step 5: Kiểm tra thay đổi GitNexus & Commit**
Run: `detect_changes({scope: "all"})`
Expected: Chỉ ảnh hưởng các hàm câu cá trong `avatarSession.ts`
`git commit -m "fix(quest): allow fishing loop and actions to execute in auto_fisherman_quest mode"`
