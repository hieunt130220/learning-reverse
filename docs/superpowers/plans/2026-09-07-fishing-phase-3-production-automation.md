# Fishing Phase 3 Protocol Mapping Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the complete RX79 `referenceIndex → TX43 byte` mapping required before production automation can safely encode ML or random decisions.

**Architecture:** Use correlated live packet capture plus native control-flow evidence to establish every supported reference position twice, then record the immutable mapping in the protocol notes and approved Phase 3 spec. Production TypeScript remains untouched until this evidence is complete and the amended spec receives renewed user approval.

**Tech Stack:** Node.js 22 type definitions, TypeScript 5.7, ESM, `node:test`, `node:assert/strict`, `node:crypto.randomInt`, existing binary `Message`/`Session` protocol classes, Python 3.12 fishing inference service, GitNexus MCP/CLI.

**Spec:** `docs/superpowers/specs/2026-09-07-fishing-phase-3-production-automation-design.md`

## Global Constraints

- Implement production code before creating or modifying any Phase 3 test.
- Do not invoke `superpowers:test-driven-development`; repository instructions explicitly prohibit test-first development.
- Use only the frozen run `p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01`.
- Preserve checkpoint SHA-256 `6168b65abaf8ade9008c9611413167f76533d1e80926b2be852df6e7e3a67789`.
- Do not retrain, reselect, recalibrate, or alter the Phase 2 model, data, thresholds, augmentations, or split.
- A complete valid inference result always uses each query’s top-1 `referenceIndex`.
- Never use `accepted`, similarity, margin, confidence, or abstention to choose between ML and fallback.
- Attempt production inference once for every new valid challenge; do not retry the same challenge.
- Production inference must not use, consult, or mutate the shadow circuit breaker or backlog counters.
- Every inference failure produces cryptographic fallback only after a complete valid answer domain has been established.
- Use `node:crypto.randomInt`; never use `Math.random()` for fishing answers.
- Final evaluation and replay are non-blocking evidence and must not be imported into or consulted by the live server path.
- Only exact `process.env.FISHING_AUTO_TX43_ENABLED === 'true'` authorizes automated TX43.
- Read the environment gate immediately before every send; do not cache it.
- No send may occur after Stop, disconnect, teardown, client replacement, stale automation generation, stale challenge generation, duplicate consumption, disabled or indeterminate authorization, or indeterminate answer domain.
- Mark a challenge consumed before calling the synchronous TX43 send.
- Never retry TX43, including after a send throws.
- At most one TX43 may be attempted per admitted challenge.
- Only `ParkService.doFinishFishing()` may construct automated TX43; do not use `sendRaw`.
- Preserve the direction distinction between TX43 (`bool + length + bytes`) and RX43 (`i32 idUser + i16 idFish`).
- Do not persist or emit images, raw packets, answer vectors, predictions, account/player/fish identifiers, model IDs, endpoints, credentials, environment values, stack traces, or arbitrary error messages.
- Run GitNexus upstream impact analysis before modifying every existing symbol. If risk is `HIGH` or `CRITICAL`, stop and warn the user before editing.
- Treat GitNexus `UNKNOWN` as unresolved. Confirm it with exact text search and document the result before editing.
- Run GitNexus `detect_changes({scope:"all"})` before every commit. A partial or truncated result is not acceptable.
- If the protocol evidence task cannot prove a complete `referenceIndex → TX43 byte` mapping for every production reference position, stop implementation. Do not infer, guess, or substitute reference indices as wire bytes.

---

## File Structure

| File | Responsibility |
|---|---|
| `avatar-re/notes/fishing.md` | Record authoritative outgoing TX43 mapping evidence. |
| `docs/superpowers/specs/2026-09-07-fishing-phase-3-production-automation-design.md` | Receive the exact verified mapping and supported reference-count contract. |

### Task 1: Resolve the Protocol Mapping Blocker With Reproducible Evidence

**Files:**
- Modify: `avatar-re/notes/fishing.md:37-54`
- Modify only after evidence is complete: `docs/superpowers/specs/2026-09-07-fishing-phase-3-production-automation-design.md:409-432`
- Inspect: `avatar-re/frida_scripts/parser.ts`
- Inspect: `avatar-web/server/src/tools/fishing-probe.ts`
- Inspect: `docs/superpowers/specs/2026-08-26-auto-fishing-design.md:108-121`

**Interfaces:**
- Consumes: outgoing TX43 body `bool true; i8 length; length × i8 value`, RX79 reference/query image arrays, and native `FishingScr.listKeySend`.
- Produces: a verified immutable ordered mapping `readonly number[]` where array index is RX79 reference position and array value is the exact TX43 byte for that reference position; evidence must also state the supported RX79 reference count or counts.

- [x] **Step 1: Confirm the blocker is still unresolved before collecting evidence**

Run:

```bash
grep -nE "TX43 chưa được giải quyết|50, 52, 54|referenceIndex|listKeySend|setIndex|doFinishFishing" \
  avatar-re/notes/fishing.md \
  docs/superpowers/specs/2026-08-26-auto-fishing-design.md \
  docs/superpowers/specs/2026-09-07-fishing-phase-3-production-automation-design.md
```

Expected:

```text
The Phase 1/2 material identifies observed key values {50, 52, 54} and the TX43 layout,
but explicitly says the complete referenceIndex-to-wire-byte mapping is not established.
```

- [x] **Step 2: Verify tooling decodes RX79 and outgoing TX43 directionally**

Run:

```bash
grep -nE "SCHEMAS_RX|decodeCanCau|decodeFinishFishing|smartDecode" \
  avatar-re/frida_scripts/parser.ts
```

Expected:

```text
RX79 is decoded as reference/query PNG arrays and TX43 is decoded separately as
bool + answer length + answer bytes; RX43 is not reused for TX decoding.
```

- [x] **Step 3: Capture one controlled native-client challenge atomically**

Use an owned test account and the existing packet instrumentation. For one challenge, preserve one correlation record containing:

```text
capture timestamp
RX79 referenceCount
ordered RX79 reference images [0..referenceCount-1]
ordered RX79 query images [0..queryCount-1]
native UI key associated with each displayed reference
outgoing TX43 decoded answer bytes
```

Evidence procedure:

1. Start packet capture before the native client casts.
2. Record exactly one RX79.
3. Record the reference images in wire order without reordering or deduplication.
4. Instrument or observe `FishingScr.arrIndex`, `FishingScr.listKeySend`, and `FishingScr.setIndex`.
5. For each query, deliberately select the reference whose wire position is known.
6. Record the resulting TX43.
7. Decode TX43 with the direction-aware parser.
8. Reject the capture if a second RX79 occurs before TX43, if packet loss occurs, if the UI/reference order cannot be proven, or if the TX43 body is ambiguous.

Expected:

```text
One RX79 and its corresponding TX43 are joined without relying on idFish reuse,
image similarity, timestamps alone, or an assumed numeric relationship.
```

- [x] **Step 4: Prove every reference position independently**

Repeat the controlled challenge until each reference position has been deliberately selected at least twice in separate challenges.

For each reference position `i`, require:

```text
capture A: selected reference position i -> TX43 byte v
capture B: selected reference position i -> TX43 byte v
```

If RX79 can contain more than one reference count, repeat for every observed count and establish whether the mapping is count-independent.

Expected:

```text
Every supported reference position has at least two concordant observations.
No position has conflicting TX43 values, and no production reference count remains unmapped.
```

- [x] **Step 5: Cross-check the dynamic evidence against native control flow**

Run the existing IL2CPP/native analysis around:

```text
ParkService.doFinishFishing
FishingScr.setIndex
FishingScr.arrIndex
FishingScr.listKeySend
FishingScr.checkSendArrIndex
```

Required proof:

```text
The byte appended to listKeySend after selecting reference position i is the same byte
observed at the corresponding TX43 answer position.
```

Expected:

```text
Static control flow and live packet evidence agree for every mapped reference position.
```

- [x] **Step 6: Apply the blocker decision**

If any mapping entry, supported reference count, or ordering rule is unresolved:

```text
STOP. Do not modify production TypeScript. Do not enable FISHING_AUTO_TX43_ENABLED.
Report suppressed_invalid_domain as the only safe prospective outcome.
```

If complete:

1. Add a table to `avatar-re/notes/fishing.md` with columns:
   `reference position`, `TX43 byte`, `capture IDs`, `native evidence`.
2. Update spec section 6.3 with the exact verified array literal.
3. Re-review the amended spec with the user before production implementation continues.
4. After approval, write a separate production implementation plan containing the exact verified array literal.

Expected:

```text
The repository contains an exact, reviewable mapping backed by two live observations
per position and native control-flow evidence. No mapping value was inferred.
```

- [x] **Step 7: Analyze graph changes before committing evidence**

Run:

```text
mcp__gitnexus__detect_changes({
  repo: "learning-reverse",
  scope: "all",
  base_ref: ""
})
```

Expected:

```text
The report is complete, not partial or truncated, and identifies documentation-only changes.
```

- [x] **Step 8: Commit the verified evidence**

```bash
git add avatar-re/notes/fishing.md \
  docs/superpowers/specs/2026-09-07-fishing-phase-3-production-automation-design.md
git commit -m "docs(fishing): verify TX43 answer mapping

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

Expected:

```text
One documentation commit records the complete evidence and amended approved contract.
```

## Completion Gate

This plan is complete only when every supported reference position has two concordant live observations and matching native control-flow evidence. If any entry remains unresolved, stop with production automation disabled.

After the mapping is recorded, the amended Spec must be reviewed by the user. Only after approval may a second no-placeholder implementation plan be written for inference, decision, TX43, `GameClient`, `AvatarSession`, post-production tests, verification, and rollout.

