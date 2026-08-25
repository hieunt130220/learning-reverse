# NPC Map Catalog Post-Login Native Timing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended; inline execution is authorized for this bounded read-only probe candidate). No commit is authorized.

**Goal:** Test the final native timing difference by sending Park handler and city-map catalog request back-to-back after authenticated main handler.

**Architecture:** Keep the bounded decoder and redacted metadata. Arm handler/catalog waiters before the two native requests, send `-1[9]` then `-24[0]` synchronously, and assert TX phase order plus command-level ACK/decode evidence.

**Tech Stack:** TypeScript, Node.js, `tsx`, existing `GameClient`/`Session`, native APK disassembly.

**Spec:** `docs/superpowers/specs/2026-08-25-npc-map-catalog-post-login-native-timing-design.md`

## Global Constraints

- Exact account 2 / map 5 / area 7; one live invocation, no retry.
- Requests limited to authenticated `-1 [8]`, native `-1 [9]`, and `-24 [0]` once each.
- No raw body, hex, credentials, host/port, or sensitive output.
- No production catalog/mapping until complete `RX -24` decode with zero trailing bytes.
- Preserve unrelated dirty/untracked files and do not commit.

### Task 1: Remove the non-native Park ACK barrier

**Files:**
- Modify: `avatar-web/server/src/tools/npc-map-probe.ts`

**Interfaces:**
- Consumes: authenticated main-handler flow, handler/catalog waiters, redacted traffic.
- Produces: back-to-back `-1[9]` → `-24[0]` timing and strict command-level evidence.

- [x] **Step 1: Impact checks**
  Run GitNexus upstream impact for `runProbe`; stop on HIGH/CRITICAL.

- [x] **Step 2: Edit flow**
  After main `RX -1`, arm `waitForHandlerResponse` and
  `waitForCityMapCatalog`, send `-1[9]`, switch to `catalog-native`, then send
  `-24[0]` immediately. Await both promises; do not send a follow-up command.

- [x] **Step 3: Update assertions**
  Keep phase-scoped TX counts for main `-1[8]`, Park `-1[9]`, and catalog
  `-24[0]`; require one main `RX -1`, one additional `RX -1`, and one `RX -24`
  by command, with the existing zero-trailing decoder gate.

- [x] **Step 4: Verify static scope**
  Run:

  ```bash
  npm --prefix avatar-web/server run typecheck
  git diff --check
  rg -n --glob '*.ts' "sendRaw\\((-1|-24|80|-23|-21)" avatar-web/server/src/tools/npc-map-probe.ts
  ```

  Expected: typecheck/diff pass; only `-1[8]`, `-1[9]`, and `-24[0]` are
  explicit catalog-probe requests.

### Task 2: One live invocation and classification

**Files:**
- Modify: `docs/superpowers/plans/2026-08-25-npc-map-catalog-post-login-native-timing.md`

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
  Mark observed only with authenticated main ACK, Park ACK, `TX -24 len1`,
  `RX -24`, complete decode, and zero trailing bytes. Otherwise record pending
  and do not send another command.

- [x] **Step 4: Final checks**
  Run GitNexus `detect_changes(scope="all")`, typecheck, and `git diff --check`.
  Do not commit.

## Rollback

Retain this redacted live note. Revert only this candidate's timing diff if
needed; preserve all unrelated changes and create no catalog.

#### Live attempt 2026-08-25T03:06:45.151Z UTC

- Preflight passed: local Avatar Web health was refused and no probe process was
  running.
- The exact account-2 / map-5 / area-7 invocation reached `online`.
- Authenticated main handler was observed as `main-context TX -1 len1` followed
  by `main-context RX -1 len1`.
- Native timing candidate sent `park-context TX -1 len1` immediately followed
  by `catalog-native TX -24 len1`; the server returned one further `RX -1
  len1` and `RX -57 len1`, but no `RX -24` within 5 seconds.
- Classification: `catalog pending`; the bounded decoder did not run and map 5
  / area 7 remains unmapped. No further command was sent.
