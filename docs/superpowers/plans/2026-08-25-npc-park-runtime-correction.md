# NPC Park Runtime Protocol-Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Làm cho AutoFindNpc production gửi/đọc đúng native Park join đã live-verify và bật catalog `{map:5, area:7}`.

**Architecture:** Port parser prefix RX80 vào `worldData.ts`, phát snapshot thống nhất qua `GameClient`, encode tọa độ native trong `ParkService`, rồi inject một readonly catalog entry vào `SessionManager`. Không thay đổi runner/API state machine.

**Tech Stack:** TypeScript 5.7, Node.js 22, EventEmitter, existing `GameClient`, npm `typecheck`/`build`/`test`, GitNexus.

**Spec:** `docs/superpowers/specs/2026-08-25-npc-park-runtime-correction-design.md`

## Global Constraints

- Chỉ entry production `{ map: 5, area: 7 }`; không thêm area khác từ occupancy.
- `cmd80` body production là đúng 6 byte `[i8 map, i8 area, i16 254, i16 82]` cho map 5.
- Không fallback `-24/-23/-21`, không interaction/combat/reward/write command.
- RX80 trailing bytes chỉ được lưu metadata `trailingBytes`, không coi là NPC.
- Không tạo test file; chạy test suite hiện có sau production code.
- Preserve tất cả dirty/untracked artifacts không thuộc task; không commit nếu user chưa yêu cầu.

### Task 1: Native park join encoder

**Files:**
- Modify: `avatar-web/server/src/game/parkService.ts`

**Interfaces:**
- Consumes: `(map, area)` từ `AutoFindNpcClient.joinPark`.
- Produces: native TX80 six-byte message; throws for unreviewed map position.

- [x] **Step 1: Impact**

  Chạy GitNexus impact upstream cho `ParkService`, `doJoinPark` và
  `GameClient.joinPark`; review d=1 callers.

- [x] **Step 2: Implement**

  Add readonly map-position table with map 5 `(254,82)`; write two signed
  bytes then two big-endian shorts. Reject unsupported map before `session.send`.

- [x] **Step 3: Typecheck**

  Run `npm --prefix avatar-web/server run typecheck`.

### Task 2: RX80 world snapshot decoder

**Files:**
- Modify: `avatar-web/server/src/game/worldData.ts`
- Modify: `avatar-web/server/src/game/client.ts`

**Interfaces:**
- Consumes: `Message` command 80 body and current `playerId`.
- Produces: `EnterWorldSnapshot` with `specials`, section/trailing metadata;
  `world-snapshot` / `world-snapshot-error` events consumed by runner.

- [x] **Step 1: Impact**

  Run GitNexus impact for `decodeEnterWorld`, `waitForWorldSnapshot`,
  `GameClient.onMessage`; inspect d=1 consumers and preserve login -34 path.

- [x] **Step 2: Implement strict RX80 decoder**

  Port the reviewed probe layout: room/board/coordinates, player records,
  drop-part records, map marker/items, animations, and specials. Enforce bounds,
  reject negative counts, and return stable trailing length.

- [x] **Step 3: Wire command 80**

  Add `case 80` after login switch handling; decode only for snapshot event,
  leave login status untouched, and emit decode error without throwing from the
  client message loop.

- [x] **Step 4: Verify**

  Run server typecheck and build; existing `-34` behavior remains unchanged.

### Task 3: Verified catalog injection

**Files:**
- Create: `avatar-web/server/src/game/npcMapCatalog.ts`
- Modify: `avatar-web/server/src/index.ts`

**Interfaces:**
- Consumes: evidence doc and `SessionManagerDeps.findNpcCatalog`.
- Produces: non-empty readonly catalog visible to API/runner.

- [x] **Step 1: Impact**

  Run GitNexus impact upstream for `SessionManager`, `hasVerifiedFindNpcCatalog`
  and index construction before editing wiring.

- [x] **Step 2: Create catalog and inject**

  Export only `[{ map: 5, area: 7 }]` and pass it to `new SessionManager`.

- [x] **Step 3: Verify**

  Run typecheck/build and existing tests; assert no production catalog entry
  exists for unprobed areas through source inspection.

### Task 4: Scope and acceptance audit

- [x] **Step 1:** Run `git diff --check`, forbidden-command scan, and
  `gitnexus_detect_changes(scope="all")`.
- [x] **Step 2:** If user authorizes a live production acceptance run, use one
  account/session and report whether RX80 `specials` contains the target; do
  not claim target-found when it is empty.
- [x] **Step 3:** Update the main AutoFind plan with protocol correction and
  catalog entry evidence; keep end-to-end target acceptance unchecked if no NPC
  appears.
