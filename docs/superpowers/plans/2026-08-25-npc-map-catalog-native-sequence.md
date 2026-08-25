# NPC Map Catalog Native Sequence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Inline execution is authorized for this bounded probe candidate; no commit is authorized.

**Goal:** Reproduce the native back-to-back `GET_HANDLER 9` → `REQUEST_CITY_MAP(0)` sequence once for account 2 / map 5 / area 7.

**Architecture:** Keep the existing redacted probe and decoder. Arm the `-24` listener before the synchronous park-context call, then send exactly one `-24` body `[0]` without the existing delay; classify only a fully decoded `RX -24` as catalog evidence.

**Tech Stack:** TypeScript, Node.js, `tsx`, existing `GameClient`, native APK disassembly notes.

**Spec:** `docs/superpowers/specs/2026-08-25-npc-map-catalog-native-sequence-design.md`

## Global Constraints

- Account 2, map 5, area 7 only; one live invocation and no retry.
- No guessed `80`, `-23`, `-21`, or follow-up command.
- Do not print packet body, hex, password, token, or host/port.
- Preserve unrelated dirty and untracked files; do not commit.
- Do not create a production catalog or mapping unless `RX -24` decodes with
  zero trailing bytes.

### Task 1: Apply native sequence timing

**Files:**
- Modify: `avatar-web/server/src/tools/npc-map-probe.ts`

**Interfaces:**
- Consumes: existing `waitForCityMapCatalog`, `GameClient.enterParkContext`,
  and redacted traffic capture.
- Produces: phase-correct `TX -1` and `TX -24 [0]` metadata.

- [ ] **Step 1: Impact check**
  Run GitNexus upstream impact for `runProbe` and `assertExpectedTraffic`.
  Expected: review direct callers; stop if HIGH or CRITICAL risk is reported.

- [x] **Step 2: Edit flow**
  Change the phase union and assertion to use `catalog-native`. Arm
  `waitForCityMapCatalog` before `enterParkContext()`, call
  `enterParkContext()` with no delay, set phase to `catalog-native`, and send
  exactly `client.sendRaw(-24, [{ t: 'i8', v: '0' }])`.

- [ ] **Step 3: Verify static scope**
  Run:

  ```bash
  npm --prefix avatar-web/server run typecheck
  git diff --check
  rg -n --glob '*.ts' 'sendRaw\\((-24|80|-23|-21)|hex|password|token|body' avatar-web/server/src/tools/npc-map-probe.ts
  ```

  Expected: typecheck and diff checks exit 0; only the permitted `-24 [0]`
  request exists in this flow; no sensitive output is introduced.

### Task 2: One live invocation and evidence

**Files:**
- Modify: `docs/superpowers/plans/2026-08-25-npc-map-catalog-native-sequence.md`

**Interfaces:**
- Consumes: the verified Task 1 probe and account 2 database credentials.
- Produces: redacted live result and an evidence classification.

- [ ] **Step 1: Preflight**
  From `avatar-web/server`, confirm `http://127.0.0.1:8787/api/auth/me` is
  refused and no `npc-map-probe` process is running.

- [ ] **Step 2: Run exactly once**
  Run from `avatar-web/server`:

  ```bash
  node --env-file=.env --import tsx src/tools/npc-map-probe.ts \
    --account-id 2 --map 5 --area 7
  ```

  Record timestamp, redacted traffic, redacted events, decode status, and the
  classification below. Do not paste packet body.

- [ ] **Step 3: Classify**
  Mark `catalog observed` only if `TX -24 len=1`, `RX -24`, complete decode,
  and zero trailing bytes are all present. Otherwise mark `catalog pending` and
  do not send another command.

- [ ] **Step 4: Final checks**
  Run GitNexus `detect_changes(scope="all")`, `npm --prefix avatar-web/server run typecheck`, and `git diff --check`. Do not commit.

## Rollback

If this candidate fails, retain its redacted live note and revert only the
native-sequence phase/timing diff after reviewing `git diff`; preserve all
unrelated files. No production catalog is written.

#### Live attempt 2026-08-25T02:34:44.160Z UTC
- Preflight `127.0.0.1:8787` was refused and no prior `npc-map-probe` process was
  present.
- One exact invocation for account 2 / map 5 / area 7 exited after the 5-second
  catalog wait.
- Positive traffic included login `RX -34 len178`, park-context `TX -1 len1`,
  and native-sequence `TX -24 len1`.
- After `-24`, only state traffic (`RX -36`, `-87`, `-94`, `-1`, `-57`) arrived;
  no `RX -24` arrived and the catalog decoder did not run.
- Classification: `catalog pending`; no map/area mapping or production
  catalog was created.
