# Animal Slot Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển danh sách vật nuôi thành lưới mỗi IDDB một ô giống lưới cây.

**Architecture:** Giữ nguyên `FarmState` và decoder, chỉ thay cách render trong `AnimalSection`. Component giữ state ô đang chọn, suy ra class trạng thái từ các field animal hiện có và dùng pattern `.grid/.cell/.cell-detail` của phần cây.

**Tech Stack:** React, TypeScript, CSS hiện có, Vite, GitNexus.

**Spec:** `docs/superpowers/specs/2026-08-19-animal-slot-grid-design.md`

## Global Constraints

- Không đổi API hoặc decoder.
- Không dồn IDDB; dùng đúng `FarmAnimal.index`.
- Không tạo slot trống giả.
- Không viết test mới khi người dùng chưa yêu cầu.
- Giữ nguyên mọi thay đổi không liên quan trong worktree.

### Task 1: Chuyển AnimalSection sang lưới

**Files:**
- Modify: `avatar-web/web/src/accounts/panels/AssetsPanel.tsx`

**Interfaces:**
- Consumes: `FarmState.animals`, `AnimalInfo[]`.
- Produces: lưới button theo IDDB và bảng chi tiết ô chọn.

- [x] **Step 1:** Chạy GitNexus impact cho `AnimalSection` và `AssetsPanel`.
- [x] **Step 2:** Thêm state vật nuôi đang chọn và helper mô tả trạng thái.
- [x] **Step 3:** Render mỗi animal bằng `.cell`, gồm IDDB và tên loài; gắn `care`, `ready`, `sel` theo dữ liệu.
- [x] **Step 4:** Render chi tiết máu, tiến độ thu hoạch, sản phẩm, đói/cúm/tiêu chảy bên dưới.
- [x] **Step 5:** Chạy web build.

### Task 2: Kiểm chứng giao diện và phạm vi

**Files:**
- No production file changes expected.

- [ ] **Step 1:** Mở `/accounts/2`, xác nhận mỗi con một ô và bấm chọn hiển thị chi tiết (chưa xác minh runtime: tab browser không còn khả dụng và account đang ngắt kết nối).
- [x] **Step 2:** Chạy `git diff --check`.
- [x] **Step 3:** Chạy `gitnexus_detect_changes`; thay đổi mới được nhận diện tại `AnimalSection`.
