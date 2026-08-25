# NPC Map Catalog Post-Login Main Handler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended; inline execution is authorized for this bounded read-only probe candidate). No commit is authorized.

**Goal:** Reproduce the authenticated native main-handler transition before the city-map catalog request for account 2 / map 5 / area 7.

**Architecture:** Add a redacted `main-context` phase to the standalone probe. After login, await `RX -1` for `-1[8]`, then send one `-1[9]` and one `-24[0]` in the native order; retain bounded catalog decoding and strict evidence rules.

**Tech Stack:** TypeScript, Node.js, `tsx`, existing `GameClient`/`Session`.

**Spec:** `docs/superpowers/specs/2026-08-25-npc-map-catalog-post-login-main-design.md`

## Global Constraints

- Exact account 2 / map 5 / area 7; one live invocation, no retry.
- Requests limited to authenticated `-1 [8]`, native `-1 [9]`, and `-24 [0]` once each.
- No raw body, hex, credentials, host/port, or sensitive output.
- No production catalog/mapping until complete `RX -24` decode with zero trailing bytes.
- Preserve unrelated dirty/untracked files and do not commit.

### Task 1: Align the probe with the authenticated native sequence

**Files:**
- Modify: `avatar-web/server/src/tools/npc-map-probe.ts`

**Interfaces:**
- Consumes: `waitForHandlerResponse`, `waitForCityMapCatalog`, current redacted traffic capture.
- Produces: one post-login main-handler barrier, one Park handler request, one city-map request.

- [x] **Step 1: Impact checks**
  Run GitNexus upstream impact for `runProbe`; stop on HIGH/CRITICAL.

- [x] **Step 2: Edit flow**
  Add the `main-context` phase. After `waitUntilOnline`, arm a handler waiter,
  send `client.sendRaw(-1, [{ t: 'i8', v: '8' }])`, and await it. Then arm the
  Park handler waiter, send one `-1 [9]`, await it, arm the catalog waiter, send
  `-24 [0]`, and decode the result.

- [x] **Step 3: Update strict expectations**
  Require one `main-context TX -1 len1`, one `main-context RX -1 len1`, one
  `park-context TX -1 len1`, one `park-context RX -1 len1`, one `-24 TX len1`,
  and one `RX -24` before printing evidence.

- [x] **Step 4: Verify static scope**
  Run:

  ```bash
  npm --prefix avatar-web/server run typecheck
  git diff --check
  rg -n --glob '*.ts' "sendRaw\\((-1|-24|80|-23|-21)" avatar-web/server/src/tools/npc-map-probe.ts
  ```

  Expected: typecheck/diff pass; exactly one `-1 [8]`, one `-1 [9]`, and one
  `-24 [0]` request in the probe.

### Task 2: One live invocation and classification

**Files:**
- Modify: `docs/superpowers/plans/2026-08-25-npc-map-catalog-post-login-main.md`

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
  Mark observed only with the authenticated main ack, Park ack, `TX -24 len1`,
  `RX -24`, complete decode, and zero trailing bytes. Otherwise record pending
  and send no further command.

- [x] **Step 4: Final checks**
  Run GitNexus `detect_changes(scope="all")`, typecheck, and `git diff --check`.
  Do not commit.

## Rollback

Keep the redacted attempt note. Revert only this candidate's probe diff if
needed; preserve all unrelated changes and create no catalog.

#### Live attempt 2026-08-25T03:03:42.995Z UTC

- Preflight passed: local Avatar Web health was refused and no probe process was
  running.
- The exact account-2 / map-5 / area-7 invocation reached `online`.
- The added authenticated main sequence was observed as `TX -1 len1` →
  `RX -1 len1`; one Park `TX/RX -1 len1` followed.
- `TX -24 len1` returned only state traffic (`RX -57 len1`) within 5 seconds;
  no `RX -24` arrived and the bounded decoder did not run.
- Classification: `catalog pending`; map 5 / area 7 remains unmapped and no
  further command was sent.
