# NPC Map Selected Mini-Map Post-Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended; inline execution is authorized for this bounded read-only probe candidate). No commit is authorized.

**Goal:** Test whether account 2’s requested map 5 / area 7 are the native `SELECTED_MINI_MAP (-23)` identifiers and obtain a strict enter-world snapshot if so.

**Architecture:** Keep the authenticated main/Park context barriers and bounded world decoder; replace the direct join request with one `-23[i8=5,i8=7]` and wait for one new `-34`.

**Tech Stack:** TypeScript, Node.js, `tsx`, existing `GameClient.waitForWorldSnapshot`, native APK disassembly.

**Spec:** `docs/superpowers/specs/2026-08-25-npc-map-selected-minimap-post-login-design.md`

## Global Constraints

- Exact account 2 / map 5 / area 7; one invocation, no retry.
- Only new request is one `cmd -23` with two signed-byte fields.
- No `80`, `-24`, `-21`, NPC/reward command, raw body/hex/credentials, or commit.
- Preserve unrelated dirty/untracked files and do not create production catalog before strict evidence.

### Task 1: Switch direct join to selected mini-map request

**Files:**
- Modify: `avatar-web/server/src/tools/npc-map-probe.ts`

**Interfaces:**
- Consumes: main/Park handler barriers, snapshot waiter, redacted metadata.
- Produces: `select` phase with one `TX -23 len=2` and strict `RX -34` gate.

- [x] **Step 1: Impact checks**
  Run GitNexus upstream impact for `runProbe` and `assertExpectedTraffic`; stop
  on HIGH/CRITICAL.

- [x] **Step 2: Change request flow**
  Keep online/main/Park steps; set `phase='select'`, arm snapshot waiter, send
  `client.sendRaw(-23, [{t:'i8',v:String(args.map)}, {t:'i8',v:String(args.area)}])`,
  await snapshot, validate `playerId > 0`.

- [x] **Step 3: Update assertion/output**
  Require `select TX -23 len=2` and `select RX -34`; retain special section
  metadata and redacted errors.

- [x] **Step 4: Verify static scope**
  Run:

  ```bash
  npm --prefix avatar-web/server run typecheck
  git diff --check
  rg -n --glob '*.ts' "sendRaw\\((-23|-24|80|-21)|joinPark" avatar-web/server/src/tools/npc-map-probe.ts
  ```

  Expected: only selected mini-map request is present; no direct join/catalog
  request.

### Task 2: One live invocation and classification

**Files:**
- Modify: `docs/superpowers/plans/2026-08-25-npc-map-selected-minimap-post-login.md`

**Interfaces:**
- Consumes: Task 1 probe and account 2 database row.
- Produces: redacted selection result and evidence classification.

- [x] **Step 1: Preflight**
  Confirm local `127.0.0.1:8787` refused and no probe process exists.

- [x] **Step 2: Run exactly once**
  From `avatar-web/server` run:

  ```bash
  node --env-file=.env --import tsx src/tools/npc-map-probe.ts \
    --account-id 2 --map 5 --area 7
  ```

- [x] **Step 3: Classify and stop**
  Evidence requires `TX -23 len=2`, new `RX -34`, `playerId > 0`, full decode,
  and reviewed trailing bytes. Otherwise record pending and send nothing else.

- [x] **Step 4: Final checks**
  Run GitNexus `detect_changes(scope="all")`, typecheck, and diff check; do not
  commit.

## Rollback

Retain the redacted attempt note. Revert only this candidate request diff if
needed; preserve unrelated work and create no catalog.

#### Live attempt 2026-08-25T03:16:06.285Z UTC

- Preflight passed: local Avatar Web health was refused and no probe process was
  running.
- The exact account-2 / map-5 / area-7 invocation reached `online`, completed
  authenticated main and Park handler barriers, and sent `select TX -23 len2`.
- No response `RX -34` (or other post-select traffic) arrived within 5 seconds;
  the snapshot waiter timed out and the decoder did not run.
- Classification: `catalog/evidence pending`; the pair is not verified as
  `idCityMap/id` and no further command was sent.
