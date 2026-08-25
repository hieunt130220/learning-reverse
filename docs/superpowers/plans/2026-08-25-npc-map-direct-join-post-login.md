# NPC Map Direct Join Post-Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended; inline execution is authorized for this bounded read-only probe candidate). No commit is authorized.

**Goal:** Obtain direct enter-world evidence for account 2 joining room 5 / board 7 after the authenticated native main-handler transition.

**Architecture:** Reuse the existing GameClient world snapshot decoder. Add a main/park handler barrier, arm the post-context snapshot waiter, send one `cmd 80` via the existing join API, and emit only redacted snapshot metadata.

**Tech Stack:** TypeScript, Node.js, `tsx`, existing `GameClient.waitForWorldSnapshot`, `ParkService`, native APK disassembly.

**Spec:** `docs/superpowers/specs/2026-08-25-npc-map-direct-join-post-login-design.md`

## Global Constraints

- Exact account 2 / map 5 / area 7; one live invocation, no retry.
- Explicit map join request is only one `cmd 80` with two signed-byte fields.
- No `-24`, `-23`, `-21`, NPC interaction, reward, raw body, hex, credential, or commit.
- Preserve unrelated dirty/untracked files and do not create production catalog before evidence gate.

### Task 1: Restore bounded direct-join evidence flow

**Files:**
- Modify: `avatar-web/server/src/tools/npc-map-probe.ts`

**Interfaces:**
- Consumes: current redacted listeners, `waitForHandlerResponse`, `GameClient.waitForWorldSnapshot`, `EnterWorldSnapshot` decoder.
- Produces: strict `main -1` → `park -1` → `80[5,7]` evidence output.

- [x] **Step 1: Impact checks**
  Run GitNexus upstream impact for `runProbe` and `assertExpectedTraffic`; stop
  on HIGH/CRITICAL.

- [x] **Step 2: Add snapshot waiter contract**
  Restore the narrow world-snapshot waiter/error mapping from the original probe;
  listener must be armed after Park context and before `client.joinPark`.

- [x] **Step 3: Change request flow**
  After online, send/await `-1[8]`; send/await `-1[9]`; set join phase; arm
  snapshot waiter; call `client.joinPark(args.map, args.area)` once; await and
  validate `playerId > 0`.

- [x] **Step 4: Update redacted assertions/output**
  Require main/park handler metadata, one `TX 80 len=2`, and one new `-34`;
  output `specialSectionEnd`, `totalBytes`, `trailingBytes`, `specialCount`,
  and `specialNames` only.

- [x] **Step 5: Verify static scope**
  Run:

  ```bash
  npm --prefix avatar-web/server run typecheck
  git diff --check
  rg -n --glob '*.ts' "sendRaw\\((-24|-23|-21)|joinPark|sendRaw\\(80" avatar-web/server/src/tools/npc-map-probe.ts
  ```

  Expected: no catalog/selection/any-join sends; one join API call only.

### Task 2: One live invocation and evidence classification

**Files:**
- Modify: `docs/superpowers/plans/2026-08-25-npc-map-direct-join-post-login.md`

**Interfaces:**
- Consumes: Task 1 probe and account 2 database row.
- Produces: redacted join result and evidence classification.

- [x] **Step 1: Preflight**
  Confirm `127.0.0.1:8787` is refused and no probe process exists.

- [x] **Step 2: Run exactly once**
  From `avatar-web/server` run:

  ```bash
  node --env-file=.env --import tsx src/tools/npc-map-probe.ts \
    --account-id 2 --map 5 --area 7
  ```

- [x] **Step 3: Classify**
  Direct join evidence requires `TX 80 len=2`, a new `RX -34`, strict decode,
  `playerId > 0`, and reviewed trailing bytes. Only then may a separate
  evidence/catalog gate be opened. Otherwise record pending and send nothing.

- [x] **Step 4: Final checks**
  Run GitNexus `detect_changes(scope="all")`, typecheck, and `git diff --check`;
  do not commit.

Live attempt (2026-08-25T03:14:06.528Z, account 2 / map 5 / area 7): preflight
confirmed `127.0.0.1:8787` refused and no probe process was running. Login
completed; authenticated main `-1[8]` and Park `-1[9]` each received their
handler response. The single join request was `TX 80 len=2`. The server
returned `RX -40 len=54` (dialog/rejection path) and did not return `RX -34`
within the bounded wait; world-snapshot decoding therefore timed out with no
`playerId`. This is not direct join evidence and does not open the
catalog/evidence gate.

Final verification: server typecheck passed; `git diff --check` passed;
GitNexus `detect_changes(scope="all")` reported 20 touched symbols across the
two tracked dirty files, zero affected execution processes, and low risk.

Fresh authorized cross-check (2026-08-25T03:55:02.311Z UTC, account 2 / map 5
/ area 7): the session reached `online`, Park handler acknowledgement was
observed, the single `TX 80 len=2` was sent, and the server returned redacted
`RX -40 len=54`. No new `RX -34` snapshot arrived within seven seconds. This
remains generic join rejection, not verified map/area evidence; no retry or
protocol fallback was sent.

Fresh bounded join check after the catalog retry (2026-08-25T04:07:22.964Z
UTC, account 2 / map 5 / area 7): the session reached `online`, the Park
handler acknowledgement was observed, and one `TX 80 len=2` was sent. The
server returned `RX -40 len=54`; no `RX -34` snapshot arrived during the
seven-second wait. The redacted projection contained one generic dialog and
the client remained online. This is still a join rejection, not map/area
evidence; no retry or fallback was sent.

## Rollback

Retain the redacted result. Revert only this candidate's probe diff if needed;
preserve unrelated changes and do not create a production catalog.
