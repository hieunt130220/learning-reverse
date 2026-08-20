# Hiển Thị Nhiệm Vụ Hiện Tại Từ Dialog NPC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hiển thị đúng nhiệm vụ hiện tại từ dialog game, cụ thể `Nhiệm Vụ Tân Thủ 1 - Trồng 6 cây hoa hồng - 0/6`, không đếm lại từ dữ liệu nông trại.

**Architecture:** Dialog NPC là nguồn dữ liệu authoritative cho progress quest. Server parse và lưu chain đúng loại, session chuyển snapshot qua event/API, còn web render trực tiếp title, step và conditions từ snapshot mới nhất.

**Tech Stack:** TypeScript, Node.js server, React, Vite, REST/event account snapshot.

**Spec:** `docs/superpowers/specs/2026-08-20-display-current-quest-from-npc-dialog-design.md`

## Global Constraints

- Không sử dụng `farmState`, inventory hoặc produce để ghi đè `current`, `total`, `isDone`.
- Fallback runtime duy nhất là nhiệm vụ Tân Thủ 1 do người dùng xác nhận; dialog game mới nhất luôn ghi đè fallback.
- Chỉ cập nhật chain khi dialog/parser xác định đúng loại `beginner` hoặc `farmer`.
- Không thay đổi protocol ngoài luồng lấy và parse dialog nhiệm vụ.
- Tuân thủ chính sách no-TDD: không tạo test file trừ khi người dùng yêu cầu; kiểm tra sau khi hoàn tất production code.
- Trước khi sửa symbol phải chạy GitNexus impact analysis; phiên hiện tại không expose GitNexus MCP nên phải ghi nhận giới hạn này và dùng CLI/index hiện có nếu khả dụng.
- Trước commit phải chạy GitNexus detect changes; không commit nếu người dùng không yêu cầu.

## Tasks

### Task 1: Xác nhận và khóa contract parser nhiệm vụ hiện tại

**Files:**
- Inspect: `avatar-web/server/src/game/progressQuests.ts`
- Modify: `avatar-web/server/src/game/progressQuests.ts` nếu parser chưa giữ đúng title/step/progress

**Interfaces:**
- Consumes: Dialog NPC chứa `Nhiệm Vụ Tân Thủ 1` và `Trồng 6 cây hoa hồng - 0/6`.
- Produces: `ProgressQuestChain` với `kind: 'beginner'`, `title`, `step: 1`, condition `current: 0`, `total: 6`, `isDone: false`, `source: 'game-dialog'`.

- [x] **Step 1: Impact analysis**
  - Chạy GitNexus impact cho `parseQuestDialogText` và các symbol parser phụ thuộc trước khi sửa.
  - Ghi nhận callers trực tiếp và cảnh báo risk; nếu HIGH/CRITICAL thì dừng để đánh giá.

- [x] **Step 2: Kiểm tra/sửa parser**
  - Bảo đảm prefix dialog được loại khỏi title.
  - Bảo đảm title `Nhiệm Vụ Tân Thủ 1` suy ra `kind = beginner`, `step = 1`.
  - Bảo đảm dòng `- Trồng 6 cây hoa hồng - 0/6` giữ đúng tên, số hiện tại và tổng số.

- [x] **Step 3: Verify**
  - Chạy typecheck/build server.
  - Kiểm tra log/đầu ra parser bằng fixture hoặc đường chạy hiện có, không tạo test file mới.

### Task 2: Bảo toàn dữ liệu authoritative từ dialog trong GameClient

**Files:**
- Inspect: `avatar-web/server/src/game/client.ts`
- Modify: `avatar-web/server/src/game/client.ts` nếu còn luồng sync farm ghi đè quest hoặc gán dialog sai chain

**Interfaces:**
- Consumes: Kết quả `parseQuestDialogText`, event nhận dialog, `refreshProgressQuests()`.
- Produces: `beginnerQuestState` mới nhất và event `quests` cho account snapshot.

- [x] **Step 1: Impact analysis**
  - Chạy GitNexus impact cho `refreshProgressQuests`, `syncProgressQuests` và các handler cập nhật quest trước khi sửa.

- [x] **Step 2: Sửa luồng cập nhật**
  - Chỉ gán kết quả parse beginner vào `beginnerQuestState`.
  - Không gọi logic đếm farm để thay đổi progress đã parse.
  - Bảo đảm refresh dialog phát event sau khi nhận dữ liệu hợp lệ.

- [x] **Step 3: Verify**
  - Build server thành công.
  - Kiểm tra trạng thái account sau refresh chứa `Nhiệm Vụ Tân Thủ 1` và condition `0/6`.

### Task 3: Render đúng nhiệm vụ hiện tại trên web

**Files:**
- Inspect: `avatar-web/web/src/accounts/panels/QuestsPanel.tsx`
- Inspect: `avatar-web/web/src/accounts/accountRuntime.ts`
- Modify: `avatar-web/web/src/accounts/panels/QuestsPanel.tsx` nếu UI còn hiển thị fallback/default hoặc dữ liệu cũ

**Interfaces:**
- Consumes: `QuestOverviewState` từ account snapshot/event.
- Produces: Tab Tân Thủ hiển thị title, step, số điều kiện và progress theo snapshot server.

- [x] **Step 1: Impact analysis**
  - Chạy GitNexus impact cho `ProgressQuestSection` và handler refresh quest trước khi sửa.

- [x] **Step 2: Sửa render/refresh nếu cần**
  - Render `Nhiệm Vụ Tân Thủ 1`, `Bước 1`, `0/1 điều kiện` và `Trồng 6 cây hoa hồng: 0 / 6 (0%)` khi snapshot tương ứng.
  - Giữ trạng thái empty/loading khi chưa có dialog mới, không tự tạo nhiệm vụ Tân Thủ 1 từ dữ liệu farm.

- [x] **Step 3: Verify**
  - Chạy web build.
  - Mở `/accounts/1`, refresh nhiệm vụ và đối chiếu trực quan với nhiệm vụ hiện tại trong game.

### Task 4: Scope verification và handoff

**Files:**
- Verify: repository diff và GitNexus index

**Interfaces:**
- Consumes: Các thay đổi từ Tasks 1-3.
- Produces: Diff chỉ nằm trong parser/client/UI liên quan.

- [x] **Step 1: Run verification**
  - Chạy build server và web.
  - Kiểm tra thủ công các giá trị `Nhiệm Vụ Tân Thủ 1`, `Trồng 6 cây hoa hồng`, `0/6`, `0/1 điều kiện`.

- [x] **Step 2: Detect changes**
  - Chạy `gitnexus_detect_changes` với scope phù hợp trước commit/handoff.
  - Xác nhận không có thay đổi ngoài phạm vi quest parser, client/session snapshot và UI.

- [x] **Step 3: Commit**
  - Không tự commit; chỉ commit khi người dùng yêu cầu rõ ràng.
