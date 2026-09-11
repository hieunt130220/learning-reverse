# Auto Fisherman Quest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triển khai chế độ `auto_fisherman_quest` tự động làm nhiệm vụ Thợ Câu end-to-end (quét quest → resolve cá/map → tái dùng fishing loop → sync tiến độ → quét quest mới).

**Architecture:** Mode mới độc lập trong `AutomationMode`; module pure `fishermanQuest.ts` resolve tên cá → map/vé; orchestrator `runFishermanQuestLoop` trong `AvatarSession` gọi lại `startFishingLoop()` nguyên vẹn, đếm `fishing-success-result`, sync server qua `refreshProgressQuests()`; UI `StatusPanel` thêm nút + tiến độ realtime.

**Tech Stack:** TypeScript (Node server + React web), SQLite (`avatar_automation_state`), WebSocket `automation` snapshot, game opcodes hiện có (cmd -59/-61/-62, TX45/TX43/TX44).

**Spec:** `docs/superpowers/specs/2026-09-11-auto-fisherman-quest-design.md`

## Global Constraints
- KHÔNG viết test, KHÔNG tạo file test dưới mọi hình thức (tuyệt đối không TDD).
- Trước khi sửa mỗi symbol: chạy `gitnexus_impact({target, direction: "upstream"})`; nếu HIGH/CRITICAL thì dừng và báo user.
- Trước mỗi commit: chạy `gitnexus_detect_changes()` và xác nhận chỉ chạm đúng file của task.
- KHÔNG sửa logic `runFishingLoop`, `prepareFishingAtPark`, periodic farm scheduler, dialog filter (`isRewardDialog`/`isInformationalDialog`), parser `parseQuestDialogText`/`decodeProgressQuestPacket`.
- Log user-facing bằng tiếng Việt, prefix `[thợ câu]` cho quest orchestrator; giữ prefix `[câu cá]` cho sự kiện fishing loop.
- Bảng ánh xạ cá → map: Cá chim (454) thuộc Map 16 (không phải Map 15).
- Vé Map 16 tốn Lượng: được phép mua, log info mỗi lần vào mục tiêu map 16.
- Mỗi task kết thúc bằng một commit riêng; không gộp task.

---

### Task 1: Type contracts (server + web mirror)

**Files:**
- Modify: `avatar-web/server/src/session/automationTypes.ts:6` (dòng `AutomationMode`)
- Modify: `avatar-web/server/src/session/automationTypes.ts:159-168` (sau `AutomationSnapshot`, chèn types mới)
- Modify: `avatar-web/server/src/session/automationTypes.ts:185-187` (sau `idleFindNpcRuntime`, chèn factory)
- Modify: `avatar-web/web/src/types.ts:338` (dòng `AutomationMode`)
- Modify: `avatar-web/web/src/types.ts:441-450` (sau `AutomationSnapshot`, chèn types mới)

**Interfaces:**
- Consumes: không (task đầu tiên).
- Produces:
  - `AutomationMode` bao gồm `'auto_fisherman_quest'` (server + web).
  - `export type FishermanQuestPhase = 'idle' | 'scanning' | 'resolving' | 'fishing' | 'syncing' | 'switching-target' | 'completed-cycle' | 'stopped'`
  - `export interface FishermanQuestFishMapping { readonly fishId: number; readonly map: number; readonly ticketId: number }`
  - `export interface FishermanQuestRuntimeState { phase: FishermanQuestPhase; questTitle: string | null; targetFishName: string | null; targetFishId: number | null; targetMap: number | null; needed: number; caught: number; lastError: string | null }`
  - `export function idleFishermanQuestRuntime(): FishermanQuestRuntimeState`
  - `AutomationSnapshot.fishermanQuestRuntime?: FishermanQuestRuntimeState` (optional để tương thích snapshot cũ, cả server + web).

- [ ] **Step 1: Chạy impact cho `AutomationMode`**
  Run: `gitnexus_impact({target: "AutomationMode", direction: "upstream"})`
  Expected: liệt kê callers (routes gate, session dispatch, repo, web types). Ghi nhận risk; chỉ tiếp tục nếu không có HIGH/CRITICAL ngoài các điểm đã liệt kê trong spec §3.2.

- [ ] **Step 2: Sửa `AutomationMode` server**
  Trong `avatar-web/server/src/session/automationTypes.ts:6`, thay:
  ```ts
  export type AutomationMode = 'off' | 'auto_farm' | 'find_npc' | 'auto_fishing';
  ```
  thành:
  ```ts
  export type AutomationMode = 'off' | 'auto_farm' | 'find_npc' | 'auto_fishing' | 'auto_fisherman_quest';
  ```

- [ ] **Step 3: Chèn types quest + factory (server)**
  Sau block `AutomationSnapshot` (`automationTypes.ts:159-168`), chèn:
  ```ts
  export type FishermanQuestPhase =
    | 'idle'
    | 'scanning'
    | 'resolving'
    | 'fishing'
    | 'syncing'
    | 'switching-target'
    | 'completed-cycle'
    | 'stopped';

  export interface FishermanQuestFishMapping {
    readonly fishId: number;
    readonly map: number;
    readonly ticketId: number;
  }

  export interface FishermanQuestRuntimeState {
    phase: FishermanQuestPhase;
    questTitle: string | null;
    targetFishName: string | null;
    targetFishId: number | null;
    targetMap: number | null;
    /** total - current của condition mục tiêu tại lúc RESOLVE. */
    needed: number;
    /** Số cá đúng targetFishId từ fishing-success-result kể từ khi vào mục tiêu. */
    caught: number;
    lastError: string | null;
  }
  ```
  Và trong `AutomationSnapshot`, sau dòng `fishingRuntime?: FishingRuntimeState;`, thêm:
  ```ts
    fishermanQuestRuntime?: FishermanQuestRuntimeState;
  ```
  Sau hàm `idleFindNpcRuntime` (cuối file), thêm:
  ```ts
  export function idleFishermanQuestRuntime(): FishermanQuestRuntimeState {
    return {
      phase: 'idle',
      questTitle: null,
      targetFishName: null,
      targetFishId: null,
      targetMap: null,
      needed: 0,
      caught: 0,
      lastError: null,
    };
  }
  ```

- [ ] **Step 4: Mirror sang web `types.ts`**
  Dòng 338 thay `AutomationMode` y hệt Step 2. Sau `AutomationSnapshot` (dòng 441-450) chèn `FishermanQuestPhase`, `FishermanQuestRuntimeState` (bỏ `FishermanQuestFishMapping` — web không cần) và thêm field `fishermanQuestRuntime?: FishermanQuestRuntimeState;` vào `AutomationSnapshot`.

- [ ] **Step 5: Verify types**
  Run: `cd avatar-web/server && npx tsc --noEmit` và `cd avatar-web/web && npx tsc --noEmit`
  Expected: không lỗi. (`fishermanQuestRuntime` optional nên snapshot cũ vẫn hợp lệ.)

- [ ] **Step 6: Detect changes + Commit**
  Run: `gitnexus_detect_changes({scope: "all"})`
  Expected: chỉ 2 files (`automationTypes.ts` server + web `types.ts`).
  ```bash
  git add avatar-web/server/src/session/automationTypes.ts avatar-web/web/src/types.ts
  git commit -m "feat(quest): add auto_fisherman_quest mode and runtime types

  Co-Authored-By: Claude Code <noreply@anthropic.com>"
  ```

---

### Task 2: Module pure `fishermanQuest.ts`

**Files:**
- Create: `avatar-web/server/src/session/fishermanQuest.ts`

**Interfaces:**
- Consumes: `FishermanQuestFishMapping` (Task 1), `ProgressQuestCondition` (type-only từ `../game/progressQuests.js`).
- Produces:
  - `export const FISHERMAN_QUEST_FISH_MAP: Readonly<Record<string, FishermanQuestFishMapping>>`
  - `export function normalizeFishName(raw: string): string`
  - `export function resolveFishQuestTarget(condName: string): { ok: true; fishId: number; map: number; ticketId: number } | { ok: false; unknownName: string }`
  - `export function pickNextFishTarget(conditions: readonly ProgressQuestCondition[]): ProgressQuestCondition | null`

- [ ] **Step 1: Tạo file với toàn bộ nội dung**
  ```ts
  /**
   * Logic thuần resolve nhiệm vụ Thợ Câu → mục tiêu câu cá.
   * Module thuần (chỉ import type) — không import runtime để tránh chu kỳ phụ thuộc.
   */
  import type { FishermanQuestFishMapping } from './automationTypes.js';
  import type { ProgressQuestCondition } from '../game/progressQuests.js';

  /**
   * Bảng ánh xạ tên cá (key đã chuẩn hóa: lowercase + bỏ dấu + trim)
   * → map hồ câu + vé tương ứng. Cá chim (454) thuộc Map 16.
   */
  export const FISHERMAN_QUEST_FISH_MAP: Readonly<Record<string, FishermanQuestFishMapping>> =
    Object.freeze({
      'ca ro': { fishId: 444, map: 14, ticketId: 458 },
      'ca long tong': { fishId: 449, map: 14, ticketId: 458 },
      'long tong': { fishId: 449, map: 14, ticketId: 458 },
      'ca chep vang': { fishId: 450, map: 14, ticketId: 458 },
      'chep vang': { fishId: 450, map: 14, ticketId: 458 },
      'ca loc': { fishId: 451, map: 15, ticketId: 459 },
      'ca noc': { fishId: 452, map: 15, ticketId: 459 },
      noc: { fishId: 452, map: 15, ticketId: 459 },
      'con cua': { fishId: 453, map: 15, ticketId: 459 },
      cua: { fishId: 453, map: 15, ticketId: 459 },
      'ca duoi': { fishId: 455, map: 16, ticketId: 460 },
      duoi: { fishId: 455, map: 16, ticketId: 460 },
      'ca ngua': { fishId: 456, map: 16, ticketId: 460 },
      ngua: { fishId: 456, map: 16, ticketId: 460 },
      'ca chim': { fishId: 454, map: 16, ticketId: 460 },
      chim: { fishId: 454, map: 16, ticketId: 460 },
      'ca map': { fishId: 457, map: 16, ticketId: 460 },
    });

  /** Lowercase + bỏ dấu tiếng Việt + trim + gộp khoảng trắng. */
  export function normalizeFishName(raw: string): string {
    return raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .trim()
      .replace(/\s+/g, ' ');
  }

  /**
   * Resolve tên condition quest (vd "Thu hoạch 5 con cá rô - 0/5" hoặc "Cá rô")
   * thành mục tiêu câu. Match substring theo key dài trước để tên đầy đủ
   * thắng tên rút gọn. Không match → ok:false, caller dừng an toàn.
   */
  export function resolveFishQuestTarget(
    condName: string,
  ): { ok: true; fishId: number; map: number; ticketId: number } | { ok: false; unknownName: string } {
    const norm = normalizeFishName(condName);
    const keys = Object.keys(FISHERMAN_QUEST_FISH_MAP).sort((a, b) => b.length - a.length);
    for (const key of keys) {
      if (norm.includes(key)) {
        const m = FISHERMAN_QUEST_FISH_MAP[key];
        return { ok: true, fishId: m.fishId, map: m.map, ticketId: m.ticketId };
      }
    }
    return { ok: false, unknownName: condName.trim() };
  }

  /** Condition `!isDone` đầu tiên (làm tuần tự); `null` = xong hết. */
  export function pickNextFishTarget(
    conditions: readonly ProgressQuestCondition[],
  ): ProgressQuestCondition | null {
    return conditions.find((c) => !c.isDone) ?? null;
  }
  ```
  LƯU Ý khi gõ regex bỏ dấu: `/[̀-ͯ]/g` phải là range Unicode combining diacritical marks U+0300–U+036F. Viết đúng dạng escape: `/[̀-ͯ]/g`.

- [ ] **Step 2: Verify types**
  Run: `cd avatar-web/server && npx tsc --noEmit`
  Expected: không lỗi.

- [ ] **Step 3: Detect changes + Commit**
  Run: `gitnexus_detect_changes({scope: "all"})`
  Expected: chỉ 1 file mới `avatar-web/server/src/session/fishermanQuest.ts`.
  ```bash
  git add avatar-web/server/src/session/fishermanQuest.ts
  git commit -m "feat(quest): add pure fisherman quest target resolver

  Co-Authored-By: Claude Code <noreply@anthropic.com>"
  ```

---

### Task 3: DB migration + repo (SQLite tương thích ngược)

**Files:**
- Modify: `avatar-web/server/src/db/schema.sql` (dòng CHECK `desired_mode`)
- Modify: `avatar-web/server/src/db/index.ts` (khối migration `!stateTable.sql.includes('auto_fishing')`)
- Modify: `avatar-web/server/src/accounts/automationRepo.ts:310` (`WHERE desired_mode IN (...)`)
- Modify: `avatar-web/server/src/accounts/automationRepo.ts:328-340` (`offlineAutomationSnapshot`)
- Modify: `avatar-web/server/src/accounts/automationRepo.ts:1-14` (import thêm `idleFishermanQuestRuntime`)

**Interfaces:**
- Consumes: `idleFishermanQuestRuntime` (Task 1).
- Produces: DB chấp nhận `'auto_fisherman_quest'` (DB mới + DB cũ migrate); `listDesiredAutomation` resume mode mới sau restart; `offlineAutomationSnapshot` có `fishermanQuestRuntime` idle.

- [ ] **Step 1: Chạy impact cho `listDesiredAutomation` và `setDesiredMode`**
  Run: `gitnexus_impact({target: "listDesiredAutomation", direction: "upstream"})` và `gitnexus_impact({target: "setDesiredMode", direction: "upstream"})`
  Expected: callers là bootstrap/manager/routes. Chỉ tiếp tục nếu không có HIGH/CRITICAL ngoài dự kiến.

- [ ] **Step 2: Sửa `schema.sql`**
  Thay:
  ```sql
  CHECK (desired_mode IN ('off', 'auto_farm', 'find_npc', 'auto_fishing')),
  ```
  thành:
  ```sql
  CHECK (desired_mode IN ('off', 'auto_farm', 'find_npc', 'auto_fishing', 'auto_fisherman_quest')),
  ```

- [ ] **Step 3: Sửa migration `db/index.ts`**
  Thay điều kiện (nguyên văn):
  ```ts
  if (stateTable && !stateTable.sql.includes('auto_fishing')) {
  ```
  thành:
  ```ts
  if (stateTable && (!stateTable.sql.includes('auto_fishing') || !stateTable.sql.includes('auto_fisherman_quest'))) {
  ```
  Và trong `CREATE TABLE avatar_automation_state` của khối đó, thay:
  ```ts
  CHECK (desired_mode IN ('off', 'auto_farm', 'find_npc', 'auto_fishing')),
  ```
  thành:
  ```ts
  CHECK (desired_mode IN ('off', 'auto_farm', 'find_npc', 'auto_fishing', 'auto_fisherman_quest')),
  ```
  (DB cũ đã migrate `auto_fishing` mà thiếu mode mới sẽ rebuild lại, giữ nguyên rows qua `INSERT ... SELECT`.)

- [ ] **Step 4: Sửa `automationRepo.ts`**
  Import: thêm `idleFishermanQuestRuntime,` vào block import từ `'../session/automationTypes.js'` (giữ thứ tự alphabet: sau `idleFindNpcRuntime`, trước `idleFishingRuntime`).
  Thay:
  ```ts
  WHERE desired_mode IN ('auto_farm', 'find_npc', 'auto_fishing')
  ```
  thành:
  ```ts
  WHERE desired_mode IN ('auto_farm', 'find_npc', 'auto_fishing', 'auto_fisherman_quest')
  ```
  Trong `offlineAutomationSnapshot`, sau dòng `fishingRuntime: idleFishingRuntime(),` thêm:
  ```ts
  fishermanQuestRuntime: idleFishermanQuestRuntime(),
  ```

- [ ] **Step 5: Verify types**
  Run: `cd avatar-web/server && npx tsc --noEmit`
  Expected: không lỗi.

- [ ] **Step 6: Detect changes + Commit**
  Run: `gitnexus_detect_changes({scope: "all"})`
  Expected: chỉ 3 files (`schema.sql`, `db/index.ts`, `automationRepo.ts`).
  ```bash
  git add avatar-web/server/src/db/schema.sql avatar-web/server/src/db/index.ts avatar-web/server/src/accounts/automationRepo.ts
  git commit -m "feat(quest): persist auto_fisherman_quest mode in sqlite

  Co-Authored-By: Claude Code <noreply@anthropic.com>"
  ```

---

### Task 4: Mở route `POST /automation/start` cho mode mới

**Files:**
- Modify: `avatar-web/server/src/session/routes.ts:286-293` (gate `exactObject` + whitelist mode)

**Interfaces:**
- Consumes: `AutomationMode` đã mở rộng (Task 1).
- Produces: `POST /:id/automation/start {mode:'auto_fisherman_quest'}` đi qua gate (không còn 400 `invalid-automation-mode`).

- [ ] **Step 1: Mở gate**
  Thay (nguyên văn):
  ```ts
  if (
    !exactObject(req.body, ['mode'])
    || (req.body.mode !== 'auto_farm' && req.body.mode !== 'find_npc' && req.body.mode !== 'auto_fishing')
  ) {
  ```
  thành:
  ```ts
  if (
    !exactObject(req.body, ['mode'])
    || (req.body.mode !== 'auto_farm' && req.body.mode !== 'find_npc' && req.body.mode !== 'auto_fishing' && req.body.mode !== 'auto_fisherman_quest')
  ) {
  ```
  Không thêm precondition (rod/bait lấy từ `FishingConfig` hiện có; map do quest quyết định).

- [ ] **Step 2: Verify types**
  Run: `cd avatar-web/server && npx tsc --noEmit`
  Expected: không lỗi.

- [ ] **Step 3: Detect changes + Commit**
  Run: `gitnexus_detect_changes({scope: "all"})`
  Expected: chỉ `avatar-web/server/src/session/routes.ts`.
  ```bash
  git add avatar-web/server/src/session/routes.ts
  git commit -m "feat(quest): allow auto_fisherman_quest in automation start route

  Co-Authored-By: Claude Code <noreply@anthropic.com>"
  ```

---

### Task 5: `AvatarSession` part A — fields, snapshot, guards, hook đếm cá

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts:29-57` (import block automationTypes + fishermanQuest)
- Modify: `avatar-web/server/src/session/avatarSession.ts:295` (sau `fishingRuntime`, thêm fields quest)
- Modify: `avatar-web/server/src/session/avatarSession.ts:720-728` (`fishingOwnsOrTargetsContext`, thêm helper `isFishingMode`)
- Modify: `avatar-web/server/src/session/avatarSession.ts:743-754` (`automationSnapshot`, thêm runtime)
- Modify: `avatar-web/server/src/session/avatarSession.ts:1067-1097` (guards `fishing-challenge` + `fishing-success-result`, hook đếm quest)

**Interfaces:**
- Consumes: `FishermanQuestRuntimeState`, `idleFishermanQuestRuntime` (Task 1); `resolveFishQuestTarget` KHÔNG dùng ở task này.
- Produces (cho Task 6/7):
  - Field `private fishermanQuestAbort?: AbortController`
  - Field `private fishermanQuestRuntime: FishermanQuestRuntimeState`
  - `private isFishingMode(): boolean`
  - `private updateFishermanQuest(patch: Partial<FishermanQuestRuntimeState>): void`
  - `private sleepAbortable(ms: number, signal: AbortSignal): Promise<void>`
  - Handler `fishing-success-result` tăng `fishermanQuestRuntime.caught` khi đúng `targetFishId` ở phase `fishing`.

- [ ] **Step 1: Chạy impact**
  Run: `gitnexus_impact({target: "fishingOwnsOrTargetsContext", direction: "upstream"})`, `gitnexus_impact({target: "automationSnapshot", direction: "upstream"})`, `gitnexus_impact({target: "startDesiredAutomation", direction: "upstream"})`
  Expected: ghi nhận blast radius; chỉ tiếp tục nếu không có HIGH/CRITICAL ngoài các callers đã biết (manager, routes, WS broadcast).

- [ ] **Step 2: Mở rộng import**
  Trong block import từ `'./automationTypes.js'` (dòng 29-56), thêm vào đúng vị trí alphabet:
  ```ts
  idleFishermanQuestRuntime,
  type FishermanQuestRuntimeState,
  ```
  Sau dòng 57 (`import { defaultFishingConfig } ...`), thêm:
  ```ts
  import { pickNextFishTarget, resolveFishQuestTarget } from './fishermanQuest.js';
  ```

- [ ] **Step 3: Thêm fields**
  Sau dòng 295 (`private fishingRuntime: FishingRuntimeState = idleFishingRuntime();`), thêm:
  ```ts
  private fishermanQuestAbort?: AbortController;
  private fishermanQuestRuntime: FishermanQuestRuntimeState = idleFishermanQuestRuntime();
  ```

- [ ] **Step 4: Guards — `isFishingMode` + `fishingOwnsOrTargetsContext`**
  Thay (nguyên văn dòng 720-724):
  ```ts
  private fishingOwnsOrTargetsContext(): boolean {
    return this.desiredMode === 'auto_fishing'
      || this.activeMode === 'auto_fishing'
      || this.fishingAbortController !== undefined;
  }
  ```
  thành:
  ```ts
  /** auto_fishing hoặc auto_fisherman_quest (desired lẫn active): fishing loop đang/khả dĩ chạy. */
  private isFishingMode(): boolean {
    return this.desiredMode === 'auto_fishing'
      || this.desiredMode === 'auto_fisherman_quest'
      || this.activeMode === 'auto_fishing'
      || this.activeMode === 'auto_fisherman_quest';
  }

  private fishingOwnsOrTargetsContext(): boolean {
    return this.isFishingMode()
      || this.fishingAbortController !== undefined;
  }
  ```

- [ ] **Step 5: Snapshot**
  Trong `automationSnapshot()` (dòng 743-754), sau dòng `fishingRuntime: this.fishingRuntime,` thêm:
  ```ts
      fishermanQuestRuntime: this.fishermanQuestRuntime,
  ```

- [ ] **Step 6: Guards handlers + hook đếm**
  Thay guard challenge (nguyên văn dòng 1068):
  ```ts
      if (!this.isCurrent(client, epoch) || this.desiredMode !== 'auto_fishing') return;
  ```
  (trong `client.on('fishing-challenge', ...)`) thành:
  ```ts
      if (!this.isCurrent(client, epoch) || !this.isFishingMode()) return;
  ```
  Thay guard success-result (nguyên văn dòng 1077):
  ```ts
      if (!this.isCurrent(client, epoch) || this.desiredMode !== 'auto_fishing') return;
  ```
  thành:
  ```ts
      if (!this.isCurrent(client, epoch) || !this.isFishingMode()) return;
  ```
  Trong nhánh `if (ev.idFish >= 0) {` của handler success-result (sau dòng pushLog `[câu cá] bắt được ...`, trước dấu `} else {`), chèn hook đếm quest:
  ```ts
        const questRuntime = this.fishermanQuestRuntime;
        if (
          this.activeMode === 'auto_fisherman_quest'
          && questRuntime.phase === 'fishing'
          && questRuntime.targetFishId === ev.idFish
        ) {
          const caught = questRuntime.caught + 1;
          this.fishermanQuestRuntime = { ...questRuntime, caught };
          this.pushLog(`[thợ câu] tiến độ: ${questRuntime.targetFishName} ${caught}/${questRuntime.needed}.`);
        } else if (
          this.activeMode === 'auto_fisherman_quest'
          && questRuntime.phase === 'fishing'
        ) {
          this.pushLog(`[câu cá] bắt được ${fishName} (không phải mục tiêu quest ${questRuntime.targetFishName}).`);
        }
  ```

- [ ] **Step 7: Helpers `updateFishermanQuest` + `sleepAbortable`**
  Sau method `emitAutomation()` (dòng 819-821), chèn:
  ```ts
  private updateFishermanQuest(patch: Partial<FishermanQuestRuntimeState>): void {
    this.fishermanQuestRuntime = { ...this.fishermanQuestRuntime, ...patch };
  }

  /** Sleep nhưng resolve sớm khi signal abort (dùng cho quest loop, không lẫn với waitForFishingRestOrFarmDue). */
  private sleepAbortable(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      if (signal.aborted) {
        resolve();
        return;
      }
      const timer = this.setTimeoutFn(() => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
      const onAbort = (): void => {
        this.clearTimeoutFn(timer);
        resolve();
      };
      signal.addEventListener('abort', onAbort, { once: true });
    });
  }
  ```

- [ ] **Step 8: Verify types**
  Run: `cd avatar-web/server && npx tsc --noEmit`
  Expected: không lỗi. (`pickNextFishTarget`/`resolveFishQuestTarget` import chưa dùng → TS `noUnusedLocals` CÓ thể báo lỗi; nếu báo, prefix xử lý ở Task 6. Nếu lỗi, thay bằng import type-only tạm? KHÔNG — thay vào đó chuyển import hàm sang Task 6. Ghi chú: nếu `tsc` báo unused, xóa dòng import hàm ở task này và thêm lại ở Task 6 Step 2.)

- [ ] **Step 9: Detect changes + Commit**
  Run: `gitnexus_detect_changes({scope: "all"})`
  Expected: chỉ `avatar-web/server/src/session/avatarSession.ts`.
  ```bash
  git add avatar-web/server/src/session/avatarSession.ts
  git commit -m "feat(quest): wire fisherman quest state and catch counting

  Co-Authored-By: Claude Code <noreply@anthropic.com>"
  ```

---

### Task 6: `AvatarSession` part B — dispatch + orchestrator loop

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts` (`startDesiredAutomation` nhánh mới sau block `auto_fishing`; thêm `startFishermanQuestLoop` + `runFishermanQuestLoop` sau `startFishingLoop`)

**Interfaces:**
- Consumes: fields/helpers Task 5; `pickNextFishTarget`, `resolveFishQuestTarget` (Task 2); `refreshProgressQuests()` (có sẵn, dòng 417-421 — fire-and-forget, gọi rồi chờ 4s); `client.fishermanQuestState` (public field `GameClient`); `startFishingLoop(client, generation, epoch)` (dòng 2204); `ensureDailyAttendance`/`attendancePromise`, `isAutomationGenerationCurrent`, `isCurrent` (có sẵn).
- Produces:
  - `private startFishermanQuestLoop(client: GameClient, generation: number, epoch: number): void`
  - `private runFishermanQuestLoop(client: GameClient, generation: number, epoch: number, signal: AbortSignal): Promise<void>`
  - Nhánh `auto_fisherman_quest` trong `startDesiredAutomation` set `activeMode` + reset runtime + start loop.

- [ ] **Step 1: Thêm nhánh dispatch**
  Trong `startDesiredAutomation`, sau block `if (this.desiredMode === 'auto_fishing') { ... }` (kết thúc `return true;` trước `if (this.desiredMode === 'find_npc')`), chèn:
  ```ts
    if (this.desiredMode === 'auto_fisherman_quest') {
      if (
        !this.isAutomationGenerationCurrent(generation)
        || !this.isCurrent(client, epoch)
        || client.status !== 'online'
      ) return false;
      this.ensureDailyAttendance(client, epoch);
      await this.attendancePromise;
      if (
        !this.isAutomationGenerationCurrent(generation)
        || !this.isCurrent(client, epoch)
        || client.status !== 'online'
      ) return false;
      this.activeMode = 'auto_fisherman_quest';
      this.fishermanQuestRuntime = idleFishermanQuestRuntime();
      this.startFishermanQuestLoop(client, generation, epoch);
      return true;
    }
  ```

- [ ] **Step 2: Orchestrator (đặt ngay sau `startFishingLoop`, dòng ~2231)**
  ```ts
  private startFishermanQuestLoop(client: GameClient, generation: number, epoch: number): void {
    this.fishermanQuestAbort?.abort();
    const abort = new AbortController();
    this.fishermanQuestAbort = abort;
    void (async () => {
      try {
        await this.runFishermanQuestLoop(client, generation, epoch, abort.signal);
      } catch (err) {
        if (
          !abort.signal.aborted
          && this.fishermanQuestAbort === abort
          && this.isAutomationGenerationCurrent(generation)
          && this.isCurrent(client, epoch)
        ) {
          const message = (err as Error).message;
          this.pushLog(`[thợ câu] lỗi vòng lặp: ${message}`);
          this.updateFishermanQuest({ phase: 'stopped', lastError: message });
          this.emitAutomation();
        }
      } finally {
        if (this.fishermanQuestAbort === abort) this.fishermanQuestAbort = undefined;
      }
    })();
  }

  /**
   * Vòng lặp quest Thợ Câu: SCAN → RESOLVE → FISH → SYNC → NEXT.
   * Tái dùng startFishingLoop() nguyên vẹn; server là source of truth cho tiến độ.
   */
  private async runFishermanQuestLoop(
    client: GameClient,
    generation: number,
    epoch: number,
    signal: AbortSignal,
  ): Promise<void> {
    const alive = (): boolean => !signal.aborted
      && this.isAutomationGenerationCurrent(generation)
      && this.isCurrent(client, epoch)
      && client.status === 'online'
      && this.desiredMode === 'auto_fisherman_quest';
    while (alive()) {
      // SCAN: quest hiện tại từ server.
      this.updateFishermanQuest({ phase: 'scanning', lastError: null });
      this.emitAutomation();
      this.refreshProgressQuests();
      await this.sleepAbortable(4000, signal);
      if (!alive()) return;
      const quest = client.fishermanQuestState;
      const conditions = quest?.conditions ?? [];
      if (!quest || conditions.length === 0) {
        this.updateFishermanQuest({ questTitle: quest?.title ?? null });
        this.pushLog('[thợ câu] chưa thấy nhiệm vụ thợ câu, thử quét lại sau 60s.');
        this.emitAutomation();
        await this.sleepAbortable(60_000, signal);
        continue;
      }
      const next = pickNextFishTarget(conditions);
      if (!next) {
        this.pushLog(`[thợ câu] hoàn thành ${quest.title}! Quét nhiệm vụ mới…`);
        this.updateFishermanQuest({ phase: 'completed-cycle', questTitle: quest.title });
        this.emitAutomation();
        await this.sleepAbortable(5000, signal);
        continue;
      }
      // RESOLVE: condition → cá/map.
      this.updateFishermanQuest({ phase: 'resolving', questTitle: quest.title });
      this.emitAutomation();
      const resolved = resolveFishQuestTarget(next.name);
      if (!resolved.ok) {
        const message = `Không nhận diện được cá "${resolved.unknownName}" trong quest "${quest.title}"`;
        this.pushLog(`[thợ câu] ${message}, dừng an toàn.`);
        this.updateFishermanQuest({
          phase: 'stopped',
          lastError: message,
          targetFishName: next.name,
          targetFishId: null,
          targetMap: null,
        });
        this.emitAutomation();
        return;
      }
      const needed = Math.max(0, next.total - next.current);
      this.updateFishermanQuest({
        phase: 'fishing',
        targetFishName: next.name,
        targetFishId: resolved.fishId,
        targetMap: resolved.map,
        needed,
        caught: 0,
      });
      this.pushLog(`[thợ câu] mục tiêu: ${next.name} ${next.current}/${next.total} → map ${resolved.map}.`);
      if (resolved.map === 16) this.pushLog('[thợ câu] map 16 dùng vé Lượng (2 Lượng/vé 460).');
      this.emitAutomation();
      // FISH: chỉ override map, giữ rod/bait/area/castDelay của user.
      this.fishingConfig = {
        ...this.fishingConfig,
        config: { ...this.fishingConfig.config, map: resolved.map },
      };
      this.startFishingLoop(client, generation, epoch);
      // Chờ xong mục tiêu: đủ caught local, hoặc server báo xong, hoặc quest đổi.
      let lastSyncAt = this.now();
      let syncedCaught = 0;
      for (;;) {
        await this.sleepAbortable(10_000, signal);
        if (!alive()) return;
        const runtime = this.fishermanQuestRuntime;
        if (runtime.needed > 0 && runtime.caught >= runtime.needed) break;
        const dueCount = runtime.caught - syncedCaught >= 5;
        const dueTime = this.now() - lastSyncAt >= 180_000;
        if (!dueCount && !dueTime) continue;
        // SYNC: server là source of truth.
        this.updateFishermanQuest({ phase: 'syncing' });
        this.emitAutomation();
        this.refreshProgressQuests();
        await this.sleepAbortable(4000, signal);
        if (!alive()) return;
        lastSyncAt = this.now();
        syncedCaught = this.fishermanQuestRuntime.caught;
        const fresh = client.fishermanQuestState;
        if (!fresh || fresh.title !== quest.title) break; // quest đổi → SCAN lại
        const freshCond = fresh.conditions.find((c) => c.name === next.name);
        if (!freshCond || freshCond.isDone || freshCond.current >= freshCond.total) {
          this.pushLog(`[thợ câu] server báo xong "${next.name}" (local=${this.fishermanQuestRuntime.caught}).`);
          break;
        }
        if (freshCond.current > next.current) {
          this.pushLog(`[thợ câu] tiến độ server: ${freshCond.current}/${freshCond.total}.`);
        }
        this.updateFishermanQuest({ phase: 'fishing' });
        this.emitAutomation();
      }
      // NEXT: dừng fishing loop mục tiêu cũ, vòng ngoài SCAN mục tiêu/quest tiếp theo.
      this.updateFishermanQuest({ phase: 'switching-target' });
      this.emitAutomation();
      if (this.fishingAbortController) {
        this.fishingAbortController.abort();
        this.fishingAbortController = undefined;
      }
    }
  }
  ```

- [ ] **Step 3: Verify types**
  Run: `cd avatar-web/server && npx tsc --noEmit`
  Expected: không lỗi. (Nếu Task 5 Step 8 đã dời import hàm sang đây, thêm dòng import ở Task 5 Step 2 vào task này thay vì để lỗi unused.)

- [ ] **Step 4: Detect changes + Commit**
  Run: `gitnexus_detect_changes({scope: "all"})`
  Expected: chỉ `avatar-web/server/src/session/avatarSession.ts`.
  ```bash
  git add avatar-web/server/src/session/avatarSession.ts
  git commit -m "feat(quest): add fisherman quest orchestrator loop

  Co-Authored-By: Claude Code <noreply@anthropic.com>"
  ```

---

### Task 7: `AvatarSession` part C — dọn quest loop khi dừng/switch

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts` (`stopActiveAutomation` sau block `auto_fishing`; `stop()` thêm abort quest)

**Interfaces:**
- Consumes: `fishermanQuestAbort`, `fishermanQuestRuntime`, `idleFishermanQuestRuntime` (Task 5).
- Produces: switch mode / stop / disconnect dọn cả quest loop + fishing loop; runtime reset về idle; log `[thợ câu] đã dừng…`.

- [ ] **Step 1: Dọn trong `stopActiveAutomation`**
  Sau block (nguyên văn):
  ```ts
    if (this.activeMode === 'auto_fishing') {
      if (this.client && this.client.status === 'online') {
        try {
          this.client.cauCaXong();
        } catch {
          /* bỏ qua */
        }
      }
      this.pushLog('[câu cá] đã dừng tự động câu cá.');
    }
    this.fishingRuntime.status = 'idle';
  ```
  chèn giữa `}` và `this.fishingRuntime.status`:
  ```ts
    if (this.fishermanQuestAbort) {
      this.fishermanQuestAbort.abort();
      this.fishermanQuestAbort = undefined;
    }
    if (this.activeMode === 'auto_fisherman_quest') {
      if (this.client && this.client.status === 'online') {
        try {
          this.client.cauCaXong();
        } catch {
          /* bỏ qua */
        }
      }
      this.pushLog('[thợ câu] đã dừng làm nhiệm vụ thợ câu.');
    }
  ```
  và sau dòng `this.fishingRuntime.status = 'idle';` thêm:
  ```ts
    this.fishermanQuestRuntime = idleFishermanQuestRuntime();
  ```

- [ ] **Step 2: Abort trong `stop()`**
  Trong `stop()` (dòng ~439-452), sau dòng `this.cancelFishingFarmSchedule();` thêm:
  ```ts
    this.fishermanQuestAbort?.abort();
    this.fishermanQuestAbort = undefined;
    this.fishermanQuestRuntime = idleFishermanQuestRuntime();
  ```

- [ ] **Step 3: Verify types**
  Run: `cd avatar-web/server && npx tsc --noEmit`
  Expected: không lỗi.

- [ ] **Step 4: Detect changes + Commit**
  Run: `gitnexus_detect_changes({scope: "all"})`
  Expected: chỉ `avatar-web/server/src/session/avatarSession.ts`.
  ```bash
  git add avatar-web/server/src/session/avatarSession.ts
  git commit -m "feat(quest): cleanup fisherman quest loop on stop

  Co-Authored-By: Claude Code <noreply@anthropic.com>"
  ```

---

### Task 8: Web UI — nút mode + tiến độ realtime trong `StatusPanel`

**Files:**
- Modify: `avatar-web/web/src/accounts/panels/StatusPanel.tsx:8` (type `StatusAutomationMode`)
- Modify: `avatar-web/web/src/accounts/panels/StatusPanel.tsx:54-61` (`useEffect` sync selectedMode)
- Modify: `avatar-web/web/src/accounts/panels/StatusPanel.tsx:63-78` (`automationProgress`)
- Modify: `avatar-web/web/src/accounts/panels/StatusPanel.tsx:183-202` (cụm nút chọn mode)

**Interfaces:**
- Consumes: `AutomationSnapshot.fishermanQuestRuntime` (Task 1 web mirror); `formatFishingStatus` từ `./FishingPanel.js` (đã import sẵn dòng 6).
- Produces: nút thứ 3 "🎣 Làm nhiệm vụ thợ câu"; dòng tiến độ quest + fishing status; `startAuto()` POST `{mode:'auto_fisherman_quest'}` không đổi code (dùng `selectedMode` sẵn có).

- [ ] **Step 1: Mở type + sync effect**
  Thay dòng 8:
  ```ts
  type StatusAutomationMode = 'auto_farm' | 'auto_fishing';
  ```
  thành:
  ```ts
  type StatusAutomationMode = 'auto_farm' | 'auto_fishing' | 'auto_fisherman_quest';
  ```
  Trong `useEffect` (dòng 54-61), thay:
  ```ts
    if (snapshotMode === 'auto_farm' || snapshotMode === 'auto_fishing') {
  ```
  thành:
  ```ts
    if (snapshotMode === 'auto_farm' || snapshotMode === 'auto_fishing' || snapshotMode === 'auto_fisherman_quest') {
  ```

- [ ] **Step 2: Tiến độ quest**
  Trong `automationProgress` IIFE (dòng 63-78), sau nhánh `if (progressMode === 'auto_farm') {...}` (trước `return \`automation ...\``), chèn:
  ```tsx
    if (progressMode === 'auto_fisherman_quest') {
      const q = automation.fishermanQuestRuntime;
      const questPart = q?.questTitle
        ? `${q.questTitle}${q.targetFishName ? ` — ${q.targetFishName} ${q.caught}/${q.needed}` : ''}`
        : 'đang quét nhiệm vụ thợ câu…';
      const fishPart = `câu cá: ${formatFishingStatus(
        true,
        automation.fishingRuntime?.status,
        snap?.status,
      )}`;
      const errPart = q?.lastError ? ` · lỗi: ${q.lastError}` : '';
      return `${questPart} · ${fishPart}${errPart}`;
    }
  ```

- [ ] **Step 3: Nút chọn mode thứ 3**
  Sau nút Auto Fishing (khối dòng ~193-201), chèn:
  ```tsx
        <button
          type="button"
          className={`automation-mode-button${selectedMode === 'auto_fisherman_quest' ? ' active' : ''}`}
          aria-pressed={selectedMode === 'auto_fisherman_quest'}
          disabled={controlsLocked}
          onClick={() => setSelectedMode('auto_fisherman_quest')}
        >
          🎣 Làm nhiệm vụ thợ câu
        </button>
  ```

- [ ] **Step 4: Verify types + build web**
  Run: `cd avatar-web/web && npx tsc --noEmit`
  Expected: không lỗi.

- [ ] **Step 5: Detect changes + Commit**
  Run: `gitnexus_detect_changes({scope: "all"})`
  Expected: chỉ `avatar-web/web/src/accounts/panels/StatusPanel.tsx`.
  ```bash
  git add avatar-web/web/src/accounts/panels/StatusPanel.tsx
  git commit -m "feat(quest): add fisherman quest mode to status panel

  Co-Authored-By: Claude Code <noreply@anthropic.com>"
  ```

---

### Task 9: Verify tổng + commit cuối (không test file)

**Files:** không sửa file (chỉ verify).

**Interfaces:**
- Consumes: toàn bộ Task 1-8.
- Produces: xác nhận build xanh + scope thay đổi đúng; báo cáo Gate 3 cho user.

- [ ] **Step 1: Typecheck server + web**
  Run: `cd avatar-web/server && npx tsc --noEmit`
  Expected: PASS, không lỗi.
  Run: `cd avatar-web/web && npx tsc --noEmit`
  Expected: PASS, không lỗi.

- [ ] **Step 2: Build server + web**
  Run: `cd avatar-web/server && npm run build`
  Expected: build thành công.
  Run: `cd avatar-web/web && npm run build`
  Expected: build thành công.

- [ ] **Step 3: Detect changes tổng**
  Run: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})`
  Expected: chỉ đúng 8 files + 1 file mới trong scope:
  `automationTypes.ts` (server), `types.ts` (web), `fishermanQuest.ts` (mới), `schema.sql`, `db/index.ts`, `automationRepo.ts`, `routes.ts`, `avatarSession.ts`, `StatusPanel.tsx`.
  Nếu lọt file ngoài scope → dừng, báo user, không commit.

- [ ] **Step 4: Báo cáo hoàn thành cho user**
  Không commit ở task này (mỗi task đã commit riêng). Tổng hợp: 8 commits, build xanh, detect_changes đúng scope → chờ user kiểm thử thủ công theo Verification Plan của spec (chọn mode → quét quest → đúng map/vé → caught tăng → cá lạ dừng an toàn → xong quest quét tiếp).
