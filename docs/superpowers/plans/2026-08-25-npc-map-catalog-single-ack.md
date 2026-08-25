# NPC Map Catalog Single-ACK Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended; inline execution is authorized for this bounded read-only probe candidate). No commit is authorized.

**Goal:** Test one Park-handler acknowledgement barrier before `REQUEST_CITY_MAP(0)` for account 2 / map 5 / area 7.

**Architecture:** Add a redacted one-shot waiter for `RX -1[9]`, await it after the existing `enterParkContext()`, then send the unchanged `-24[0]` request and decode only a complete catalog response.

**Tech Stack:** TypeScript, Node.js, `tsx`, existing `GameClient`/`Session`.

**Spec:** `docs/superpowers/specs/2026-08-25-npc-map-catalog-single-ack-design.md`

## Global Constraints

- Exact account 2 / map 5 / area 7; one live invocation and no retry.
- Requests limited to the existing `-1[9]` and `-24[0]` candidate.
- No raw body, hex, credentials, host/port, or sensitive output.
- No production catalog/mapping until complete `RX -24` decode with zero
  trailing bytes.
- Preserve unrelated dirty/untracked files and do not commit.

### Task 1: Add the handler acknowledgement barrier

**Files:**
- Modify: `avatar-web/server/src/tools/npc-map-probe.ts`

**Interfaces:**
- Consumes: `GameClient.enterParkContext()`, current phase-aware traffic
  capture, and `waitForCityMapCatalog`.
- Produces: one validated Park `RX -1` prerequisite before `TX -24[0]`.

- [x] **Step 1: Impact checks**
  Run GitNexus upstream impact for `runProbe`, `assertExpectedTraffic`, and the
  new handler waiter target; stop on HIGH/CRITICAL.

- [x] **Step 2: Edit flow**
  Add a one-shot waiter that checks `Message.command === -1`, body length `1`,
  and signed body value `9` without printing it. Arm it before
  `enterParkContext()`, await it, switch to `catalog-native`, arm the catalog
  waiter, and send `client.sendRaw(-24, [{ t: 'i8', v: '0' }])`.

- [x] **Step 3: Verify static scope**
  Run:

  ```bash
  npm --prefix avatar-web/server run typecheck
  git diff --check
  rg -n --glob '*.ts' "sendRaw\\((-1|-24|80|-23|-21)" avatar-web/server/src/tools/npc-map-probe.ts
  ```

  Expected: typecheck/diff pass; only the permitted `-24[0]` request is
  explicit in the catalog flow.

### Task 2: One live invocation and classification

**Files:**
- Modify: `docs/superpowers/plans/2026-08-25-npc-map-catalog-single-ack.md`

**Interfaces:**
- Consumes: Task 1 probe and account 2 database row.
- Produces: one redacted live result classified as `catalog observed` or
  `catalog pending`.

- [x] **Step 1: Preflight**
  Confirm `127.0.0.1:8787` is refused and no `npc-map-probe` process exists.

- [x] **Step 2: Run exactly once**
  From `avatar-web/server` run:

  ```bash
  node --env-file=.env --import tsx src/tools/npc-map-probe.ts \
    --account-id 2 --map 5 --area 7
  ```

- [x] **Step 3: Classify and stop**
  Mark `catalog observed` only with the Park ACK, `TX -24 len=1`, `RX -24`,
  complete decode, and zero trailing bytes. Otherwise record `catalog pending`
  and send no further command.

- [x] **Step 4: Final checks**
  Run GitNexus `detect_changes(scope="all")`, server typecheck, and
  `git diff --check`. Do not commit.

## Rollback

Retain the redacted live note. Revert only this candidate's waiter/timing diff
if needed; preserve unrelated files and create no catalog.

#### Live attempt 2026-08-25T03:42:09.053Z UTC

- Preflight passed: local Avatar Web health was refused and no probe process was
  running.
- The exact account-2 / map-5 / area-7 invocation reached `online`; the probe
  observed `park-context TX -1 len1` followed by a matching `park-context RX -1
  len1`, then sent `catalog-native TX -24 len1`.
- No `RX -24` arrived within the bounded five-second wait. Only redacted state
  traffic followed; the catalog decoder did not run.
- Classification: `catalog pending`; the single-ACK ordering candidate did not
  establish catalog/map/area evidence, and no follow-up command was sent.

#### Fresh authorized live attempt 2026-08-25T03:52:31.582Z UTC

- The exact account-2 / map-5 / area-7 invocation reached `online` and passed
  the Park handler barrier (`TX -1 len1` then matching `RX -1 len1`).
- It sent one `catalog-native TX -24 len1`; no `RX -24` arrived during the
  five-second bounded wait. The decoder did not run and no raw packet was
  retained in the output.
- Classification remains `catalog pending`; the fresh run does not establish
  a map/area catalog.

#### Direct-join cross-check 2026-08-25T03:55:02.311Z UTC

- A separate bounded read-only cross-check for the same exact pair sent one
  `TX 80 len2` after the Park handler barrier and received `RX -40 len54`.
- No new `RX -34` enter-world snapshot arrived; the redacted event projection
  contained only a generic dialog signal, with no temporary-login rejection.
- This is not direct-join evidence and does not open the catalog/evidence gate.

#### Fresh catalog retry after account-2 logout 2026-08-25T04:04:51.367Z UTC

- Local Avatar Web health was refused before the invocation; the exact account-2 / map-5 / area-7 probe reached `online` and passed the Park handler barrier.
- The probe sent one `catalog-native TX -24 len1`; no `RX -24` arrived during the bounded five-second wait. The decoder did not run and no body/hex was retained.
- Classification remains `catalog pending`; the logout state did not produce a catalog response, so map 5 / area 7 remains unmapped. No follow-up command was sent by this candidate.

#### Static native boundary after the fresh retry 2026-08-25

- `MapScr.joinCitymap @0x6141B8` first resets map state and loads cached movement data. When `isTour` is false it emits the native pair `GET_HANDLER 9` followed immediately by `REQUEST_CITY_MAP(0)`; when `isTour` is true it reads `ImageMap.getCityMap()` and parses cached `PositionMap` entries without sending `-24`.
- `LoadMap.doJoin @0x8CEB10` classifies tile coordinates and has a separate city branch that calls `REQUEST_CITY_MAP(-1)` (empty body). Its other branches call `requestJoinAny`, park, or farm paths; they are not city-map catalog requests.
- `MapScr.doJoin @0x6217E4` does not consume the CLI pair directly: it reads the selected `PositionMap.idToMap` and calls `doJoinPark(idToMap, -1)`. The minimap action that precedes this sets `idCityMap`/`idSelectedMini` and emits `-23`, but only after a catalog has populated the native UI model.
- Therefore the Node probe has now exercised both statically supported `-24` body forms and the single direct `80[5,7]` join, but it cannot recreate the native `MapScr`/cache state that supplies `PositionMap`. No map/area mapping or NPC evidence is promoted. The next evidence-bearing path is a UI-matched native-client capture (or an already persisted native cache), not another guessed packet.

#### Native callback boundary verified 2026-08-25

- `GlobalLogicHandler.doGetHandler @0x5E4974` is the local receiver for the
  server's `GET_HANDLER` response. In its handler-9 branch it calls
  `ParkMsgHandler.onHandler`; only when the park-handler state remains `-1`
  does it continue to the screen/state checks.
- At `0x5E50BC` the native code excludes the TrucXanh and Caro screens, obtains
  `MapScr.gI()`, and at `0x5E50CC` calls `MapScr.joinCitymap @0x6141B8`.
  `MapScr.joinCitymap` then performs the local reset/cache work and, for
  `isTour == false`, emits the native `GET_HANDLER 9` plus
  `REQUEST_CITY_MAP(0)` pair.
- This makes the effective sequence **server `RX -1[9]` → native local
  `doGetHandler(9)` → `MapScr.joinCitymap()` → native `TX -1[9]` and
  `TX -24[0]`**. The headless Node probe can observe the first response and
  manually write `-24`, but it has no `MapScr` instance, screen guard, park
  handler state, or persisted `ImageMap` cache. Its timeout therefore cannot
  be treated as a failed catalog contract, and repeating the same payload is
  not a new evidence-bearing experiment.

#### Static APK city-map asset (not live account evidence) 2026-08-25

- The bundled `CityMap` TextAsset in the local `AvatarHD_3.4.4_APKPure.apk`
  (APK SHA-256
  `401b17880bacd1270188bdfdbb8a3fa0f1ed6a78b6fd58d28c8780d639979f4e`)
  contains a versioned PNG plus a 188-byte cached `PositionMap` table. The
  extracted table has seven static entries and decodes cleanly with the
  native cache order `id`, `idImg`, `x`, `y`, UTF-8 text, then two native
  bytes. Its SHA-256 is recorded only for reproducibility:
  `e3fc3c1272d6d6f7e2ba100f9e7c408ced3dd496f2b326721b17c719e9d5d4da`.
- The static names/coordinates are: `1 Khu sinh thái (473,100)`, `3 Khu
  giải trí (236,280)`, `4 Khu mua sắm (452,250)`, `5 Công viên (254,82)`,
  `7 Nông trại (524,423)`, `8 Ngoại ô (100,100)`, and `9 Mê cung (57,209)`.
- This is package-bundled version-3.4.4 data, not a packet captured for
  account 2 and not proof that live `map=5, area=7` resolves to either
  static entry. It is retained as a static candidate only; the live catalog
  gate remains closed until a native UI-matched capture or native cache from
  the authorized account is available.

#### Fresh catalog retry after account-2 logout 2026-08-25T04:49:51.112Z UTC

- Local health was refused before the invocation. The exact account-2 /
  map-5 / area-7 run reached `online`, then observed the Park handler
  response before sending one redacted `catalog-native TX -24 len1`.
- No `RX -24` arrived during the bounded five-second wait. The run retained
  only redacted metadata; catalog decoding did not run and no map/area claim
  is made.
- Classification remains `catalog pending`. This fresh logout-state run does
  not change the evidence gate.

#### Native `cmd 80` body correction candidate 2026-08-25

- Direct disassembly of `ParkService.doJoinPark @0x718188` shows
  `writeByte(roomID)`, `writeByte(boardID)`, then two `writeShort` calls.
  The extra shorts read `LoadMap.xJoinCasino` (`static +0x128`) and
  `LoadMap.yJoinCasino` (`static +0x12C`), not avatar HP/MP. The native wire
  shape is therefore six body bytes; the existing two-byte Node join is not
  wire-equivalent.
- For an ordinary park join the two casino-coordinate shorts are a separate
  native state that is not present in the CLI request. Sending zeroes for
  them would be a new live experiment and is not promoted or executed by this
  catalog candidate. A follow-up probe needs a reviewed spec/plan and must
  classify any response independently from the catalog gate.
