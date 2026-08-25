# NPC Map Probe Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the guarded NPC map probe phase-aware so login and join snapshots/traffic are observable without exposing packet bodies or credentials.

**Architecture:** Keep the change inside the standalone CLI probe. Attach one redacted metadata listener before login, switch a local `ProbePhase` at the three protocol boundaries, assert counts per phase, and retain the existing one-session/one-join cleanup flow. No `GameClient`, Find NPC runner, API, UI, catalog, or alternate map command changes are included.

**Tech Stack:** TypeScript, Node.js `EventEmitter`, existing `GameClient`/`TrafficEntry`, `tsx`, npm server typecheck, GitNexus.

**Spec:** `docs/superpowers/specs/2026-08-25-npc-map-probe-diagnostics-design.md`

## Global Constraints

- Store and print only `{ phase, dir, cmd, len }`; never read or emit packet body, `entry.hex`, password, `MASTER_KEY`, cookie, or token.
- Use exactly one account session, one `enterParkContext()`, one `joinPark(map, area)`, five-second snapshot timeout, and `finally` cleanup.
- Do not add range/retry/candidate generation and do not send `-23`, `-21`, NPC interaction, combat, or reward commands.
- Do not modify `GameClient`, `AutoFindNpc`, `SessionManager`, API/WS/UI, or production catalog/evidence files.
- Do not create test files because the user did not request tests; run typecheck and static safety verification after production code.
- Do not create a git commit without explicit user instruction; preserve the existing untracked `avatar-jar/` and the earlier plan notes.
- The post-implementation live invocation is limited to the already authorized `account 2 / map 2 / area 6` pair and one invocation.

---

### Task 1: Add phase-aware redacted traffic capture

**Files:**
- Modify: `avatar-web/server/src/tools/npc-map-probe.ts` (`TxRxMetadata`, `captureRelevantTraffic`, `assertExpectedTraffic`, `runProbe`, `printRedactedEvidence`)

**Interfaces:**
- Consumes: existing `TrafficEntry`, `GameClient`, `waitForWorldSnapshot`, `loginWithTimeout`, `waitUntilOnline`, and `RedactedProbeError`.
- Produces: `ProbePhase = 'login' | 'park-context' | 'join'`; `TxRxMetadata { phase, dir, cmd, len }`; phase-aware redacted success/failure output.

- [x] **Step 1: Reconfirm the pre-edit blast radius**

Run the required GitNexus checks before touching any source symbol:

```text
gitnexus_impact({ target: "runProbe", direction: "upstream", includeTests: true, maxDepth: 3 })
gitnexus_impact({ target: "captureRelevantTraffic", direction: "upstream", includeTests: true, maxDepth: 3 })
gitnexus_impact({ target: "assertExpectedTraffic", direction: "upstream", includeTests: true, maxDepth: 3 })
gitnexus_impact({ target: "waitForDecodedSnapshot", direction: "upstream", includeTests: true, maxDepth: 3 })
```

Expected: LOW risk; only `npc-map-probe.ts` callers and the Tools module are affected; no d=1 production consumer outside the CLI needs changes.

- [x] **Step 2: Define the phase and metadata contracts**

Replace the current metadata interface with the exact phase-tagged contract:

```ts
type ProbePhase = 'login' | 'park-context' | 'join';

interface TxRxMetadata {
  phase: ProbePhase;
  dir: 'TX' | 'RX';
  cmd: number;
  len: number;
}
```

Keep `ProbeArgs` and all CLI validation unchanged.

- [x] **Step 3: Capture every command without packet bodies**

Replace the current relevance filter with a phase-aware metadata capture helper (`captureRelevantTraffic`):

```ts
function captureRelevantTraffic(
  metadata: TxRxMetadata[],
  phase: ProbePhase,
  entry: TrafficEntry,
): void {
  metadata.push({
    phase,
    dir: entry.dir === 'tx' ? 'TX' : 'RX',
    cmd: entry.cmd,
    len: entry.len,
  });
}
```

The helper must not access `entry.hex`, `entry` body data, or any DB/config field. Keep the existing `TrafficEntry` listener attached to the same `GameClient` instance.

- [x] **Step 4: Move listener registration before login and switch phases at protocol boundaries**

Use one mutable local phase in `runProbe` and preserve the exact one-session flow:

```ts
let phase: ProbePhase = 'login';
const onTraffic = (entry: TrafficEntry): void => captureRelevantTraffic(metadata, phase, entry);
client.on('traffic', onTraffic);
try {
  await loginWithTimeout(client, loginOptions, 12_000);
  await waitUntilOnline(client, 10_000);

  phase = 'park-context';
  client.enterParkContext();
  await sleep(2_000);

  phase = 'join';
  const pending = waitForDecodedSnapshot(client, abort.signal, 5_000);
  client.joinPark(args.map, args.area);
  const snapshot = await pending;
  // retain strict playerId/decode checks here
} finally {
  abort.abort();
  client.removeListener('traffic', onTraffic);
  client.logout();
  db.close();
}
```

Keep `client.logout()` and database close guarded exactly as the current `finally` block is; the snippet shows phase ordering only. Do not arm the join snapshot wait before `phase = 'join'`, and do not reuse the login snapshot as join evidence.

- [x] **Step 5: Assert phase-specific traffic and expose it in redacted output**

Implement `assertExpectedTraffic(metadata)` with phase-scoped counts:

```ts
const count = (phase: ProbePhase, dir: 'TX' | 'RX', cmd: number): number => (
  metadata.filter((entry) => (
    entry.phase === phase && entry.dir === dir && entry.cmd === cmd
  )).length
);

if (count('login', 'RX', -34) !== 1
  || count('park-context', 'TX', -1) !== 1
  || count('join', 'TX', 80) !== 1
  || count('join', 'RX', -34) !== 1) {
  throw new RedactedProbeError('traffic', 'traffic phase không khớp login/context/join contract');
}
```

Include the full `metadata` array in both success and failure JSON. The only packet fields printed are `phase`, `dir`, `cmd`, and `len`; preserve the existing decode fields and redacted error section/offset/message.

- [x] **Step 6: Run the production typecheck**

Run:

```bash
npm --prefix avatar-web/server run typecheck
```

Expected: TypeScript exits 0 with no diagnostics. Do not run a live probe until Tasks 1–5 compile.

### Task 2: Static safety and scope verification

**Files:**
- Modify: none
- Verify: `avatar-web/server/src/tools/npc-map-probe.ts`, working-tree diff

**Interfaces:**
- Consumes: Task 1 phase-aware probe source and the repository GitNexus index.
- Produces: verified redaction/scope evidence ready for one authorized live invocation.

- [x] **Step 1: Confirm the source never exposes sensitive packet content**

Run:

```bash
rg -n "entry\\.hex|\\.getData\\(|body|MASTER_KEY|gamePass|password|cookie|token" \\
  avatar-web/server/src/tools/npc-map-probe.ts
```

Expected: no output from the probe source. `readGamePass` may remain in the login input path only if it is not logged or serialized; any matching output/JSON field must be removed before continuing.

- [x] **Step 2: Confirm no unapproved protocol sends were introduced**

Run:

```bash
rg -n "REQUEST_JOIN_ANY|SELECTED_MINI_MAP|AVATAR_FEEL|COMMUNICATE|MENU_OPTION|-21|-23|-59|-61" \\
  avatar-web/server/src/tools/npc-map-probe.ts
```

Expected: no output. The only client send calls remain `enterParkContext`, `joinPark`, login internals, and cleanup logout.

- [x] **Step 3: Verify whitespace and GitNexus scope**

Run:

```bash
git diff --check
gitnexus_detect_changes({ repo: "learning-reverse", scope: "all" })
```

Expected: no whitespace errors; only `npc-map-probe.ts` and the diagnostic spec/plan are changed; risk remains LOW and no unrelated execution flow is affected.

### Task 3: Run one authorized diagnostic probe

**Files:**
- Verify: `avatar-web/server/src/tools/npc-map-probe.ts`
- Update: `docs/superpowers/plans/2026-08-25-npc-map-probe-diagnostics.md` with the observed redacted result

**Interfaces:**
- Consumes: Task 1 phase-aware CLI and Task 2 safety verification.
- Produces: one redacted phase traffic report for account `2`, map `2`, area `6`; no catalog/evidence production entry.

- [x] **Step 1: Confirm the local Avatar Web server is stopped**

Run:

```bash
curl -sS -m 1 -D - http://127.0.0.1:8787/api/auth/me -o /tmp/avatar-web-health.diagnostic.out || true
lsof -nP -iTCP:8787 -sTCP:LISTEN || true
```

Expected: connection refused/no listener. If the server responds, stop and report the precondition failure; do not start or stop another process automatically.

- [x] **Step 2: Run the exact one-pair diagnostic invocation**

Run from `/Users/devios/learning-reverse/avatar-web/server`:

```bash
npm exec -- tsx --env-file=.env src/tools/npc-map-probe.ts \\
  --account-id 2 --map 2 --area 6
```

Expected success JSON contains phase-tagged metadata with exactly one `login/RX/-34`, one `park-context/TX/-1`, one `join/TX/80`, one `join/RX/-34`, strict decode `ok`, `playerId > 0`, and reviewed trailing-byte state. Expected failure JSON still contains only redacted phase metadata and does not retry.

- [x] **Step 3: Record the result without creating a catalog**

Append the UTC result, phase metadata summary, decode status, and redacted failure section to `docs/superpowers/plans/2026-08-25-npc-map-probe-diagnostics.md`. Do not create `docs/protocol/npc-map-probe-evidence-2026-08-24.md` or `avatar-web/server/src/game/npcMapCatalog.ts` in this task; those remain gated on a separately reviewed successful mapping probe.

#### Live result (2026-08-25T01:20:30.899Z UTC)

- Preflight passed: `127.0.0.1:8787` refused the health request and no local listener was present.
- Invocation: `account 2 / map 2 / area 6`, one run from `avatar-web/server`.
- The probe failed without retrying while waiting for the join snapshot: `decode=error`, `section=snapshot`, `offset=-1`, message `hết giờ chờ gói enter-world (-34)`.
- Redacted phase metadata observed:
  - `login`: `RX -34 len=178` appeared exactly once; the listener also captured the other login command metadata.
  - `park-context`: `TX -1 len=1` appeared exactly once, followed by only metadata-only RX entries (`-87`, `-36`, `-94`, `-1`, `-57`).
  - `join`: `TX 80 len=2` appeared exactly once; the only RX entry before timeout was `-40 len=54`, with no `join/RX -34`.
- No packet body, hex, credential, token, or catalog/evidence file was emitted or created. This run does not prove a new join enter-world mapping.

## Delivery Gate

After Task 3, report whether the phase-aware probe proved a new `join/RX -34`. If it did not, stop at `protocol investigation pending` and request a Spec review before changing protocol commands or catalog behavior. Leave the working tree uncommitted unless the user explicitly asks for a commit.
