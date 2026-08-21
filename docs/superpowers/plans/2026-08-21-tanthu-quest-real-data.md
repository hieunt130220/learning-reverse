# Nhiệm Vụ Tân Thủ — Dữ Liệu Thật Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Làm tab Nhiệm Vụ Tân Thủ hiển thị dữ liệu quest thật từ server (nguồn hộp thoại NPC Lái buôn, `doMenuOption(19,0,0)` → cmd -62), thay cho `DEFAULT_BEGINNER_QUEST_STATE`.

**Architecture:** `refreshProgressQuests()` thêm 1 lượt tương tác NPC (`communicate(90)` → `doMenuOption(19, 0, 0)`) để hỏi chuỗi quest Tân Thủ (userID 19). Handler cmd -62 hiện có tự định tuyến theo `kind` (title chứa "Tân Thủ" → beginner) vào `beginnerQuestState`, rồi chảy qua `getQuestOverview()` → `/api/:id/state#quests.beginner` → tab Tân Thủ trong `QuestsPanel.tsx`.

**Tech Stack:** TypeScript (tsx/Node), avatar-web server (GameClient + farm handler), giao thức Avatar private server.

**Spec:** `docs/superpowers/specs/2026-08-21-tanthu-quest-real-data-design.md`

## Global Constraints

- Tuân thủ CLAUDE.md: impact() trước khi sửa, detect_changes() trước khi commit, cảnh báo risk HIGH/CRITICAL.
- KHÔNG TDD — không viết test trước, chỉ verify thủ công/probe sau khi code.
- KHÔNG sửa `progressQuests.ts`, `avatarSession.ts`, `routes.ts`, web UI — chỉ sửa `client.ts` `refreshProgressQuests()`.
- Giữ nguyên pattern: mỗi `doMenuOption` cần một lượt `communicate()` riêng (server chỉ phản hồi trong farm handler).
- Bản đồ userID → quest (verified): 19=Tân Thủ, 35=Nhà Nông, 38=Thợ Câu, 20=Tháng 7, 46=Tiền Sử.

## Tasks

### Task 1: Thêm query Nhiệm Vụ Tân Thủ trong refreshProgressQuests

**Files:**
- Modify: `avatar-web/server/src/game/client.ts:533-567` (method `refreshProgressQuests`)

**Interfaces:**
- Consumes: `this.farm.communicate(90)` (mở NPC Lái buôn), `this.farm.doMenuOption(19, 0, 0)` (cmd -61, chọn "Xem nhiệm vụ hiện tại" cho chuỗi Tân Thủ), handler cmd -62 hiện có (`client.ts:707-737`).
- Produces: `this.beginnerQuestState` = `ProgressQuestChain` (kind beginner, title "Nhiệm Vụ Tân Thủ 2", source 'game-dialog') sau khi server trả -62.

- [ ] **Step 1: Thêm interaction thứ 4 sau khối Nhà Nông**

  Trong `refreshProgressQuests()` (client.ts), sau khối query Nhà Nông (dòng ~556-563), thêm query Tân Thủ:

  ```ts
  // 3. Hỏi Nhiệm Vụ Tân Thủ (chuỗi quest tân thủ). userID 19 — mỗi chuỗi quest
  // có userID riêng (19=Tân Thủ, 35=Nhà Nông, 38=Thợ Câu); phát hiện bằng cách
  // quét doMenuOption(uid, 0, 0). Phản hồi cmd -62 có title chứa "Tân Thủ" nên
  // handler tự định tuyến vào beginnerQuestState (không ghi đè farmerQuestState).
  this.farm.communicate(90);
  await new Promise((resolve) => setTimeout(resolve, 450));
  this.farm.doMenuOption(19, 0, 0); // Nhiệm Vụ Tân Thủ → cmd -62
  await new Promise((resolve) => setTimeout(resolve, 500));
  ```

  Đồng thời cập nhật comment khối Nhà Nông (dòng ~551-555) để không còn ghi "Chỉ hỏi Nhà Nông" gây hiểu nhầm.

- [ ] **Step 2: Type-check**

  Run: `npx tsc --noEmit` (từ `avatar-web/server/`)
  Expected: không lỗi mới.

- [ ] **Step 3: Verify e2e (web session account phu)**

  - Restart server (tsx watch tự reload khi sửa `client.ts`) hoặc chạy lại probe `/tmp/verify-tanthu.ts` để xác nhận decode.
  - Reconnect: `POST /api/accounts/2/connect` (kèm `sid` cookie).
  - Kích hoạt: `POST /api/accounts/2/quests/progress/refresh`.
  - Kiểm tra: `GET /api/accounts/2/state` → `quests.beginner.title === "Nhiệm Vụ Tân Thủ 2"`, `source: 'game-dialog'`, `conditions`: `Mua 5 con gà (0/5)`, `Mua 2 con cá chép (2/2)`.
  - Không regression: `quests.farmer.title === "Nhiệm Vụ Nhà Nông - 1"` (cà chua 192/200), `quests.upgradeRequirements` vẫn 20 mục.

- [ ] **Step 4: detect_changes + commit**

  Run: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` — xác nhận chỉ ảnh hưởng symbol `refreshProgressQuests` / `beginnerQuestState`.
  Commit:
  ```bash
  git add avatar-web/server/src/game/client.ts docs/superpowers/specs/2026-08-21-tanthu-quest-real-data-design.md docs/superpowers/plans/2026-08-21-tanthu-quest-real-data.md
  git commit -m "feat(quest): hiển thị Nhiệm Vụ Tân Thủ thật từ NPC (doMenuOption uid=19)"
  ```
  Kết thúc commit message bằng dòng `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
