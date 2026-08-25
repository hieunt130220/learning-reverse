# NPC Area Rotation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khi area hiện tại không có NPC, Auto Tìm NPC phải gửi join sang area kế tiếp trong catalog map 5.

**Architecture:** Mở rộng readonly production catalog từ một area 5/7 thành 35 board indexes 5/0..5/34. Giữ nguyên `AutoFindNpc` cursor, native `cmd 80` và same-area waiter; runner tự xoay catalog sau miss.

**Tech Stack:** TypeScript, Node.js, existing AutoFindNpc/ParkService/GameClient, npm typecheck/build/test.

**Spec:** `docs/superpowers/specs/2026-08-25-npc-area-rotation-design.md`

## Global Constraints

- Chỉ map 5; area lấy từ `RX 90` live board-list, index 0-based.
- Không thêm command mới, không dùng `-23/-24/-21`, không tương tác NPC.
- Không sửa persistence/API/WS/UI và không tạo test file mới.
- Preserve mọi dirty/untracked artifact khác; không commit nếu user chưa yêu cầu.
- Live acceptance chỉ chạy sau user duyệt và chỉ bounded account 2, map 5, area 0 → 1.

### Task 1: Impact and source review

**Files:**
- Review: `avatar-web/server/src/game/npcMapCatalog.ts`
- Callers: `avatar-web/server/src/index.ts`, `avatar-web/server/src/session/manager.ts`, `avatar-web/server/src/autoFindNpc.ts`

**Interfaces:**
- Consumes: existing `VERIFIED_NPC_MAP_CATALOG` and board-list evidence.
- Produces: confirmed blast radius and catalog contract.

- [x] **Step 1: GitNexus impact**

  Run impact upstream for the catalog seam and its `SessionManager`/`index.ts`
  callers. If the untracked catalog symbol is not indexed, record that and use
  the indexed caller symbols as the conservative proxy. The catalog symbol was
  not indexed; proxy impacts for `SessionManager`, `index.ts`, and
  `scanningStep` were LOW.

- [x] **Step 2: Review cursor behavior**

  Confirm `scanningStep` increments `cursor` after an empty `specials` list and
  that `trackingStep` advances after two valid misses. No runner code change is
  required; both paths already advance through a multi-entry catalog.

### Task 2: Expand verified area catalog

**Files:**
- Modify: `avatar-web/server/src/game/npcMapCatalog.ts`

**Interfaces:**
- Consumes: board-list room 5 indexes 0..34 and native map-5 join position.
- Produces: readonly ordered `NpcMapLocation[]` consumed by SessionManager.

- [x] **Step 1: Replace single entry**

  Export exactly 35 unique entries in increasing order:
  `{ map: 5, area: 0 }` through `{ map: 5, area: 34 }`. Update comments to
  distinguish board-list verification from NPC presence verification.

- [x] **Step 2: Static safety review**

  Use `rg`/small shell assertions to check count, first/last entry, uniqueness,
  no map other than 5, and no accidental opcode or coordinate changes. Result:
  `count=35`, `first=5/0`, `last=5/34`, `unique=35`; `git diff --check` passed.

### Task 3: Verification and bounded acceptance

**Files:**
- Verify: `avatar-web/server/src/game/npcMapCatalog.ts`,
  `avatar-web/server/src/autoFindNpc.ts`
- Update: this plan with results

- [x] **Step 1: Build checks**

  Run:

  ```bash
  npm --prefix avatar-web/server run typecheck
  npm --prefix avatar-web/server run build
  npm --prefix avatar-web/server test
  git diff --check
  ```

  Result: typecheck/build passed; server test suite `258 pass, 0 fail`; no
  whitespace errors.

- [x] **Step 2: GitNexus detect changes**

  Run `gitnexus_detect_changes(scope="all")`, review affected flows and note
  any broad risk caused by pre-existing dirty files. The report was
  `critical` because the worktree already contains the earlier protocol/probe
  changes; the new catalog change itself is one file and does not alter the
  runner symbols.

- [x] **Step 3: Live acceptance (authorization required)**

  On account 2, start Find NPC with the saved target. Observe a miss at map 5 /
  area 0 and one subsequent join/probe at map 5 / area 1. Stop immediately
  after the transition evidence; do not claim the NPC was found if `specials`
  is empty. Acceptance used the requested new start: account 2, target
  `Ngưu lang`, started at map 5 / area 0; the UI reached
  `Đang quét 2/35 · Map 5 - Khu 1` after the first bounded interval. The runner
  was stopped immediately and no NPC-found claim was made.

- [x] **Step 4: Commit**

  User explicitly requested committing all related Auto Tìm NPC files. Include
  this plan in the same commit; leave unrelated `avatar-jar/` untracked.
