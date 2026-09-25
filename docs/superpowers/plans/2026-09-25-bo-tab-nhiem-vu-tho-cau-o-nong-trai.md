# Kế Hoạch Thực Hiện: Bỏ Tab Nhiệm Vụ Thợ Câu Tại Tab Nông Trại

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bỏ sub-tab "🎣 Thợ Câu" khỏi bảng Nhiệm vụ Nông trại trong tab Nông trại (`QuestsPanel.tsx`).

**Architecture:** Cập nhật `QuestsPanel.tsx` loại bỏ kiểu `'fisherman'` trong `QuestTab`, bỏ nút bấm tab `🎣 Thợ Câu` và khối render `{activeTab === 'fisherman' && ...}`. Giữ nguyên hiển thị nhiệm vụ thợ câu tại `FishingPanel.tsx`.

**Tech Stack:** React, TypeScript, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-25-bo-tab-nhiem-vu-tho-cau-o-nong-trai-design.md`

## Global Constraints
- Không dùng TDD (không test-first, viết code trước, cập nhật test sau).
- Giữ nguyên khối Nhiệm vụ Thợ Câu trong `FishingPanel.tsx` và mode `auto_fisherman_quest` trong `StatusPanel.tsx`.
- Chạy `gitnexus_impact` trước khi sửa code và `gitnexus_detect_changes` trước khi commit.

---

### Task 1: Cập Nhật `QuestsPanel.tsx` Bỏ Sub-Tab Thợ Câu

**Files:**
- Modify: `avatar-web/web/src/accounts/panels/QuestsPanel.tsx`

**Interfaces:**
- Consumes: None
- Produces: `QuestsPanel` chỉ còn 3 tab: `daily`, `beginner`, `farmer`.

- [x] **Step 1: Sửa `QuestsPanel.tsx`**
  - Đổi kiểu `QuestTab`:
    ```typescript
    type QuestTab = 'daily' | 'beginner' | 'farmer' | 'upgrade';
    ```
  - Xóa:
    ```typescript
    const fisherman = effectiveQuests?.fisherman ?? null;
    const completedFishermanCount = fisherman?.conditions?.filter((c) => c.isDone).length ?? 0;
    const totalFishermanCount = fisherman?.conditions?.length ?? 0;
    ```
  - Xóa nút tab:
    ```tsx
    <button
      type="button"
      className={`quests-tab-btn ${activeTab === 'fisherman' ? 'active' : ''}`}
      onClick={() => setActiveTab('fisherman')}
    >
      🎣 Thợ Câu
      ...
    </button>
    ```
  - Xóa khối render `{activeTab === 'fisherman' && ...}`.

- [x] **Step 2: Commit**
`git commit -m "refactor(web): remove fisherman quest tab from QuestsPanel"`

---

### Task 2: Chạy Toàn Bộ Test Suite Và Verify End-to-End

**Files:**
- Modify: None (kiểm tra test suite)

- [x] **Step 1: Chạy test toàn bộ web**
Run: `cd avatar-web/web && npm test -- --run`
Expected: 11/11 test files pass 100%.

- [x] **Step 2: Verify `detect_changes`**
Run: `mcp__gitnexus__detect_changes` để phân tích đồ thị trước khi hoàn tất.

- [x] **Step 3: Commit**
`git commit -m "test(web): verify all tests pass after removing fisherman quest tab"`
