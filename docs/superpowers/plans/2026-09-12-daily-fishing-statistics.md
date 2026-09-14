# Daily Fishing Statistics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist and display each account's current-day Auto Fishing catch totals and species breakdown using the `Asia/Ho_Chi_Minh` calendar day without changing server/web `FishingRuntimeState` or web `AutomationSnapshot`.

**Architecture:** Add a SQLite aggregate repository and expose its DTO as optional top-level `AutomationSnapshot.dailyFishingStatistics` on the MEDIUM-impact server contract. Persist catches through the LOW-impact `AvatarSessionOptions` callback, keep statistics separate from fishing runtime, overlay database truth in `SessionManager`, and consume the extra JSON field through a local optional intersection/narrowing helper in `FishingPanel` so the CRITICAL web snapshot type stays untouched.

**Tech Stack:** TypeScript 5.7, Node.js, better-sqlite3, SQLite, Express, React 18, Vite

**Spec:** `docs/superpowers/specs/2026-09-12-daily-fishing-statistics-design.md`

## Global Constraints

- Statistics are per `(account_id, local_date, fish_id)` and expose only the current date in `Asia/Ho_Chi_Minh`.
- Count only a current-epoch `fishing-success-result` while desired mode is `auto_fishing`, with `idUser === client.playerId` and integer `idFish >= 0`.
- Use the same finite `caughtAt` timestamp for `local_date` and `updated_at`; derive the date with `Intl.DateTimeFormat.formatToParts` rather than host, database, or browser timezone.
- Increment with one SQLite `INSERT ... ON CONFLICT ... DO UPDATE`; never persist `current + 1` from JavaScript.
- Reject IDs/counts/timestamps that violate the DTO or safe-integer contract.
- Sort `bySpecies` by `count DESC`, then `fishId ASC`; resolve names from server `FISH_NAMES`, with `Cá ID <id>` as fallback.
- Empty statistics contain today's date, timezone `Asia/Ho_Chi_Minh`, `totalCatches: 0`, `bySpecies: []`, and `updatedAt: null`.
- `dailyFishingStatistics` is top-level snapshot data, separate from `fishingRuntime`.
- **Forbidden edits:** server `FishingRuntimeState`, server `idleFishingRuntime`, web `FishingRuntimeState`, web `AutomationSnapshot`, and all of `avatar-web/web/src/types.ts`.
- Do not change the meaning or update behavior of `FishingRuntimeState.totalCatches`; the daily UI reads only `dailyFishingStatistics.totalCatches`.
- A failed statistics write leaves the last successful daily DTO unchanged, preserves live catch information, reports `lastError`/warning, emits a snapshot, and continues automation.
- A failed statistics read from GET returns HTTP 500; web background refresh keeps the last successful snapshot.
- Do not use `avatar_runtime_snapshot_cache`, duplicate persisted name mapping in web, add an endpoint, backfill catches, alter protocol/ML/Auto Fishing behavior, or create/modify test files.
- Verification is limited to text search, server typecheck/build, web build, database/API/WebSocket inspection, and manual desktop/mobile checks.
- GitNexus is stale and index refresh is known to fail. Every pre-edit gate must warn that graph results are stale, run impact anyway, and validate current definitions/callers/object literals with the exact text searches in that task.
- If impact now reports HIGH/CRITICAL for a planned symbol, or current-tree text search implies a forbidden edit, stop and redesign. Never use stale/UNKNOWN graph output as an all-clear.
- Before each commit, run `detect_changes({scope: "all"})`; if partial/truncated/stale, report it as unresolved and supplement with `git diff --check`, `git diff --name-only`, and the task's current-tree searches. A commit still requires reviewer acceptance of the stale-index warning.

---

### Task 1: Add the Server Additive Snapshot Contract

**Files:**
- Modify: `avatar-web/server/src/session/automationTypes.ts:68-168`

**Interfaces:**
- Consumes: existing server `AutomationSnapshot` and `getFishName(id: number): string`.
- Produces: `DailyFishingSpeciesCount`, `DailyFishingStatistics`, and optional top-level `AutomationSnapshot.dailyFishingStatistics` for Tasks 2–4.

- [x] **Step 1: Run the stale-index impact and current-tree boundary gate**

Run upstream impact for server `AutomationSnapshot`, report the stale-index warning, callers/processes/risk, and confirm its known MEDIUM classification. Then run:

```bash
rg -n "interface (AutomationSnapshot|FishingRuntimeState)|idleFishingRuntime|dailyFishingStatistics" \
  avatar-web/server/src avatar-web/web/src
rg -n "AutomationSnapshot" avatar-web/server/src --glob '*.ts'
```

Expected: server `AutomationSnapshot` is the only planned existing contract edit; server/web `FishingRuntimeState`, `idleFishingRuntime`, web `AutomationSnapshot`, and web `types.ts` are identified as forbidden and remain unchanged.

- [x] **Step 2: Add the exact DTOs and one optional server snapshot field**

Insert before server `AutomationSnapshot`:

```ts
export interface DailyFishingSpeciesCount {
  fishId: number;
  fishName: string;
  count: number;
}

export interface DailyFishingStatistics {
  date: string;
  timezone: 'Asia/Ho_Chi_Minh';
  totalCatches: number;
  bySpecies: DailyFishingSpeciesCount[];
  updatedAt: number | null;
}
```

Add only this field to server `AutomationSnapshot`:

```ts
dailyFishingStatistics?: DailyFishingStatistics;
```

Do not edit any line inside `FishingRuntimeState` or `idleFishingRuntime`.

- [x] **Step 3: Validate the additive boundary and compile**

Run:

```bash
rg -n -A12 "interface FishingRuntimeState" avatar-web/server/src/session/automationTypes.ts
rg -n -A12 "interface AutomationSnapshot" avatar-web/server/src/session/automationTypes.ts
npm --prefix avatar-web/server run typecheck
```

Expected: runtime shape is unchanged, the new field is top-level and optional, and typecheck exits 0.

- [x] **Step 4: Analyze graph changes and commit**

Run `detect_changes({scope: "all"})`, preserve its stale warning, and apply the global supplemental diff/text checks if it is not complete/current.

```bash
git diff --check
git diff --name-only
git add avatar-web/server/src/session/automationTypes.ts
git commit -m "feat(fishing): add daily statistics snapshot contract" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

Expected: only the server snapshot contract from this task is staged; no forbidden type is edited.

### Task 2: Persist Daily Species Aggregates

**Files:**
- Modify: `avatar-web/server/src/db/schema.sql:102-130`
- Create: `avatar-web/server/src/accounts/fishingStatisticsRepo.ts`

**Interfaces:**
- Consumes: `Db` from `../db/index.js`, `getFishName`, and `DailyFishingStatistics` from `../session/automationTypes.js`.
- Produces: `FISHING_TIMEZONE`, `toVietnamDateKey(timestampMs: number): string`, `emptyDailyFishingStatistics(timestampMs?: number): DailyFishingStatistics`, and `FishingStatisticsRepository` methods `recordCatch(accountId, fishId, caughtAt)` and `readToday(accountId, now?)`.

- [x] **Step 1: Run stale-index schema impact and inspect current repository conventions**

Run upstream impact for `avatar-web/server/src/db/schema.sql` as a file target, report staleness/risk, and note that the new `fishingStatisticsRepo.ts` module has no existing symbol to analyze before creation. Validate its integration boundary from current repository conventions with these exact searches:

```bash
rg -n "schema\.sql|openDb|type Db" avatar-web/server/src
rg -n "class .*Repository|prepare<|transaction\(" avatar-web/server/src/accounts --glob '*.ts'
```

Expected: schema loading and current better-sqlite3 repository conventions are confirmed from current files. `openDb` is not an edit target and its impact is not used to waive or characterize the risk of the schema or new module. Stop on HIGH/CRITICAL impact for an actual existing symbol or file target that this task edits when the change cannot be isolated to a lower-risk narrower boundary.

- [x] **Step 2: Add the idempotent aggregate table and index**

Append:

```sql
CREATE TABLE IF NOT EXISTS avatar_daily_fishing_statistics (
  account_id INTEGER NOT NULL REFERENCES avatar_accounts(id) ON DELETE CASCADE,
  local_date TEXT NOT NULL,
  fish_id INTEGER NOT NULL CHECK (fish_id >= 0),
  catch_count INTEGER NOT NULL CHECK (catch_count >= 1),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (account_id, local_date, fish_id),
  CHECK (local_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
);

CREATE INDEX IF NOT EXISTS idx_avatar_daily_fishing_account_date
  ON avatar_daily_fishing_statistics(account_id, local_date);
```

- [x] **Step 3: Implement strict Vietnam date conversion and empty DTO**

Create the repository module with:

```ts
import type { Db } from '../db/index.js';
import {
  getFishName,
  type DailyFishingStatistics,
} from '../session/automationTypes.js';

export const FISHING_TIMEZONE = 'Asia/Ho_Chi_Minh' as const;
const DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: FISHING_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function toVietnamDateKey(timestampMs: number): string {
  if (!Number.isFinite(timestampMs)) {
    throw new Error('timestamp thống kê câu cá không hữu hạn');
  }
  const values = Object.fromEntries(
    DATE_FORMATTER.formatToParts(new Date(timestampMs)).map((part) => [part.type, part.value]),
  );
  const date = `${values.year}-${values.month}-${values.day}`;
  if (!DATE_KEY.test(date)) {
    throw new Error('không thể xác định ngày câu cá theo giờ Việt Nam');
  }
  return date;
}

export function emptyDailyFishingStatistics(now = Date.now()): DailyFishingStatistics {
  return {
    date: toVietnamDateKey(now),
    timezone: FISHING_TIMEZONE,
    totalCatches: 0,
    bySpecies: [],
    updatedAt: null,
  };
}
```

No host-local fallback is allowed.

- [x] **Step 4: Implement strict aggregate mapping**

Add the complete row mapping and read methods:

```ts
interface FishingCountRow {
  fish_id: number;
  catch_count: number;
  updated_at: number;
}

function requireSafeInteger(value: number, label: string, minimum = 0): number {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${label} nằm ngoài giới hạn số nguyên an toàn`);
  }
  return value;
}

export class FishingStatisticsRepository {
  constructor(private readonly db: Db) {}

  private readDate(accountId: number, date: string): DailyFishingStatistics {
    requireSafeInteger(accountId, 'accountId', 1);
    if (!DATE_KEY.test(date)) throw new Error('ngày thống kê câu cá không hợp lệ');
    const rows = this.db.prepare<[number, string], FishingCountRow>(`
      SELECT fish_id, catch_count, updated_at
      FROM avatar_daily_fishing_statistics
      WHERE account_id = ? AND local_date = ?
      ORDER BY catch_count DESC, fish_id ASC
    `).all(accountId, date);
    let totalCatches = 0;
    let updatedAt: number | null = null;
    const bySpecies = rows.map((row) => {
      const fishId = requireSafeInteger(row.fish_id, 'fishId');
      const count = requireSafeInteger(row.catch_count, 'catchCount', 1);
      const rowUpdatedAt = requireSafeInteger(row.updated_at, 'updatedAt');
      if (totalCatches > Number.MAX_SAFE_INTEGER - count) {
        throw new Error('tổng lượt câu vượt giới hạn số nguyên an toàn');
      }
      totalCatches += count;
      updatedAt = Math.max(updatedAt ?? 0, rowUpdatedAt);
      return { fishId, fishName: getFishName(fishId), count };
    });
    return { date, timezone: FISHING_TIMEZONE, totalCatches, bySpecies, updatedAt };
  }

  readToday(accountId: number, now = Date.now()): DailyFishingStatistics {
    return this.readDate(accountId, toVietnamDateKey(now));
  }
```

- [x] **Step 5: Implement atomic catch persistence**

Add the atomic write method to `FishingStatisticsRepository`:

```ts
recordCatch(accountId: number, fishId: number, caughtAt: number): DailyFishingStatistics {
  requireSafeInteger(accountId, 'accountId', 1);
  requireSafeInteger(fishId, 'fishId');
  if (!Number.isFinite(caughtAt)) {
    throw new Error('timestamp thống kê câu cá không hữu hạn');
  }
  const date = toVietnamDateKey(caughtAt);
  return this.db.transaction(() => {
    const current = this.readDate(accountId, date);
    if (current.totalCatches === Number.MAX_SAFE_INTEGER) {
      throw new Error('tổng lượt câu vượt giới hạn số nguyên an toàn');
    }
    const result = this.db.prepare<[number, string, number, number]>(`
      INSERT INTO avatar_daily_fishing_statistics (
        account_id, local_date, fish_id, catch_count, updated_at
      ) VALUES (?, ?, ?, 1, ?)
      ON CONFLICT(account_id, local_date, fish_id) DO UPDATE SET
        catch_count = catch_count + 1,
        updated_at = excluded.updated_at
      WHERE catch_count < 9007199254740991
    `).run(accountId, date, fishId, caughtAt);
    if (result.changes !== 1) {
      throw new Error('không thể tăng thống kê câu cá an toàn');
    }
    return this.readDate(accountId, date);
  })();
}
}
```

The JavaScript aggregate read is only an overflow guard; the persisted increment remains entirely inside the SQLite upsert.

- [x] **Step 6: Verify persistence compilation and schema copying**

Run:

```bash
npm --prefix avatar-web/server run typecheck
npm --prefix avatar-web/server run build
rg -n "avatar_daily_fishing_statistics" avatar-web/server/src/db/schema.sql avatar-web/server/dist/db/schema.sql
```

Expected: both commands exit 0 and source/build schema contain the table.

- [x] **Step 7: Analyze graph changes and commit**

Run `detect_changes({scope: "all"})` and global stale-index supplemental checks.

```bash
git diff --check
git diff --name-only
git add avatar-web/server/src/db/schema.sql avatar-web/server/src/accounts/fishingStatisticsRepo.ts
git commit -m "feat(fishing): persist daily catch statistics" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

### Task 3: Persist Catches Without Editing Fishing Runtime Contracts

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts:177-202`
- Modify: `avatar-web/server/src/session/avatarSession.ts:743-753`
- Modify: `avatar-web/server/src/session/avatarSession.ts:1076-1095`

**Interfaces:**
- Consumes: `DailyFishingStatistics`, `emptyDailyFishingStatistics`, optional `AvatarSessionOptions.initialDailyFishingStatistics`, and optional `AvatarSessionOptions.onFishingCatch(fishId, caughtAt)`.
- Produces: a private daily-statistics field initialized from persisted data and live `automationSnapshot()` payload with top-level `dailyFishingStatistics`; `FishingRuntimeState` stays unchanged.

- [x] **Step 1: Gate the LOW-impact options and session edits with stale-index plus text search**

Run upstream impact for `AvatarSessionOptions`, `AvatarSession.automationSnapshot`, and `AvatarSession`, report staleness and risk. The approved fresh analysis classified `AvatarSessionOptions` LOW; because the available graph is stale, record any divergent stale result rather than treating it as authoritative. Stop if a refreshed/current analysis later raises it to HIGH/CRITICAL. Run:

```bash
rg -n "interface AvatarSessionOptions|new AvatarSession|createSession\?|automationSnapshot\(\)|fishing-success-result" \
  avatar-web/server/src --glob '*.ts'
rg -n "FishingRuntimeState|idleFishingRuntime" avatar-web/server/src/session/avatarSession.ts \
  avatar-web/server/src/session/automationTypes.ts
```

Expected: all option constructors and the exact catch/snapshot paths are enumerated; no runtime contract edit is needed.

- [x] **Step 2: Add only the catch persistence option and separate session state**

Add to `AvatarSessionOptions`:

```ts
initialDailyFishingStatistics?: DailyFishingStatistics;
onFishingCatch?: (
  fishId: number,
  caughtAt: number,
) => DailyFishingStatistics;
```

Declare a private field separately from `fishingRuntime`:

```ts
private dailyFishingStatistics: DailyFishingStatistics;
```

Initialize it in the constructor without touching runtime initialization:

```ts
this.dailyFishingStatistics = opts.initialDailyFishingStatistics
  ?? emptyDailyFishingStatistics(this.now());
```

Import the DTO/helper from the prior tasks. The initial option is optional only for existing non-production harnesses; production `SessionManager` passes it. Do not add any property to `FishingRuntimeState` and do not change `idleFishingRuntime()`.

- [x] **Step 3: Publish the separate field at the additive snapshot boundary**

Add one sibling property to `automationSnapshot()`:

```ts
return {
  desiredMode: this.desiredMode,
  activeMode: this.activeMode,
  transitionState: this.transitionState,
  findNpcConfig: this.findNpcConfig,
  findNpcRuntime: this.findNpcRuntime,
  fishingConfig: this.fishingConfig,
  fishingRuntime: this.fishingRuntime,
  dailyFishingStatistics: this.dailyFishingStatistics,
  location: this.automationLocation,
};
```

- [x] **Step 4: Replace only the persistence-related valid-catch sequence**

Keep current epoch/mode/player guards and existing negative-ID branch. For a valid catch, call `this.now()` once, preserve live fish/status behavior, then persist and replace only the separate DTO:

```ts
const fishName = getFishName(ev.idFish);
const caughtAt = this.now();
this.fishingRuntime.totalCatches += 1;
this.fishingRuntime.lastFishId = ev.idFish;
this.fishingRuntime.lastFishName = fishName;
this.fishingRuntime.status = 'caught';
try {
  if (!this.opts.onFishingCatch) {
    throw new Error('repository thống kê chưa được cấu hình');
  }
  this.dailyFishingStatistics = this.opts.onFishingCatch(ev.idFish, caughtAt);
  this.fishingRuntime.lastError = null;
  this.pushLog(
    `[câu cá] bắt được ${fishName} (ID ${ev.idFish})! (Hôm nay: ${this.dailyFishingStatistics.totalCatches})`,
  );
} catch (error) {
  const message = `Đã bắt ${fishName} nhưng không ghi được thống kê: ${(error as Error).message}`;
  this.fishingRuntime.lastError = message;
  this.pushLog(`[câu cá] ${message}`);
}
this.emitAutomation();
```

The existing process-live counter remains process-live and is not used as the daily source of truth. A persistence failure does not roll back the already-observed live catch.

- [x] **Step 5: Verify forbidden contracts and compile**

Run:

```bash
rg -n -A12 "interface FishingRuntimeState" avatar-web/server/src/session/automationTypes.ts
rg -n "dailyFishingStatistics|onFishingCatch|fishing-success-result" avatar-web/server/src/session/avatarSession.ts
npm --prefix avatar-web/server run typecheck
```

Expected: runtime interface/helper are unchanged; separate state, callback, and sibling snapshot field compile without test edits.

- [x] **Step 6: Analyze graph changes and commit**

Run `detect_changes({scope: "all"})` and global supplemental checks.

```bash
git diff --check
git diff --name-only
git add avatar-web/server/src/session/avatarSession.ts
git commit -m "feat(fishing): persist successful session catches" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

### Task 4: Overlay Database Truth on API and Full Snapshots

**Files:**
- Modify: `avatar-web/server/src/session/manager.ts:1-49`
- Modify: `avatar-web/server/src/session/manager.ts:111-152`
- Modify: `avatar-web/server/src/session/manager.ts:249-326`
- Modify: `avatar-web/server/src/session/routes.ts:196-198`

**Interfaces:**
- Consumes: `FishingStatisticsRepository.readToday()`/`recordCatch()` and top-level optional `AutomationSnapshot.dailyFishingStatistics`.
- Produces: `SessionManager.snapshot(accountId)` and `automationSnapshot(accountId)` whose production responses always overlay current DB statistics for online/offline accounts; `AvatarSessionOptions.onFishingCatch` is bound to account ID.

- [x] **Step 1: Run stale-index impact and enumerate every manager/route caller**

Run upstream impact for `SessionManager.snapshot`, `SessionManager.automationSnapshot`, `SessionManager.getOrCreate`, and `sessionRouter`; report staleness/risk. Run:

```bash
rg -n "sessions\.(snapshot|automationSnapshot)\(|\.automationSnapshot\(accountId|offlineAutomationSnapshot\(" \
  avatar-web/server/src --glob '*.ts'
rg -n "router\.get\('/:id/automation'|new SessionManager|SessionManagerDeps" \
  avatar-web/server/src --glob '*.ts'
```

Expected: REST, WS subscription, session construction, and offline paths are enumerated. No edit to `offlineAutomationSnapshot` or fishing runtime contracts is required.

- [x] **Step 2: Own one statistics repository and bind the persistence callback**

Add optional dependency injection and private ownership:

```ts
fishingStatisticsRepository?: FishingStatisticsRepository;
```

```ts
private readonly fishingStatisticsRepository: FishingStatisticsRepository;
```

Initialize it in the constructor:

```ts
this.fishingStatisticsRepository = deps.fishingStatisticsRepository
  ?? new FishingStatisticsRepository(deps.db);
```

At the start of `getOrCreate`, after account validation, read:

```ts
const initialDailyFishingStatistics = this.fishingStatisticsRepository.readToday(accountId);
```

Then add both production session options:

```ts
initialDailyFishingStatistics,
onFishingCatch: (fishId, caughtAt) => (
  this.fishingStatisticsRepository.recordCatch(accountId, fishId, caughtAt)
),
```

- [x] **Step 3: Overlay current daily statistics on the automation GET boundary**

Change only `SessionManager.automationSnapshot(accountId)`:

```ts
automationSnapshot(accountId: number): AutomationSnapshot {
  const persisted = readAutomationState(this.deps.db, accountId);
  const live = this.sessions.get(accountId)?.automationSnapshot();
  const dailyFishingStatistics = this.fishingStatisticsRepository.readToday(accountId);
  return {
    ...(live ?? offlineAutomationSnapshot(persisted)),
    ...(live ? {
      findNpcConfig: persisted.findNpcConfig,
      fishingConfig: persisted.fishingConfig,
    } : {}),
    dailyFishingStatistics,
  };
}
```

This keeps `offlineAutomationSnapshot` and `idleFishingRuntime` untouched while providing the separate persisted field online and offline.

- [x] **Step 4: Overlay the same field in full session snapshots sent on WS subscribe**

When `SessionManager.snapshot(accountId)` has a live snapshot, return a shallow copy whose nested automation snapshot is overlaid with `readToday(accountId)`:

```ts
snapshot(accountId: number): AvatarSessionSnapshot | null {
  const snapshot = this.sessions.get(accountId)?.snapshot();
  if (!snapshot) return null;
  return {
    ...snapshot,
    automation: {
      ...snapshot.automation,
      dailyFishingStatistics: this.fishingStatisticsRepository.readToday(accountId),
    },
  };
}
```

This covers `ws.ts` subscription snapshots without editing WS or web global types.

- [x] **Step 5: Preserve route and read-failure semantics**

Wrap the existing GET only:

```ts
router.get('/:id/automation', owned, (req, res) => {
  try {
    res.json(sessions.automationSnapshot(accountId(req)));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
```

Do not alter URL, ownership middleware, success shape beyond the additive field, or add an endpoint.

- [x] **Step 6: Validate current-tree call coverage and server build**

Run:

```bash
rg -n "dailyFishingStatistics|onFishingCatch|sessions\.snapshot\(|sessions\.automationSnapshot\(" \
  avatar-web/server/src --glob '*.ts'
npm --prefix avatar-web/server run typecheck
npm --prefix avatar-web/server run build
```

Expected: catch callback, live event payload, GET snapshot, offline GET, and WS full snapshot are covered; build exits 0.

- [x] **Step 7: Analyze graph changes and commit**

Run `detect_changes({scope: "all"})` and global supplemental checks.

```bash
git diff --check
git diff --name-only
git add avatar-web/server/src/session/manager.ts avatar-web/server/src/session/routes.ts
git commit -m "feat(fishing): serve persisted daily statistics" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

### Task 5: Narrow and Render Only Inside FishingPanel

**Files:**
- Modify: `avatar-web/web/src/accounts/panels/FishingPanel.tsx:1-39`
- Modify: `avatar-web/web/src/accounts/panels/FishingPanel.tsx:79-100`
- Modify: `avatar-web/web/src/accounts/panels/FishingPanel.tsx:325-353`

**Interfaces:**
- Consumes: existing `AutomationSnapshot` prop, additive runtime JSON property, and existing `onChanged?(): void` refresh callback.
- Produces: local `DailyFishingSpeciesCount`, `DailyFishingStatistics`, `AutomationWithDailyFishingStatistics`, `getDailyFishingStatistics()`, midnight refresh effect, and accessible summary/list.

- [x] **Step 1: Gate CRITICAL web contracts and current consumer paths**

Run upstream impact for web `AutomationSnapshot`, web `FishingRuntimeState`, and `FishingPanel`. Explicitly report that the first two are CRITICAL and forbidden. Run:

```bash
rg -n "interface (AutomationSnapshot|FishingRuntimeState)|type AutomationSnapshot" avatar-web/web/src
rg -n "<FishingPanel|FishingPanel\(|automation=|onChanged=" \
  avatar-web/web/src/accounts --glob '*.tsx'
git diff -- avatar-web/web/src/types.ts
```

Expected: only `FishingPanel.tsx` is planned for web editing; `types.ts` has no feature diff.

- [x] **Step 2: Add local DTOs and optional intersection/narrowing helper**

Inside `FishingPanel.tsx`, add:

```ts
interface DailyFishingSpeciesCount {
  fishId: number;
  fishName: string;
  count: number;
}

interface DailyFishingStatistics {
  date: string;
  timezone: 'Asia/Ho_Chi_Minh';
  totalCatches: number;
  bySpecies: DailyFishingSpeciesCount[];
  updatedAt: number | null;
}

type AutomationWithDailyFishingStatistics = AutomationSnapshot & {
  dailyFishingStatistics?: DailyFishingStatistics;
};

function getDailyFishingStatistics(
  automation: AutomationSnapshot | undefined,
): DailyFishingStatistics | undefined {
  return (automation as AutomationWithDailyFishingStatistics | undefined)
    ?.dailyFishingStatistics;
}
```

Do not import or export these local types and do not edit `web/src/types.ts`.

- [x] **Step 3: Add a local Vietnam-midnight refresh effect**

Change React import to include `useEffect`. Add a module-level Vietnam date formatter and bounded helper:

```ts
const VIETNAM_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function millisecondsUntilVietnamDateChange(now = Date.now()): number {
  const current = VIETNAM_DATE.format(now);
  let low = now;
  let high = now + 30 * 60 * 60 * 1000;
  if (VIETNAM_DATE.format(high) === current) {
    throw new Error('không xác định được mốc đổi ngày Việt Nam');
  }
  while (high - low > 1000) {
    const middle = Math.floor((low + high) / 2);
    if (VIETNAM_DATE.format(middle) === current) low = middle;
    else high = middle;
  }
  return Math.max(1000, high - now + 1000);
}
```

Inside `FishingPanel`, add the complete self-rescheduling effect:

```ts
useEffect(() => {
  if (!onChanged) return undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancelled = false;
  const schedule = (): void => {
    if (cancelled) return;
    let delay = 60_000;
    try {
      delay = millisecondsUntilVietnamDateChange();
    } catch {
      // Retry date-boundary calculation without changing displayed data.
    }
    timer = setTimeout(() => {
      if (cancelled) return;
      onChanged();
      schedule();
    }, delay);
  };
  schedule();
  return () => {
    cancelled = true;
    if (timer !== undefined) clearTimeout(timer);
  };
}, [onChanged]);
```

This effect only requests the existing refresh path; it never mutates statistics locally.

- [x] **Step 4: Render the persisted total and stable species list**

Use:

```ts
const dailyFishingStatistics = getDailyFishingStatistics(automation);
```

Rename the metric label to `Tổng cá hôm nay` and render:

```tsx
{(dailyFishingStatistics?.totalCatches ?? 0).toLocaleString('vi-VN')}
```

Add after the metric grid:

```tsx
<section aria-labelledby="daily-fishing-heading" style={{
  padding: '0.85rem 1rem', background: '#12161d', borderRadius: '8px',
  border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '0.65rem',
}}>
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
    <h4 id="daily-fishing-heading" style={{ margin: 0, fontSize: '0.95rem' }}>
      Cơ cấu cá hôm nay
    </h4>
    <span className="hint" style={{ fontSize: '0.8rem' }}>
      {dailyFishingStatistics?.date ?? '—'} · Asia/Ho_Chi_Minh
    </span>
  </div>
  {dailyFishingStatistics && dailyFishingStatistics.bySpecies.length > 0 ? (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: '0.45rem' }}>
      {dailyFishingStatistics.bySpecies.map((species) => (
        <li key={species.fishId} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--fg)' }}>
            {species.fishName} <span className="hint">(ID {species.fishId})</span>
          </span>
          <strong>{species.count.toLocaleString('vi-VN')}</strong>
        </li>
      ))}
    </ul>
  ) : (
    <p className="hint" style={{ margin: 0 }}>Chưa bắt được cá nào trong ngày.</p>
  )}
</section>
```

Render DTO order unchanged. Keep status, quest, live last fish, map/area, and settings navigation. Existing web `FISH_NAMES` may continue serving live last-fish fallback only; never use it to transform daily DTO rows.

- [x] **Step 5: Prove forbidden web files/types are untouched and build**

Run:

```bash
git diff --exit-code -- avatar-web/web/src/types.ts
rg -n "dailyFishingStatistics|AutomationWithDailyFishingStatistics|getDailyFishingStatistics" \
  avatar-web/web/src
npm --prefix avatar-web/web run build
```

Expected: no `types.ts` diff; daily web symbols occur only in `FishingPanel.tsx`; TypeScript/Vite exit 0.

- [x] **Step 6: Analyze graph changes and commit**

Run `detect_changes({scope: "all"})`, report stale/partial limitations, and run:

```bash
git diff --check
git diff --name-only
git add avatar-web/web/src/accounts/panels/FishingPanel.tsx
git commit -m "feat(fishing): display daily catch statistics" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

Expected: the only staged web file is `FishingPanel.tsx`.

### Task 6: Verify End-to-End Without Tests

**Files:**
- Modify: `docs/superpowers/plans/2026-09-12-daily-fishing-statistics.md` (checkboxes and verification evidence only)

**Interfaces:**
- Consumes: Tasks 1–5 persistence, additive snapshot/API/WS, local web narrowing, midnight refresh, and UI.
- Produces: recorded verification evidence without production changes, tests, or commits beyond the implementation tasks.

- [x] **Step 1: Run allowed automated verification**

```bash
npm --prefix avatar-web/server run typecheck
npm --prefix avatar-web/server run build
npm --prefix avatar-web/web run build
git diff --check
```

Expected: every command exits 0. Do not invoke TDD, create tests, or edit existing tests.

- [x] **Step 2: Prove all forbidden boundaries remain untouched**

```bash
git diff --exit-code -- avatar-web/web/src/types.ts
rg -n -A12 "interface FishingRuntimeState" \
  avatar-web/server/src/session/automationTypes.ts avatar-web/web/src/types.ts
rg -n "dailyFishingStatistics" avatar-web/server/src avatar-web/web/src
```

Expected: no global web type diff; neither runtime interface contains the new field; server occurrences are repository/additive snapshot/session/manager integration; the only web occurrences are local to `FishingPanel.tsx`.

- [x] **Step 3: Verify aggregate, ordering, fallback, and cascade**

On a temporary database or explicitly approved disposable account, record two catches for one known ID, one for another known ID, and one unknown ID. Inspect SQLite and `GET /api/accounts/:id/automation`, then delete the disposable account.

Expected: rows are `2`, `1`, `1`; API total is `4`; order is count descending then ID ascending; unknown fish reads `Cá ID <id>`; foreign-key cascade removes rows.

- [x] **Step 4: Verify valid guards, write failure, and separate runtime semantics**

Observe a valid current-player/current-epoch success, negative ID, another player's event, and stale-epoch event. Temporarily reject a disposable DB write, then restore it.

Expected: only valid non-negative events persist; daily DTO changes only after successful persistence. Existing process-live `FishingRuntimeState.totalCatches` semantics remain unchanged; write failure preserves the live catch, keeps prior daily DTO, reports the warning, emits a snapshot, and automation continues.

- [x] **Step 5: Verify API, WS, reload, offline, restart, and read failure**

Inspect GET and live `automation` WebSocket payloads, subscribe for a full session snapshot, reload, disconnect, and restart. Temporarily reject a disposable DB read, then restore it.

Expected: `dailyFishingStatistics` is sibling to `fishingRuntime`; online/offline/reload/restart agree on current DB data; runtime object shape is unchanged; GET read failure returns 500 and web retains its last successful state.

- [x] **Step 6: Verify Vietnam date boundary and presentation**

Exercise `23:59:59` and `00:00:00` in `Asia/Ho_Chi_Minh` with non-Vietnam host/browser timezone, then inspect the Fishing tab above and below the `679px` breakpoint.

Expected: catches land in separate buckets; first GET after midnight returns the new bucket; open panel refreshes just after boundary without a catch; date, timezone, total, species, status, quest, live last fish, map/area, and settings navigation remain readable.

- [x] **Step 7: Run final stale-index-aware graph and scope review**

Run `detect_changes({scope: "all"})` and explicitly record that the index remains stale because refresh is known to fail. If partial/truncated, do not label it clean. Supplement with:

```bash
git diff --check
git diff --name-only
rg -n "interface (AutomationSnapshot|FishingRuntimeState)|dailyFishingStatistics|onFishingCatch" \
  avatar-web/server/src avatar-web/web/src
```

Expected: intended production changes are limited to:

```text
avatar-web/server/src/db/schema.sql
avatar-web/server/src/accounts/fishingStatisticsRepo.ts
avatar-web/server/src/session/automationTypes.ts
avatar-web/server/src/session/avatarSession.ts
avatar-web/server/src/session/manager.ts
avatar-web/server/src/session/routes.ts
avatar-web/web/src/accounts/panels/FishingPanel.tsx
```

No test file, web `types.ts`, server/web `FishingRuntimeState`, or web `AutomationSnapshot` is modified. Mark checkboxes only after attaching the actual command/manual evidence.
