# Sửa Lỗi Phân Giải Điều Kiện Nhiệm Vụ Hoàn Thành (-Xong) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khắc phục lỗi phân giải hộp thoại nhiệm vụ game khi điều kiện có hậu tố `-Xong` (ví dụ: `- Mua 2 con cá chép  -Xong`), đảm bảo tên điều kiện hiển thị sạch và tiến trình hiển thị hoàn thành `2 / 2 (100%)`.

**Architecture:** Nâng cấp `parseQuestDialogText` trong `progressQuests.ts` để bổ sung nhánh nhận diện trạng thái `-Xong` / `- Xong` / `- Hoàn thành`, trích xuất tên gốc, số lượng `total` và đặt `current = total`, `isDone = true`.

**Tech Stack:** Node.js, TypeScript.

**Spec:** `docs/superpowers/specs/2026-08-20-fix-npc-quest-dialog-xong-parsing-design.md`

## Global Constraints
- Không làm ảnh hưởng đến các điều kiện dạng phân số số học (`- 0/5`, `- 200/200`).
- Tuân thủ quy tắc GitNexus trước và sau khi commit.
- Không viết test trước khi viết code (No TDD).

---

### Task 1: Nâng cấp `parseQuestDialogText` trong `progressQuests.ts`

**Files:**
- Modify: `avatar-web/server/src/game/progressQuests.ts`

**Interfaces:**
- Consumes: text string từ NPC Dialog (Cmd -40 / -88 / -70 / -77)
- Produces: `parseQuestDialogText(text: string): ProgressQuestChain | null` với điều kiện `-Xong` được bóc tách đúng `isDone = true`, `current = total`.

- [x] **Step 1: Cập nhật vòng lặp duyệt điều kiện trong `parseQuestDialogText`**
- [x] **Step 2: Build & Typecheck**
- [x] **Step 3: Commit**

---

### Task 2: Build & Xác Minh Toàn Diện

**Files:**
- Verification only

- [x] **Step 1: Chạy build toàn bộ server & web**
- [x] **Step 2: Chạy kiểm tra test suite**
