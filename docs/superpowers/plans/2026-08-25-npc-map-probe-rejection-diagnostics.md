# NPC Map Probe Sanitized Rejection Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the standalone NPC map probe with phase-aware, body-free event metadata so an `RX -40` can be classified as a known temporary rejection, generic dialog, status transition, or socket close.

**Architecture:** Keep all production changes inside `avatar-web/server/src/tools/npc-map-probe.ts`. Reuse existing `GameClient` events and `SessionCloseInfo`, attach listeners before login, capture only enum/numeric metadata under the mutable `ProbePhase`, and remove every listener before the existing logout/database cleanup. Success and failure JSON share the same redacted `traffic` and `events` fields.

**Tech Stack:** TypeScript, Node.js `EventEmitter`, existing `GameClient`/`Session` event contracts, `tsx`, npm server typecheck, GitNexus.

**Spec:** `docs/superpowers/specs/2026-08-25-npc-map-probe-rejection-diagnostics-design.md`

## Global Constraints

- Record only `phase`, `event`, `status`, `retryAfterMs`, `closeKind`, and `hadError`; never read or emit dialog/rejection text, packet body, `entry.hex`, host, port, error message, byte counters, credential, or token.
- Keep exactly one account/session, one `enterParkContext()`, one `joinPark(map, area)`, five-second snapshot timeout, and the existing `finally` cleanup.
- Do not modify `GameClient`, `ParkService`, `AutoFindNpc`, `AvatarSession`, decoder, API/WS/UI, catalog, or evidence files.
- Do not send `-23`, `-21`, interaction commands, range/candidate probes, or automatic retries.
- Do not add tests or test files unless the user separately requests them; run typecheck and static safety checks only.
- Do not create a commit or push; preserve the existing modified earlier plan and untracked `avatar-jar/`.
- Do not run a live probe in this plan without fresh explicit authorization for one exact account/map/area after code verification.

---

### Task 1: Reconfirm impact and define redacted event contracts

**Files:**
- Modify: `avatar-web/server/src/tools/npc-map-probe.ts` (imports and local metadata types only)
- Verify: GitNexus symbol impact

**Interfaces:**
- Consumes: existing `ProbePhase`, `ClientStatus`, `TrafficEntry`, `GameClient`, and `SessionCloseInfo` contracts.
- Produces: `ProbeEventKind` and `ProbeEventMetadata` used by listener capture and JSON output.

- [x] **Step 1: Run pre-edit GitNexus impact checks**

Run each check against repository `learning-reverse`:

```text
gitnexus_impact({ target: "runProbe", direction: "upstream", includeTests: true, maxDepth: 3 })
gitnexus_impact({ target: "captureRelevantTraffic", direction: "upstream", includeTests: true, maxDepth: 3 })
gitnexus_impact({ target: "assertExpectedTraffic", direction: "upstream", includeTests: true, maxDepth: 3 })
```

Expected: LOW risk, direct usage contained in the standalone probe, and no HIGH/CRITICAL warning. Stop and report before editing if that changes.

- [x] **Step 2: Add the exact event metadata types**

Add a type-only import for `SessionCloseKind` from `../proto/session.js` and define these types immediately after `TxRxMetadata`:

```ts
type ProbeEventKind = 'dialog' | 'temporary-rejection' | 'status' | 'closed';

interface ProbeEventMetadata {
  phase: ProbePhase;
  event: ProbeEventKind;
  status?: ClientStatus;
  retryAfterMs?: number;
  closeKind?: SessionCloseKind;
  hadError?: boolean;
}
```

Do not add a `reason`, text, body, hex, host, port, error, timestamp, or byte-count field.

### Task 2: Capture event metadata without payloads

**Files:**
- Modify: `avatar-web/server/src/tools/npc-map-probe.ts` (`runProbe`, `printRedactedEvidence`, failure output, listener cleanup)

**Interfaces:**
- Consumes: `ProbeEventMetadata`, `ProbePhase`, `TemporaryLoginRejection`, `ClientStatus`, and `SessionCloseInfo`.
- Produces: `events: ProbeEventMetadata[]` in both success and failure JSON; listeners removed before logout.

- [x] **Step 1: Thread the event array through the probe entry points**

Change the existing signatures and top-level state without changing CLI validation:

```ts
function printRedactedEvidence(
  args: ProbeArgs,
  snapshot: EnterWorldSnapshot,
  metadata: TxRxMetadata[],
  events: ProbeEventMetadata[],
): void;

async function runProbe(
  args: ProbeArgs,
  metadata: TxRxMetadata[],
  events: ProbeEventMetadata[],
): Promise<void>;

const events: ProbeEventMetadata[] = [];
await runProbe(args, metadata, events);
```

Add `events` beside `traffic` in both JSON paths. Preserve all existing redacted decode/error fields.

- [x] **Step 2: Attach phase-aware listeners before account lookup/login**

Inside `runProbe`, after `phase` and before `getAccountById`, define these callbacks exactly as payload-safe projections:

```ts
const onDialog = (): void => {
  events.push({ phase, event: 'dialog' });
};
const onTemporaryRejection = (value: TemporaryLoginRejection): void => {
  events.push({ phase, event: 'temporary-rejection', retryAfterMs: value.retryAfterMs });
};
const onStatus = (status: ClientStatus): void => {
  events.push({ phase, event: 'status', status });
};
const onClosed = (info: SessionCloseInfo): void => {
  events.push({ phase, event: 'closed', closeKind: info.kind, hadError: info.hadError });
};

client.on('dialog', onDialog);
client.on('temporary-rejection', onTemporaryRejection);
client.on('status', onStatus);
client.session.on('closed', onClosed);
```

The `dialog` callback must not declare or access its text argument. The temporary-rejection callback may read only `retryAfterMs`; the close callback may read only `kind` and `hadError`.

- [x] **Step 3: Preserve phase transitions and remove listeners before cleanup**

Keep `phase = 'login'` before login, set `phase = 'park-context'` immediately before `enterParkContext()`, and set `phase = 'join'` before arming the snapshot wait. In `finally`, remove all four listeners before calling `client.logout()`:

```ts
client.removeListener('dialog', onDialog);
client.removeListener('temporary-rejection', onTemporaryRejection);
client.removeListener('status', onStatus);
client.session.removeListener('closed', onClosed);
abort.abort();
try {
  client.logout();
} finally {
  db.close();
}
```

This prevents the local cleanup close from being recorded as a server-side rejection. Keep the existing traffic listener removal in the same cleanup block.

### Task 3: Verify redaction and compile scope

**Files:**
- Modify: none beyond Task 2
- Verify: `avatar-web/server/src/tools/npc-map-probe.ts`, working-tree diff, GitNexus scope

**Interfaces:**
- Consumes: Task 2 event output and listener cleanup.
- Produces: verified body-free diagnostics ready for an optional authorized live invocation.

- [x] **Step 1: Run typecheck**

Run:

```bash
npm --prefix avatar-web/server run typecheck
```

Expected: exit 0 and no TypeScript diagnostics.

- [x] **Step 2: Scan the event/output path for forbidden data**

Run:

```bash
rg -n "entry\.hex|\.getData\(|body|reason|host|port|error|password|MASTER_KEY|gamePass|cookie|token" avatar-web/server/src/tools/npc-map-probe.ts
```

Review every match. Existing CLI/error control-flow text is allowed only when it is not serialized from packet/event payloads; the new `events` objects must contain no forbidden field or value.

Run the opcode scan:

```bash
rg -n "REQUEST_JOIN_ANY|SELECTED_MINI_MAP|AVATAR_FEEL|COMMUNICATE|MENU_OPTION|-21|-23|-59|-61" avatar-web/server/src/tools/npc-map-probe.ts
```

Expected: no new sends or forbidden opcode references.

- [x] **Step 3: Verify diff and GitNexus scope**

Run:

```bash
git diff --check
```

Then run `gitnexus_detect_changes({ repo: "learning-reverse", scope: "all" })`.

Expected: no whitespace errors, LOW risk, no affected production execution flow, and source changes limited to the standalone probe plus the approved plan/spec documents. Do not commit.

### Task 4: Live authorization gate and handoff

**Files:**
- Verify: `avatar-web/server/src/tools/npc-map-probe.ts`
- Update only if authorized: `docs/superpowers/plans/2026-08-25-npc-map-probe-rejection-diagnostics.md`

**Interfaces:**
- Consumes: verified `traffic` and `events` JSON from Task 3.
- Produces: optional one-run rejection classification; otherwise a code-only handoff with no live side effect.

- [x] **Step 1: Stop and request exact live authorization**

If the user has not supplied a fresh exact `account-id`, `map`, and `area` plus permission for one connection, do not invoke the probe. Report that code verification is ready and ask for the pair; do not infer permission from the earlier run.

#### Code-only verification (2026-08-25)

- Pre-edit GitNexus impact for `runProbe`, `captureRelevantTraffic`, and `assertExpectedTraffic`: LOW; no affected execution processes.
- `npm --prefix avatar-web/server run typecheck`: exit 0.
- Redaction review: the new event projections contain only the approved enum/numeric fields; existing matches for connection/error control flow do not serialize packet/event payloads. Opcode scan produced no output.
- `git diff --check`: exit 0. Post-edit `gitnexus_detect_changes(scope="all")`: risk LOW, affected processes 0.
- No live invocation was run because this plan requires fresh authorization for an exact account/map/area pair.

- [x] **Step 2: If authorized, confirm local server stopped and run exactly once**

First verify no listener on `127.0.0.1:8787`. Then run from `/Users/devios/learning-reverse/avatar-web/server` exactly once with the supplied pair:

```bash
npm exec -- tsx --env-file=.env src/tools/npc-map-probe.ts \
  --account-id <authorized-account-id> \
  --map <authorized-map> \
  --area <authorized-area>
```

Expected output contains only `traffic` fields `{phase, dir, cmd, len}` and `events` fields `{phase, event, status?, retryAfterMs?, closeKind?, hadError?}`. Do not retry if it fails.

- [x] **Step 3: Record classification and preserve the delivery gate**

Record only the redacted classification in this plan:

- `dialog` + `temporary-rejection`: report throttle/concurrent-login signal and `retryAfterMs`.
- `dialog` without `temporary-rejection`: report generic `-40` dialog, mapping remains unproven.
- `closed` before snapshot: report `closeKind`/`hadError` only.
- no additional event: retain timeout conclusion.

Do not create evidence/catalog and do not change protocol commands. If no `join/RX -34` is observed, remain at `protocol investigation pending` and request a new Spec review before any protocol change.

#### Authorized live result (2026-08-25T01:45:12.928Z UTC)

- Preflight passed: local Avatar Web health request was refused, port `8787` had no listener, and no prior probe process remained.
- One invocation ran for `account 2 / map 5 / area 7`; it exited with the redacted snapshot timeout and was not retried.
- Traffic: login reached `RX -34 len=178`; park context sent `TX -1 len=1`; join sent `TX 80 len=2` and received `RX -40 len=54`; no `join/RX -34` arrived.
- Events: login statuses were `connecting`, `handshaking`, `logging-in`, `online`; join emitted `dialog` only. No `temporary-rejection`, `status=error`, or `closed` event was captured before cleanup.
- Classification: generic `-40` dialog, not a recognized throttle/concurrent-login rejection. Map/area mapping remains unproven; no protocol command change, catalog, or evidence file was created.

## Delivery Gate

The task is complete only when the probe compiles, redaction/scope checks pass, and any authorized live result is recorded without packet body or credential leakage. Leave the worktree uncommitted unless the user explicitly asks for a commit.
