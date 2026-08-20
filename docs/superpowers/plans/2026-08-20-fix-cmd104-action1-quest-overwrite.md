# Loại Bỏ Ghi Đè Tiến Trình Từ Cmd 104 Action 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Loại bỏ việc Cmd 104 action 1 (Nâng cấp nông trại) ghi đè 5 con gà có sẵn vào nhiệm vụ Tân Thủ 2, đảm bảo tiến trình Tân Thủ 2 giữ nguyên đúng dữ liệu game (0/5 gà, 2/2 cá chép).

**Architecture:** Bỏ nhánh gán cứng giả định trong `action === 1` của `decodeProgressQuestPacket` trong `progressQuests.ts`; đồng thời dọn dẹp các lệnh gửi gói nâng cấp không liên quan trong `refreshProgressQuests` của `client.ts`.

**Tech Stack:** Node.js, TypeScript.

**Spec:** `docs/superpowers/specs/2026-08-20-fix-cmd104-action1-quest-overwrite-design.md`

## Global Constraints
- Chỉ chấp nhận giải mã `MissionInfo` động từ `action === 2`, `action === 3` và hộp thoại NPC `Cmd -40 / -88`.
- Tuân thủ quy tắc GitNexus trước và sau khi commit.
- Không viết test trước khi viết code (No TDD).

---

### Task 1: Cập nhật `progressQuests.ts` và `client.ts`

**Files:**
- Modify: `avatar-web/server/src/game/progressQuests.ts`
- Modify: `avatar-web/server/src/game/client.ts`

**Interfaces:**
- Consumes: Buffer gói Cmd 104
- Produces: `decodeProgressQuestPacket(data: Buffer)` bỏ qua `action === 1` (nâng cấp nông trại).

- [x] **Step 1: Cập nhật nhánh `action === 1` trong `decodeProgressQuestPacket` (`progressQuests.ts`)**
- [x] **Step 2: Dọn dẹp `refreshProgressQuests` trong `client.ts`**
- [x] **Step 3: Build & Typecheck**
- [x] **Step 4: Commit**

---

### Task 2: Build & Xác Minh Toàn Diện

**Files:**
- Verification only

- [x] **Step 1: Chạy build toàn bộ server & web**
- [x] **Step 2: Chạy kiểm tra test suite**
