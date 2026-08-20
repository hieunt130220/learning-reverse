# Sửa Lỗi Hiển Thị Tiến Trình Nhiệm Vụ Khớp 1:1 Với Hộp Thoại Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khắc phục lỗi hiển thị sai 5/5 gà khi game báo 0/5, đảm bảo tiến trình nhiệm vụ trên web hiển thị chính xác 1:1 theo dữ liệu máy chủ game (`0/5 gà`, `2/2 cá chép`).

**Architecture:** Điều chỉnh `syncQuestStateWithFarm` trong `progressQuests.ts` để tin tưởng và tôn trọng 100% dữ liệu tiến trình trả về từ máy chủ game (`parseQuestDialogText` và `decodeProgressQuestPacket`), không để số lượng vật nuôi có sẵn trong chuồng ghi đè lên bộ đếm hành động mua vật nuôi của nhiệm vụ.

**Tech Stack:** Node.js, TypeScript.

**Spec:** `docs/superpowers/specs/2026-08-20-fix-quest-progress-matching-game-dialog-design.md`

## Global Constraints
- Dữ liệu từ hộp thoại NPC Lái buôn (`Cmd -40 / -88`) và `Cmd 104` là nguồn chân lý chính xác nhất.
- Không ghi đè tiến trình nhiệm vụ bằng số lượng vật nuôi có sẵn.
- Tuân thủ quy tắc GitNexus trước và sau khi commit.
- Không viết test trước khi viết code (No TDD).

---

### Task 1: Điều chỉnh `syncQuestStateWithFarm` trong `progressQuests.ts`

**Files:**
- Modify: `avatar-web/server/src/game/progressQuests.ts`

**Interfaces:**
- Consumes: `ProgressQuestChain`, `FarmState`
- Produces: `syncQuestStateWithFarm(quest: ProgressQuestChain | null, farmState: FarmState | null, ...)` bảo toàn dữ liệu tiến trình chính xác của server.

- [x] **Step 1: Cập nhật hàm `syncQuestStateWithFarm` trong `progressQuests.ts`**
- [x] **Step 2: Build & Typecheck**
- [x] **Step 3: Commit**

---

### Task 2: Build & Xác Minh Toàn Diện

**Files:**
- Verification only

- [x] **Step 1: Chạy build toàn bộ server & web**
- [x] **Step 2: Chạy kiểm tra test suite**
