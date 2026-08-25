# NPC Map Join Position Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-run the bounded native `cmd 80` probe with CityMap PositionMap coordinates for account 2 / map 5 / area 7.

**Architecture:** Keep the standalone redacted probe and replace only the baseline join shorts with the native CityMap entry coordinates `(254,82)`. Decode the existing RX80 prefix and leave unknown suffix/catalog data gated.

**Tech Stack:** TypeScript, Node.js, `tsx`, existing `GameClient`, `MyReader`, and native APK disassembly.

**Spec:** `docs/superpowers/specs/2026-08-25-npc-map-join-position-design.md`

## Global Constraints

- One authorized invocation only: account 2 / map 5 / area 7.
- Request remains exactly six bytes; only `i16 x/y` changes from `0,0` to `254,82`.
- No retries, range sweep, catalog request, minimap selection, or NPC action.
- Redacted output only; no commit; preserve unrelated worktree changes.
- A successful RX80 is direct-join evidence, not global catalog evidence.

### Task 1: Update bounded probe coordinates

**Files:**
- Modify: `avatar-web/server/src/tools/npc-map-probe.ts`

**Interfaces:**
- Consumes: `runProbe`, existing Park handler barrier and RX80 decoder.
- Produces: six-byte TX80 with native map-5 PositionMap coordinates.

- [x] **Step 1: Impact check**
  `gitnexus_impact({target:"runProbe", direction:"upstream"})` returned LOW;
  only the standalone probe file is a direct dependent.

- [x] **Step 2: Apply coordinate correction**
  Replace the bounded baseline shorts with `i16 254` and `i16 82`, and update
  the redacted evidence field/comment to state the source is static CityMap
  PositionMap map 5.

- [x] **Step 3: Static verification**
  Run `npm --prefix avatar-web/server run typecheck`, `git diff --check`, and
  a scan confirming one `sendRaw(80` and no `-24/-23/-21` in the probe.

### Task 2: Live evidence

**Files:**
- Modify: `docs/superpowers/plans/2026-08-25-npc-map-join-position.md`

- [x] **Step 1: Preflight**
  Confirm local Avatar Web health is refused and no prior probe process runs.

- [x] **Step 2: Run one invocation**
  ```bash
  node --env-file=.env --import tsx src/tools/npc-map-probe.ts \
    --account-id 2 --map 5 --area 7
  ```

- [x] **Step 3: Classify**
  Record only redacted response metadata. If room/board and coordinates match,
  classify the direct join; keep catalog/NPC evidence pending unless the native
  special section and suffix are independently verified.

- [x] **Step 4: Final checks**
  Run GitNexus `detect_changes(scope="all")`, typecheck and `git diff --check`.

## Live evidence addendum 2026-08-25T06:18:02.122Z

The first attempt after the coordinate correction was rejected temporarily at
login (`retryAfterMs=10000`) and sent no join command. After the bounded
backoff, the authorized invocation reached `online` and completed the Park
handler barrier. It emitted exactly one `TX 80 len=6` using
`[5,7,254,82]` and received one `RX 80 len=134`:

| Field | Observed metadata |
| --- | ---: |
| response room / board | 5 / 7 |
| response coordinates | 254 / 82 |
| player layout / count | state18-native-list / 2 |
| map marker / animation count | 0 / 0 |
| native special count / section end | 0 / 113 |
| undecoded trailing bytes | 21 |

This is repeatable direct-join evidence with the native CityMap position for
map 5 / area 7. It is not yet a production NPC catalog entry: the native
special list is empty and the handler leaves a 21-byte suffix unread.

## Rollback

Revert only the coordinate constants/comment in the standalone probe; preserve
the previous `0,0` direct-join evidence and all unrelated dirty files.

## Live evidence addendum 2026-08-25T06:40:44.203Z

After the parser was aligned with the native `readListPlayer` drop-part tail,
the exact account-2 / map-5 / area-7 invocation reached `online`, passed the
Park handler barrier, sent one `TX 80 len=6` with `[5,7,254,82]`, and received
one `RX 80 len=134`:

| Field | Observed metadata |
| --- | ---: |
| response room / board | 5 / 7 |
| response coordinates | 254 / 82 |
| player layout / count | state18-native-list-with-drop-tail / 2 |
| list-player end | 110 |
| map marker / animation count | 0 / 0 |
| native special count / section end | 0 / 114 |
| undecoded trailing bytes | 20 |

The one-byte shift from the prior prefix result was the native drop-part count
after the player vector. This improves RX80 prefix alignment but does not turn
the response into a map/area catalog: the native special list is empty and the
handler leaves the 20-byte suffix unread.

## Decoder verification addendum 2026-08-25T06:46:53.895Z

The redacted decoder now returns `specialNames` while consuming the native
`ItemMapSpecial` layout. A fresh exact `2/5/7` run reproduced the same
`RX 80 len=134` prefix and returned `specialCount=0`, `specialNames=[]`,
`specialSectionEnd=114`, and `trailingBytes=20`. No NPC name or dynamic area
catalog was observed.
