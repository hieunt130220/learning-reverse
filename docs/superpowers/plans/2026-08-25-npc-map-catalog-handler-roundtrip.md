# NPC Map Catalog Handler Roundtrip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended; inline execution is authorized for this bounded read-only probe candidate). No commit is authorized.

**Goal:** Reproduce the native handler roundtrip before requesting the city-map catalog once for account 2 / map 5 / area 7.

**Architecture:** Add a bounded one-shot waiter for `RX -1`, then send the native second `-1 [9]` and `-24 [0]` through the existing redacted probe; retain the existing catalog decoder and no-write safety gates.

**Tech Stack:** TypeScript, Node.js, `tsx`, existing `GameClient`/`Session`, native APK disassembly.

**Spec:** `docs/superpowers/specs/2026-08-25-npc-map-catalog-handler-roundtrip-design.md`

## Global Constraints

- Exact account 2 / map 5 / area 7; one live invocation and no retry.
- Only `-1` and `-24` requests allowed; no `80`, `-23`, `-21`, or guessed body.
- No raw packet body, hex, credentials, host/port, or sensitive output.
- Preserve unrelated dirty/untracked files; do not commit.
- Do not create production catalog/mapping unless `RX -24` decodes completely.

### Task 1: Implement handler roundtrip

**Files:**
- Modify: `avatar-web/server/src/tools/npc-map-probe.ts`

**Interfaces:**
- Consumes: existing phase-aware traffic capture and catalog waiter.
- Produces: handler barrier metadata and native second-request sequence.

- [x] **Step 1: Impact checks**
  Run GitNexus upstream impact for `runProbe`, `assertExpectedTraffic`, and
  `waitForCityMapCatalog`. Expected risk LOW; stop on HIGH/CRITICAL.

- [x] **Step 2: Add bounded `RX -1` waiter**
  Add `waitForHandlerResponse(client, signal, timeoutMs): Promise<void>` using a
  single `client.session` message listener. Resolve only on `msg.command === -1`;
  cleanup on resolve/reject/timeout/abort.

- [x] **Step 3: Change flow and assertion**
  Arm the handler waiter before `enterParkContext()`. Await the handler waiter,
  set `phase = 'catalog-native'`, arm the catalog waiter, then send
  `client.sendRaw(-1, [{ t: 'i8', v: '9' }])`, then send
  `client.sendRaw(-24, [{ t: 'i8', v: '0' }])`. Require exactly two `TX -1`
  (one per phase), one `TX -24 len=1`, and one handler `RX -1` before catalog.

- [ ] **Step 4: Static verification**
  Run:

  ```bash
  npm --prefix avatar-web/server run typecheck
  git diff --check
  rg -n --glob '*.ts' "sendRaw\\((-1|-24|80|-23|-21)|entry\\.hex|password|token|host|port" avatar-web/server/src/tools/npc-map-probe.ts
  ```

  Expected: typecheck/diff pass; only `-1` and `-24` sends are present and no
  sensitive output is introduced.

### Task 2: One live invocation and classification

**Files:**
- Modify: `docs/superpowers/plans/2026-08-25-npc-map-catalog-handler-roundtrip.md`

**Interfaces:**
- Consumes: Task 1 probe and account 2 database row.
- Produces: redacted live traffic/events and catalog classification.

- [ ] **Step 1: Preflight**
  Confirm local Avatar Web health is refused and no `npc-map-probe` process is
  running.

- [ ] **Step 2: Run once**
  From `avatar-web/server` run:

  ```bash
  node --env-file=.env --import tsx src/tools/npc-map-probe.ts \
    --account-id 2 --map 5 --area 7
  ```

- [ ] **Step 3: Classify**
  Mark `catalog observed` only with `TX -1` context, `RX -1`, second `TX -1`,
  `TX -24 len=1`, `RX -24`, complete decode and zero trailing bytes. Otherwise
  record `catalog pending`; send no further request.

- [ ] **Step 4: Final checks**
  Run GitNexus `detect_changes(scope="all")`, server typecheck and
  `git diff --check`; do not commit.

## Rollback

Retain the redacted live result, then revert only the handler-roundtrip diff if
the candidate fails. Preserve all unrelated files and do not create a catalog.

#### Live attempt 2026-08-25T02:41:01.546Z UTC
- Preflight `127.0.0.1:8787` was refused and no prior `npc-map-probe` process was
  present.
- One exact invocation for account 2 / map 5 / area 7 exited after the catalog
  timeout.
- The native roundtrip was observed: park-context `TX -1 len1` → `RX -1 len1`,
  catalog-native `TX -1 len1` → `TX -24 len1` → `RX -1 len1`.
- The only packet after the catalog request was `RX -57 len1`; no `RX -24`
  arrived, so decode and mapping remain unverified.
- Classification: `catalog pending`; no production catalog was created.
