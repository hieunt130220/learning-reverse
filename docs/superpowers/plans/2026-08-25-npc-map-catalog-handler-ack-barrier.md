# NPC Map Catalog Handler Ack Barrier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended; inline execution is authorized for this bounded read-only probe candidate). No commit is authorized.

**Goal:** Test one server-ack barrier between the native second handler request and `REQUEST_CITY_MAP(0)` for account 2 / map 5 / area 7.

**Architecture:** Reuse the redacted one-shot handler waiter twice. Only after the second `RX -1` is observed send the existing `-24 [0]`; no new opcode or payload is introduced.

**Tech Stack:** TypeScript, Node.js, `tsx`, existing `GameClient`/`Session`.

**Spec:** `docs/superpowers/specs/2026-08-25-npc-map-catalog-handler-ack-barrier-design.md`

## Global Constraints

- Exact account 2 / map 5 / area 7; one live invocation, no retry.
- Requests limited to `-1 [9]` twice and `-24 [0]` once.
- No raw body, hex, credentials, host/port, or sensitive output.
- No production catalog/mapping until complete `RX -24` decode.
- Preserve unrelated dirty/untracked files and do not commit.

### Task 1: Add the second handler barrier

**Files:**
- Modify: `avatar-web/server/src/tools/npc-map-probe.ts`

**Interfaces:**
- Consumes: current handler-roundtrip flow and `waitForHandlerResponse`.
- Produces: second handler `RX -1` barrier before `TX -24`.

- [x] **Step 1: Impact checks**
  Run GitNexus upstream impact for `runProbe`, `assertExpectedTraffic`, and
  `waitForHandlerResponse`; stop on HIGH/CRITICAL.

- [x] **Step 2: Edit flow**
  After the second `TX -1 [9]`, await a newly armed
  `waitForHandlerResponse(client, abort.signal, 5_000)`, then arm the catalog
  waiter and send `client.sendRaw(-24, [{ t: 'i8', v: '0' }])`.

- [x] **Step 3: Verify static scope**
  Run:

  ```bash
  npm --prefix avatar-web/server run typecheck
  git diff --check
  rg -n --glob '*.ts' "sendRaw\\((-1|-24|80|-23|-21)" avatar-web/server/src/tools/npc-map-probe.ts
  ```

  Expected: typecheck/diff pass; only two `-1` sends and one `-24 [0]` send.

### Task 2: One live invocation and classification

**Files:**
- Modify: `docs/superpowers/plans/2026-08-25-npc-map-catalog-handler-ack-barrier.md`

**Interfaces:**
- Consumes: Task 1 probe and account 2 database row.
- Produces: redacted live result and `catalog observed`/`catalog pending`.

- [x] **Step 1: Preflight**
  Confirm `127.0.0.1:8787` is refused and no `npc-map-probe` process exists.

- [x] **Step 2: Run exactly once**
  From `avatar-web/server` run:

  ```bash
  node --env-file=.env --import tsx src/tools/npc-map-probe.ts \
    --account-id 2 --map 5 --area 7
  ```

- [x] **Step 3: Classify and stop**
  Mark observed only with both handler acks, `TX -24 len1`, `RX -24`, complete
  decode, and zero trailing bytes. Otherwise record pending and do not send a
  further command.

- [x] **Step 4: Final checks**
  Run GitNexus `detect_changes(scope="all")`, typecheck, and `git diff --check`.
  Do not commit.

## Rollback

Keep the redacted attempt note. Revert only the timing-barrier diff if needed;
preserve unrelated changes and create no catalog.

#### Live attempt 2026-08-25T02:43:23.815Z UTC
- Preflight `127.0.0.1:8787` was refused and no prior `npc-map-probe` process was
  present.
- The single exact invocation did not reach the game protocol: events were
  `login/connecting` → `login/idle`, traffic was empty, and the login timeout
  fired after 12 seconds.
- Classification: `catalog pending` due external login rejection; no request
  sequence, catalog decode, or map/area evidence was produced. No retry was
  attempted.

#### Resumed live attempt 2026-08-25T02:46:28.251Z UTC
- The exact probe was invoked once after the resumed continuation; it again
  stopped before protocol traffic with `login/connecting` → `login/idle` and
  `traffic=[]`.
- A separate read-only TCP check to the configured game endpoint timed out after
  2.5 seconds, so the current blocker is endpoint reachability/session state,
  not a catalog decode result.
- Classification remains `catalog pending`; no additional command was sent and
  no catalog/evidence was created.

#### Live attempt 2026-08-25T02:52:50.238Z UTC
- The exact account-2 invocation reached the game: login was `connecting` →
  `handshaking` → `logging-in` → `online`.
- The native barrier was observed: `park-context TX -1 len1`, `park-context RX
  -1 len1`, `catalog-native TX -1 len1`, `catalog-native RX -1 len1`, then
  `catalog-native TX -24 len1`.
- The server returned `RX -57 len1` after `-24`; no `RX -24` arrived within
  5 seconds, so the bounded catalog decoder did not run and map 5 / area 7
  remains unmapped. No further command was sent.
- Classification: `catalog pending`; this attempt removes endpoint/login
  reachability as the blocker but does not prove a catalog response.
