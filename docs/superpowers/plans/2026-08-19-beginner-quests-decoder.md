# Beginner Quests Decoder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hiển thị đầy đủ nhiệm vụ hàng ngày của NPC Lái buôn từ packet thật và loại bỏ danh sách nhiệm vụ dựng cứng.

**Architecture:** Giữ decoder `Cmd -87/sub 4` đã xác minh, ngừng gọi hai builder dựng dữ liệu giả trong session, rồi thu gọn panel thành danh sách nhiệm vụ Lái buôn lấy trực tiếp từ `daily.missions`.

**Tech Stack:** TypeScript, Node.js, React, Vite, binary reader hiện có, GitNexus.

**Spec:** `docs/superpowers/specs/2026-08-19-beginner-quests-decoder-design.md`

## Global Constraints

- Không thay đổi protocol nhiệm vụ ngày hoặc nhiệm vụ chung.
- Không tạo nhiệm vụ từ suy đoán; chỉ hiển thị trường có trong packet.
- Không viết test trước production code; chỉ thêm test nếu người dùng yêu cầu.
- Giữ nguyên các thay đổi chưa liên quan trong worktree.
- Chạy GitNexus impact trước khi sửa symbol và detect changes trước khi kết thúc.

### Task 1: Xác định packet và decoder nhiệm vụ tân thủ

**Files:**
- Modify: `avatar-web/server/src/game/farmData.ts`
- Modify: `avatar-web/server/src/game/client.ts`
- Reference: `avatar-re/notes/*`, `avatar-re/il2cpp_out/dump.cs`

**Interfaces:**
- Consumes: raw message bytes từ opcode/sub-type nhiệm vụ tân thủ.
- Produces: `BeginnerQuestState` và hàm decode có validation.

- [x] **Step 1:** Chạy GitNexus impact cho các symbol `buildBeginnerQuests`, `QuestOverviewState`, `GameClient` trước khi chỉnh.
- [x] **Step 2:** Đối chiếu APK/asset và raw packet account 2: NPC Lái buôn dùng nhiệm vụ ngày `Cmd -87/sub 4`, packet trả 4 nhiệm vụ.
- [x] **Step 3:** Giữ decoder `decodeDailyQuestPacket` đã xác minh; không tạo decoder cho packet “tân thủ” không tồn tại.
- [x] **Step 4:** Giữ nguyên handler `Cmd -87/sub 4`, không bắt nhầm sub-type khác.
- [x] **Step 5:** Chạy typecheck server và probe account thật.

### Task 2: Nối trạng thái session và API overview

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts`
- Modify: `avatar-web/server/src/game/farmData.ts` (chỉ nếu cần cập nhật type)
- Modify: `avatar-web/server/src/session/routes.ts` (nếu hợp đồng API cần truyền source)

**Interfaces:**
- Consumes: `BeginnerQuestState` từ client.
- Produces: `QuestOverviewState.beginner` đầy đủ và metadata nguồn.

- [x] **Step 1:** Ngừng gọi `buildBeginnerQuests()`/`buildGeneralQuests()`; giữ hợp đồng API bằng mảng rỗng.
- [x] **Step 2:** Giữ luồng refresh/session reconnect hiện có cho `dailyQuestState`.
- [x] **Step 3:** Chạy typecheck server và xác minh raw packet qua probe account 2.

### Task 3: Hiển thị đầy đủ nhiệm vụ trên web

**Files:**
- Modify: `avatar-web/web/src/types.ts`
- Modify: `avatar-web/web/src/accounts/panels/QuestsPanel.tsx`

**Interfaces:**
- Consumes: danh sách beginner không giới hạn số phần tử và `source`.
- Produces: tab Tân thủ hiển thị toàn bộ nhiệm vụ theo thứ tự server trả về.

- [x] **Step 1:** Giữ hợp đồng API tương thích, chỉ dùng `daily` làm nguồn dữ liệu thật.
- [x] **Step 2:** Bỏ tabs và mọi số đếm hardcode; badge lấy từ mảng packet thực tế.
- [x] **Step 3:** Hiển thị thông báo rõ ràng khi chưa nhận được packet.
- [x] **Step 4:** Chạy `npm run build` và kiểm tra thủ công `/accounts/2`.

### Task 4: Kiểm chứng phạm vi thay đổi

**Files:**
- No production file changes expected.

- [x] **Step 1:** Chạy `git diff --check`.
- [x] **Step 2:** Chạy `gitnexus_detect_changes`; mức CRITICAL của toàn worktree gồm nhiều thay đổi có sẵn, còn phần nhiệm vụ chạm `getQuestOverview` và `QuestsPanel` như dự kiến.
- [x] **Step 3:** Ghi nhận packet account 2 `Cmd -87/sub 4` có 4 nhiệm vụ; UI được kiểm tra ở trạng thái ngắt kết nối, còn packet thật được xác minh bằng probe.
