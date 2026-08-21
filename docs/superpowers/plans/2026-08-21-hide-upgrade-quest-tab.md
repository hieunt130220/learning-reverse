# Tạm ẩn tab Nâng Cấp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tạm ẩn tab `🚜 Nâng Cấp` khỏi `QuestsPanel` mà không xóa dữ liệu server.

**Architecture:** Một UI flag tại `QuestsPanel` điều khiển việc render tab và nội dung; server/API giữ nguyên.

**Tech Stack:** React, TypeScript, Vite.

**Spec:** `docs/superpowers/specs/2026-08-21-hide-upgrade-quest-tab-design.md`

## Global Constraints

- Chỉ thay đổi UI web.
- Không xóa decoder, API contract hoặc state server.
- Không tạo test file mới.

### Task 1: Hide upgrade tab

**Files:**
- Modify: `avatar-web/web/src/accounts/panels/QuestsPanel.tsx`

- [x] **Step 1: Impact analysis**
  Kiểm tra callers và flow của `QuestsPanel` trước khi sửa.

- [x] **Step 2: Implement**
  Thêm flag `SHOW_UPGRADE_TAB = false`, chỉ render button/content upgrade khi bật; nếu active tab
  đang là `upgrade` thì chuyển về `daily`.

- [x] **Step 3: Verify**
  Chạy `./node_modules/.bin/tsc -b` trong `avatar-web/web` và `git diff --check`.

- [x] **Step 4: Detect changes**
  Chạy GitNexus detect changes trước commit nếu commit được yêu cầu.
