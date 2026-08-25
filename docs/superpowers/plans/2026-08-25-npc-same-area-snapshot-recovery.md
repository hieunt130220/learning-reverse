# NPC Same-Area Snapshot Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Không biến phản hồi same-area hợp lệ thành timeout giả trong Auto Tìm NPC.

**Architecture:** Cache RX80 Park cuối trong `GameClient`, mở rộng waiter với
target room/board và chỉ resolve cache sau dialog same-area exact; runner truyền
target hiện tại vào waiter.

**Tech Stack:** TypeScript, Node.js EventEmitter, existing GameClient/AutoFindNpc,
npm typecheck/build/test.

**Spec:** `docs/superpowers/specs/2026-08-25-npc-same-area-snapshot-recovery-design.md`

## Global Constraints

- Chỉ cache snapshot từ RX80 strict decoder; không dùng login -34.
- Fallback cần đồng thời exact dialog same-area và room/board khớp target.
- Không gửi thêm opcode, không đổi catalog `{ map: 5, area: 7 }`, không chạm
  farm/shop lane.
- Không tạo test file mới; preserve mọi dirty/untracked artifact hiện có.
- Không commit nếu user chưa yêu cầu.

### Task 1: Cache and same-area waiter recovery

**Files:**
- Modify: `avatar-web/server/src/game/client.ts`

**Interfaces:**
- Consumes: decoded RX80 snapshot, dialog `-40`, optional expected map/area.
- Produces: `waitForWorldSnapshot(signal, timeoutMs, expected?)` resolving a
  fresh RX80 or matching same-area cache.

- [x] **Step 1: Impact**

  Run GitNexus impact upstream for `waitForWorldSnapshot` and `onMessage`.
  Review all d=1 consumers and warn on HIGH/CRITICAL.

- [x] **Step 2: Implement**

  Store the last successful Park RX80 snapshot. Add an optional expected target
  to the waiter and a same-area dialog listener. Resolve a defensive snapshot
  copy only when the exact dialog and cached room/board both match; otherwise
  preserve current timeout/decode behavior.

- [x] **Step 3: Static verification**

  Scan for the exact same-area string and assert no login snapshot or fallback
  opcode is used by the recovery branch.

### Task 2: Pass target through runner

**Files:**
- Modify: `avatar-web/server/src/autoFindNpc.ts`

**Interfaces:**
- Consumes: `NpcMapLocation` target from scan/current tracking.
- Produces: target-aware calls to `waitForWorldSnapshot`.

- [x] **Step 1: Impact**

  Run GitNexus impact upstream for `scanningStep` and `trackingStep`.

- [x] **Step 2: Implement**

  Extend the narrow client interface with an optional target parameter and pass
  `{ map: target.map, area: target.area }` in both scan and tracking paths.

- [x] **Step 3: Review**

  Confirm timeout/backoff remains the behavior when no matching cache exists.

### Task 3: Verification and bounded live acceptance

- [x] **Step 1: Verify**

  Run:

  ```bash
  npm --prefix avatar-web/server run typecheck
  npm --prefix avatar-web/server run build
  npm --prefix avatar-web/server test
  git diff --check
  ```

- [x] **Step 2: Detect changes**

  `gitnexus_detect_changes(scope="all")` completed. The report is `critical`
  because the worktree also contains the previously approved map/catalog/probe
  changes; the current recovery diff is limited to `GameClient` and the
  `AutoFindNpc` waiter call sites.

- [x] **Step 3: Live acceptance**

  On account 2 / map 5 / area 7, verify one RX80 fresh resolution followed by
  same-area dialog resolution from cache. If `specials` is empty, report NPC
  target pending; do not claim a find.

  Acceptance completed on 2026-08-25: after reconnect, account 2 received a
  fresh RX80 for map 5 / area 7. Subsequent same-area responses at 15:32:50,
  15:33:20, 15:33:50, 15:34:20, and 15:34:50 emitted
  `Park snapshot cache: server xác nhận đã ở map 5 khu 7`; no `hết giờ chờ gói
  enter-world (-34)` occurred. The runner was stopped after the bounded run;
  `Ngưu lang` remains pending because the verified catalog currently contains
  no matching NPC special.

- [x] **Step 4: Commit**

  User explicitly requested committing all related Auto Tìm NPC files; leave
  unrelated `avatar-jar/` untracked.
