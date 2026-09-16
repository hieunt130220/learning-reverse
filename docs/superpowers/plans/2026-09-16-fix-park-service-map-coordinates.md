# Fix ParkService Map Coordinates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sửa toạ độ native của roomID 9 (Khu giải trí: 236, 280) và bổ sung roomID 28 (Mê cung: 57, 209) trong `NATIVE_PARK_JOIN_POSITIONS`.

**Architecture:** Cập nhật bảng ánh xạ toạ độ `NATIVE_PARK_JOIN_POSITIONS` trong `avatar-web/server/src/game/parkService.ts` để phân biệt rõ CityMap node ID và server roomID. Bổ sung comment tài liệu chuẩn hoá từ TextAsset `CityMap`.

**Tech Stack:** TypeScript, Node.js

**Spec:** `docs/superpowers/specs/2026-09-16-fix-park-service-map-coordinates-design.md`

## Global Constraints
- Không thay đổi signature hoặc logic nghiệp vụ runtime của class `ParkService`.
- Không tạo test files mới (tuân thủ nguyên tắc KHÔNG TDD trong `CLAUDE.md`).
- Tuân thủ quy tắc GitNexus (`gitnexus_impact` trước khi sửa, `gitnexus_detect_changes()` trước khi hoàn thành).

---

### Task 1: Cập nhật toạ độ Khu giải trí và Mê cung trong `parkService.ts`

**Files:**
- Modify: `avatar-web/server/src/game/parkService.ts:52-89`

**Interfaces:**
- Consumes: Toạ độ giải mã từ TextAsset `CityMap` (`PositionMap`, SHA-256 `e3fc3c12...`).
- Produces: `NATIVE_PARK_JOIN_POSITIONS` với `9: (236, 280)` và `28: (57, 209)`.

- [x] **Step 1: Cập nhật comment header và hằng số `NATIVE_PARK_JOIN_POSITIONS`**
  Trong `avatar-web/server/src/game/parkService.ts`:
  - Cập nhật header comment ghi rõ:
    - Node 3: Khu giải trí (`x=236, y=280`) -> `roomID = 9`
    - Node 9: Mê cung (`x=57, y=209`) -> `roomID = 28`
  - Sửa dòng `9: Object.freeze({ x: 57, y: 209 }),` thành `9: Object.freeze({ x: 236, y: 280 }),` (Khu giải trí).
  - Thêm dòng `28: Object.freeze({ x: 57, y: 209 }),` (Mê cung).

- [x] **Step 2: Kiểm tra Typecheck và Test Suite**
  Run: `npm --prefix avatar-web/server run typecheck && npm --prefix avatar-web/server run test`
  Expected: Typecheck pass không có lỗi, toàn bộ test suite pass.

- [x] **Step 3: Kiểm tra GitNexus Scope & Diff**
  Run: `git diff avatar-web/server/src/game/parkService.ts`
  Expected: Chỉ thay đổi toạ độ và comment trong `parkService.ts`.
