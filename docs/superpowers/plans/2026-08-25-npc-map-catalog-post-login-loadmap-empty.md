# NPC Map Catalog Post-Login LoadMap Empty Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended; inline execution is authorized for this bounded read-only probe candidate). No commit is authorized.

**Goal:** Test the statically verified `LoadMap.doJoin` city-map request (`-24` with empty body) after authenticated native context.

**Architecture:** Retain the current post-login main handler and back-to-back Park timing; change only the catalog request body to an empty field list and require `TX -24 len=0` before accepting any catalog response.

**Tech Stack:** TypeScript, Node.js, `tsx`, existing `GameClient`/`Session`, native APK disassembly.

**Spec:** `docs/superpowers/specs/2026-08-25-npc-map-catalog-post-login-loadmap-empty-design.md`

## Global Constraints

- Exact account 2 / map 5 / area 7; one invocation, no retry.
- Explicit catalog request is only `client.sendRaw(-24, [])`.
- No raw body, hex, credentials, host/port, sensitive output, or production mapping.
- Preserve unrelated dirty/untracked files and do not commit.

### Task 1: Switch the native caller body

**Files:**
- Modify: `avatar-web/server/src/tools/npc-map-probe.ts`

**Interfaces:**
- Consumes: current authenticated main/native timing flow and bounded decoder.
- Produces: `catalog-native TX -24 len=0` contract.

- [x] **Step 1: Impact checks**
  Run GitNexus upstream impact for `runProbe` and `assertExpectedTraffic`; stop
  on HIGH/CRITICAL.

- [x] **Step 2: Edit request and assertion**
  Change the `catalog-native` TX assertion to length `0` and send
  `client.sendRaw(-24, [])`; do not change any other command or timeout.

- [x] **Step 3: Verify static scope**
  Run:

  ```bash
  npm --prefix avatar-web/server run typecheck
  git diff --check
  rg -n --glob '*.ts' "sendRaw\\((-1|-24|80|-23|-21)" avatar-web/server/src/tools/npc-map-probe.ts
  ```

  Expected: typecheck/diff pass; the three explicit requests are `-1[8]`,
  `-1[9]`, and `-24[]`.

### Task 2: One live invocation and classification

**Files:**
- Modify: `docs/superpowers/plans/2026-08-25-npc-map-catalog-post-login-loadmap-empty.md`

**Interfaces:**
- Consumes: Task 1 probe and account 2 database row.
- Produces: redacted catalog result or pending classification.

- [x] **Step 1: Preflight**
  Confirm local `127.0.0.1:8787` is refused and no probe process exists.

- [x] **Step 2: Run exactly once**
  From `avatar-web/server` run:

  ```bash
  node --env-file=.env --import tsx src/tools/npc-map-probe.ts \
    --account-id 2 --map 5 --area 7
  ```

- [x] **Step 3: Classify and stop**
  `catalog observed` requires `TX -24 len=0`, `RX -24`, complete decode, and
  zero trailing bytes. Otherwise record `catalog pending` and send nothing else.

- [x] **Step 4: Final checks**
  Run GitNexus `detect_changes(scope="all")`, server typecheck, and
  `git diff --check`; do not commit.

## Rollback

Retain the redacted attempt note. Revert only this body diff if needed; preserve
all unrelated changes and create no catalog.

#### Live attempt 2026-08-25T03:10:13.705Z UTC

- Preflight passed: local Avatar Web health was refused and no probe process was
  running.
- The exact account-2 / map-5 / area-7 invocation reached `online` and observed
  authenticated main `-1` plus native Park `-1`.
- `catalog-native TX -24 len=0` produced `RX -1 len1`, `RX -57 len1`, and
  `RX -61 len59`; no `RX -24` arrived within 5 seconds.
- Classification: `catalog pending`; the `-61` response is not promoted to
  catalog evidence, and map 5 / area 7 remains unmapped. No further command was
  sent.
