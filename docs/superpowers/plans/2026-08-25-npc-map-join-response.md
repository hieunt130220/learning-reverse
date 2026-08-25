# Native NPC Map Join Response Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decode the live native `cmd 80` response for account 2 map 5 / area 7 into verified redacted direct-join evidence.

**Architecture:** Extend the standalone probe with a bounded `RX 80` waiter and a prefix decoder that mirrors the native `GlobalMessageHandler` prefix plus the live non-tour player/drop-part layout. Keep the exact six-byte request and leave unknown trailing bytes explicitly pending; do not alter production park service behavior.

**Tech Stack:** TypeScript, Node.js, `tsx`, existing `GameClient`, `Message`, `MyReader`, and native disassembly evidence.

**Spec:** `docs/superpowers/specs/2026-08-25-npc-map-join-response-design.md`

## Global Constraints

- Exact account 2 / map 5 / area 7; one `cmd 80` payload per invocation.
- Request body remains six bytes: signed room/board followed by big-endian `i16 0,0`.
- No catalog requests, selection, any-join, NPC interaction, retry, or payload sweep.
- Redacted output only; preserve unrelated dirty files; no commit.
- A prefix match is direct-join evidence only; it is not sufficient to create the
  global NPC map catalog.

### Task 1: Decode the native response

**Files:**
- Modify: `avatar-web/server/src/tools/npc-map-probe.ts`

**Interfaces:**
- Consumes: `Message` events, `MyReader`, native response layout, existing phase traffic.
- Produces: bounded `ParkJoinResponseMetadata` and one `RX 80` evidence record.

- [x] **Step 1: Impact checks**
  Run GitNexus upstream impact for `runProbe` and the new decoder helper.

- [x] **Step 2: Implement bounded response waiter/decoder**
  Arm a one-shot `cmd 80` listener before sending the existing raw request;
  decode room, board, x, y, the observed 18-byte player tail, marker, map/
  animation vectors and native `nSpecial`/special records; reject malformed or
  truncated data without printing payload, and retain unknown trailing bytes as
  pending.

- [x] **Step 3: Update success gate/output**
  Require exactly one direct `TX 80 len=6` and one matching `RX 80`; print
  response length, coordinates, bounded prefix counts and trailing bytes only.

- [x] **Step 4: Static verification**
  Run server typecheck, `git diff --check`, and a scan proving there is one
  `sendRaw(80, ...)` and no catalog/selection command in this probe.

### Task 2: Live evidence

**Files:**
- Modify: `docs/superpowers/plans/2026-08-25-npc-map-join-response.md`

- [x] **Step 1: Preflight**
  Confirm no local probe process and local Avatar Web health remains refused.

- [x] **Step 2: Run one invocation**
  Run account 2 / map 5 / area 7 once after the decoder is ready. Several
  attempts were temporary login rejections; after the bounded cooldown, the
  successful run was `2026-08-25T05:50:39.594Z`.

- [x] **Step 3: Classify**
  Mark direct-join observed when response room/board equals request and the
  bounded prefix decodes safely; classify the unknown suffix and catalog/NPC
  evidence as pending.

- [x] **Step 4: Final checks**
  Run GitNexus `detect_changes(scope="all")`, typecheck, and `git diff --check`.

Result: GitNexus reported low risk and no affected execution processes; server
typecheck and `git diff --check` passed. The index does not include the new
standalone helper names, so their impact queries returned `target not found`;
the existing `runProbe` impact remained low.

## Live evidence addendum

The successful redacted run produced exactly one `TX 80 len=6` and one
`RX 80 len=134` after login and Park handler ACK. The decoded prefix was:

| Field | Observed metadata |
| --- | ---: |
| requested map / area | 5 / 7 |
| response room / board | 5 / 7 |
| response coordinates | 0 / 0 |
| player layout | non-tour state18 native list |
| list-player count | 2 |
| list end offset | 109 |
| map marker / animation count | 0 / 0 |
| native special count / section end | 0 / 113 |
| undecoded trailing bytes | 21 |

This is verified direct-join evidence for the requested pair, not a global map
catalog and not NPC-location evidence. Do not create `npcMapCatalog.ts` until
the trailing section or a matching enter-world/NPC packet is independently
decoded and recorded.

## Live evidence addendum 2026-08-25T06:08:54.133Z

A subsequent authorized invocation with the same account/map/area reproduced
the same bounded result after login reached `online` and the Park handler ACK:
one `TX 80 len=6`, one `RX 80 len=134`, response room/board `5/7`,
coordinates `0/0`, two player records, `mapMarker=0`, `animCount=0`,
`specialCount=0`, `specialSectionEnd=113`, and `trailingBytes=21`.
The repetition strengthens direct-join evidence for `5/7`; it does not turn
the ignored native suffix or the empty special list into global catalog/NPC
evidence.

## Rollback

Revert only the response-decoder changes in the standalone probe; preserve all
unrelated worktree changes and redacted evidence notes.
