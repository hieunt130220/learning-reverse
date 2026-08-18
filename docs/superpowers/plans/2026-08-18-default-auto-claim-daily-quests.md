# Mặc Định Tự Động Nhận Thưởng Nhiệm Vụ Hàng Ngày Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Loại bỏ checkbox cài đặt nhiệm vụ hàng ngày trên Web UI, thiết lập hành vi mặc định luôn tự động nhận thưởng nhiệm vụ hoàn thành và mở rương quà trong chu kỳ AutoFarm.

**Architecture:** Cập nhật `DEFAULT_AUTO_FARM_CONFIG` trong `autoFarm.ts` để `autoClaimDailyQuests: true`; gỡ bỏ section JSX, state, dirty comparison và payload của `autoClaimDailyQuests` khỏi `AutoFarmPanel.tsx`; cập nhật test suite web và backend.

**Tech Stack:** TypeScript, React, Node.js, Express, Vitest

**Spec:** `docs/superpowers/specs/2026-08-18-default-auto-claim-daily-quests-design.md`

## Global Constraints
- Tuân thủ quy trình GitNexus: kiểm tra impact trước khi sửa và detect changes trước khi commit.
- KHÔNG thực hiện TDD (không tạo file test mới, chỉ sửa test expectation đã có nếu cần).
- Không phá vỡ các luồng khác của AutoFarm và cấu hình nông trại.

---

### Task 1: Cập Nhật Backend AutoFarm Engine

**Files:**
- Modify: `avatar-web/server/src/autoFarm.ts:220, 1111`

**Interfaces:**
- Consumes: `AutoFarmConfig`, `Session.send(Message)`
- Produces: `DEFAULT_AUTO_FARM_CONFIG.autoClaimDailyQuests = true`, AutoFarm luôn tự động nhận thưởng và mở rương khi `cfg.autoClaimDailyQuests !== false`

- [x] **Step 1: Cập nhật `DEFAULT_AUTO_FARM_CONFIG` và điều kiện chạy trong `autoFarm.ts`**

Trong `avatar-web/server/src/autoFarm.ts`:
1. Tại dòng 220 (`DEFAULT_AUTO_FARM_CONFIG`), sửa:
```typescript
  autoClaimDailyQuests: true,
```
2. Tại dòng 1111 (`runCycle`), sửa:
```typescript
      // ---- Tự động nhận thưởng nhiệm vụ hàng ngày & mở rương quà (Mặc định luôn bật) ------------
      if (cfg.autoClaimDailyQuests !== false && !this.aborted) {
```

- [x] **Step 2: Kiểm tra biên dịch TypeScript phía Server**

Run: `npm run build --prefix avatar-web/server`
Expected: Biên dịch thành công 0 lỗi.

- [x] **Step 3: Commit**

```bash
git add avatar-web/server/src/autoFarm.ts
git commit -m "feat(game): default autoClaimDailyQuests to true in AutoFarm"
```

---

### Task 2: Gỡ Bỏ Setting Nhiệm Vụ Hàng Ngày Trên Web UI

**Files:**
- Modify: `avatar-web/web/src/accounts/panels/AutoFarmPanel.tsx:202, 224, 282, 311, 485-498`
- Modify: `avatar-web/web/src/accounts/panels/AutoFarmPanel.test.tsx:195`

**Interfaces:**
- Consumes: `AutoConfigStateDto`, `apiPut`
- Produces: Giao diện `AutoFarmPanel` không còn checkbox thừa, dirty check và payload `apiPut` sạch sẽ

- [x] **Step 1: Gỡ bỏ `autoClaimDailyQuests` khỏi `AutoFarmPanel.tsx`**

Trong `avatar-web/web/src/accounts/panels/AutoFarmPanel.tsx`:
1. Xóa `const [autoClaimDailyQuests, setAutoClaimDailyQuests] = useState(false);` (dòng 202).
2. Xóa `setAutoClaimDailyQuests(config.autoClaimDailyQuests ?? false);` trong `hydrateForm` (dòng 224).
3. Xóa `|| autoClaimDailyQuests !== (storedState.config.autoClaimDailyQuests ?? false)` và dependency khỏi `useMemo` tính `dirty` (dòng 282-283).
4. Xóa `autoClaimDailyQuests,` trong payload `apiPut` của `savePlan()` (dòng 311).
5. Xóa khối JSX section `<h3>🎯 Nhiệm vụ hàng ngày</h3>` (dòng 485-498).

- [x] **Step 2: Cập nhật expectation trong `AutoFarmPanel.test.tsx`**

Trong `avatar-web/web/src/accounts/panels/AutoFarmPanel.test.tsx`:
Xóa dòng `autoClaimDailyQuests: false,` trong payload kỳ vọng của `expect(mocks.apiPut).toHaveBeenCalledWith(...)` (dòng 195).

- [x] **Step 3: Kiểm tra biên dịch Web và chạy Web test**

Run: `npm run build --prefix avatar-web/web && npx vitest run --prefix avatar-web/web`
Expected: Biên dịch và toàn bộ test web thành công 100%.

- [x] **Step 4: Commit**

```bash
git add avatar-web/web/src/accounts/panels/AutoFarmPanel.tsx avatar-web/web/src/accounts/panels/AutoFarmPanel.test.tsx
git commit -m "refactor(web): remove daily quests auto-claim checkbox from AutoFarmPanel"
```

---

### Task 3: Kiểm Tra Xác Minh Toàn Bộ Hệ Thống (Verification)

**Files:**
- N/A

- [x] **Step 1: Chạy toàn bộ server unit tests**

Run: `npm test --prefix avatar-web/server`
Expected: 254/254 tests PASS.

- [x] **Step 2: Chạy toàn bộ web unit tests**

Run: `npm test --prefix avatar-web/web`
Expected: Toàn bộ tests PASS.

- [x] **Step 3: Cập nhật GitNexus Index**

Run: `npx gitnexus analyze`
Expected: Index cập nhật thành công.
