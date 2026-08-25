# Native NPC Map Join Body Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Obtain one direct-join result for account 2 joining map 5 / area 7 with the six-byte native `cmd 80` body.

**Architecture:** Keep the experiment inside the standalone probe. Reuse the existing authenticated Park barrier and world-snapshot decoder, but replace the two-byte production helper call with one raw six-byte diagnostic request containing zero casino coordinates.

**Tech Stack:** TypeScript, Node.js, `tsx`, existing `GameClient`, `Message`, and strict enter-world decoder.

**Spec:** `docs/superpowers/specs/2026-08-25-npc-map-native-join-body-design.md`

## Global Constraints

- Exact account 2 / map 5 / area 7; one candidate payload per invocation and no
  payload retry/fallback.
- Exactly one `TX 80 len=6`: signed-byte room/board followed by big-endian
  `i16 0,0` casino-coordinate placeholders.
- No catalog/selection/any-join/NPC interaction commands; no production
  `ParkService` change and no catalog promotion.
- Output remains redacted and preserves unrelated dirty files; no commit.

**Execution note (2026-08-25):** the first invocation was rejected during
login before any candidate payload was sent. One cooldown retry was used only
to distinguish a transient login rejection; it was rejected identically, and
neither invocation sent `cmd 80`.

### Task 1: Implement the bounded native-body diagnostic

**Files:**
- Modify: `avatar-web/server/src/tools/npc-map-probe.ts`

**Interfaces:**
- Consumes: existing login flow, Park ACK waiter, `GameClient.waitForWorldSnapshot`, and traffic metadata.
- Produces: one redacted direct-join result with `TX 80 len=6` classification.

- [x] **Step 1: Impact checks**
  Run GitNexus upstream impact for `runProbe` and any changed helper. Stop on
  HIGH/CRITICAL and review all d=1 callers.

- [x] **Step 2: Change request flow**
  Arm the world-snapshot waiter after Park ACK, send
  `client.sendRaw(80, [{t:'i8',v:String(args.map)}, {t:'i8',v:String(args.area)}, {t:'i16',v:'0'}, {t:'i16',v:'0'}])` exactly once, and wait for the bounded result.

- [x] **Step 3: Update redacted assertions/output**
  Require one `TX 80 len=6` and a newly decoded `-34` before printing success;
  retain rejection/timeout metadata as pending without printing body or dialog.

- [x] **Step 4: Verify static scope**
  Run:

  ```bash
  npm --prefix avatar-web/server run typecheck
  git diff --check
  rg -n --glob '*.ts' "sendRaw\((80|-24|-23|-21)|joinPark" avatar-web/server/src/tools/npc-map-probe.ts
  ```

  Expected: exactly one `cmd 80` call and no catalog/selection/any-join call.

### Task 2: One live invocation and classification

**Files:**
- Modify: `docs/superpowers/plans/2026-08-25-npc-map-native-join-body.md`

**Interfaces:**
- Consumes: Task 1 probe and account 2 database row.
- Produces: one redacted result classified as direct-join observed or pending.

- [x] **Step 1: Preflight**
  Confirm local Avatar Web health is refused and no probe process exists.

- [x] **Step 2: Run bounded live invocation**
  From `avatar-web/server` run:

  ```bash
  node --env-file=.env --import tsx src/tools/npc-map-probe.ts \
    --account-id 2 --map 5 --area 7
  ```

  Result: `2026-08-25T04:57:39.177Z` and cooldown retry
  `2026-08-25T04:58:15.262Z` both stopped in `login` with two redacted
  `RX -40` dialogs each and `temporary-rejection` (`retryAfterMs=10000`).
  There was no `TX 80`, so no map/area response was elicited.

- [x] **Step 3: Classify**
  Mark observed only with `TX 80 len=6`, a new `RX -34`, strict decode,
  `playerId > 0`, and reviewed trailing bytes. The observed result is
  **direct-join pending at login**; no further payload was sent.

- [x] **Step 4: Final checks**
  Run GitNexus `detect_changes(scope="all")`, server typecheck, and
  `git diff --check`; do not commit.

## Live evidence boundary

The current evidence proves only that account 2 was still refused by the
server's temporary-login gate at both timestamps. It does not prove that map 5
or area 7 is invalid, and it is not catalog evidence. Resume the native-body
candidate only after the account's native session is fully disconnected and a
login reaches `online`.

### Corrected native response decode 2026-08-25T05:50:39.594Z

The bounded probe later reached `online` and captured one `TX 80 len=6` plus
one `RX 80 len=134`. Static `GlobalMessageHandler` disassembly shows that the
response order is `roomID/boardID` (i8), `x/y` (i16), `readListPlayer`, marker
and map vectors, animation vector, then optional `nSpecial` records. The
redacted decode matched room/board `5/7`, `x/y=0/0`, two players,
`specialCount=0`, `specialSectionEnd=113`, and 21 bytes still unknown. This is
direct-join evidence for the requested pair, not global catalog or NPC-location
evidence; no follow-up command or production mapping was sent.

## Rollback

Revert only the diagnostic probe diff if this candidate is rejected; preserve
all unrelated worktree changes and the redacted live notes.
