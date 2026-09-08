# Auto Fishing Web Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement full automated fishing support in `avatar-web` including protocol commands (TX45, TX41, TX44, RX45, RX43, RX44), continuous fishing runner in `AvatarSession` defaulting to Khu cá rô (Map ID 14), and a dedicated Fishing Panel in the React Web UI.

**Architecture:** Extend `ParkService` and `GameClient` with the native fishing lifecycle commands. Add `'auto_fishing'` to `AutomationMode` and build `runFishingLoop` in `AvatarSession` using the existing Phase 3 ML decision engine. Expose a new "Câu cá" tab in `AccountOperationsDrawer` with live controls, statistics, and configuration.

**Tech Stack:** TypeScript, Node.js, Express, WebSocket (`ws`), React 18, Vite.

**Spec:** `docs/superpowers/specs/2026-09-08-auto-fishing-web-integration-design.md`

## Global Constraints
- Strictly NO Test-Driven Development; no test files unless explicitly requested.
- Work directly on main checkout; NEVER create or enter git worktrees.
- Default fishing map is Khu cá rô (Map ID 14, default join coordinates 254, 82).
- Data security: never commit, log, or persist passwords, credentials, raw packet dumps, image binaries, player/fish/account identifiers, model IDs, endpoints, or private tokens.
- Comply with GitNexus: run `mcp__gitnexus__impact` before modifying existing symbols, and `mcp__gitnexus__detect_changes` before commits.

---

### Task 1: Protocol & Native Positions Extension in `ParkService` and `GameClient`

**Files:**
- Modify: `avatar-web/server/src/game/parkService.ts`
- Modify: `avatar-web/server/src/game/client.ts`

**Interfaces:**
- Consumes: `CMD_AVATAR_JOIN_PARK = 80`, `Message` from `../proto/message.js`.
- Produces: `doStartFishing()`, `doQuanCau()`, `doCauCaXong()` in `ParkService`; `startFishing()`, `quanCau()`, `cauCaXong()` in `GameClient`; events `fishing-start-result`, `fishing-quan-cau`, `fishing-success-result`, `fishing-done`.

- [ ] **Step 1: Update `NATIVE_PARK_JOIN_POSITIONS` and add TX methods to `ParkService`**
  Add map 15, 16, 27 to `NATIVE_PARK_JOIN_POSITIONS`.
  Define:
  - `CMD_AVATAR_QUANG_CAU = 41`
  - `CMD_AVATAR_CAU_CA_XONG = 44`
  - `CMD_AVATAR_START_CAU_CA = 45`
  Add methods:
  ```ts
  doStartFishing(): void {
    const m = Message.create(CMD_AVATAR_START_CAU_CA);
    this.session.send(m);
  }

  doQuanCau(): void {
    const m = Message.create(CMD_AVATAR_QUANG_CAU);
    this.session.send(m);
  }

  doCauCaXong(): void {
    const m = Message.create(CMD_AVATAR_CAU_CA_XONG);
    this.session.send(m);
  }
  ```

- [ ] **Step 2: Add RX listeners and delegates in `GameClient`**
  In `GameClient`:
  - Delegate `startFishing()`, `quanCau()`, `cauCaXong()`.
  - In `onMessage`:
    - Case 45 (`START_CAU_CA`): decode `iss = r.readBoolean()`, `error = iss ? undefined : r.readUTF()`, emit `fishing-start-result` `{ iss, error }`.
    - Case 41 (`QUANG_CAU`): decode `idUser = r.readInt()`, emit `fishing-quan-cau` `{ idUser }`.
    - Case 43 (`CAU_THANH_CONG`): decode `idUser = r.readInt()`, `idFish = r.readShort()`, emit `fishing-success-result` `{ idUser, idFish }`.
    - Case 44 (`CAU_CA_XONG`): decode `idUser = r.readInt()`, emit `fishing-done` `{ idUser }`.

- [ ] **Step 3: Verify TypeScript Compilation**
  Run: `cd avatar-web/server && npm run typecheck`
  Expected: 0 errors.

- [ ] **Step 4: Commit**
  Run git status, detect changes, and commit:
  `git commit -m "feat(fishing): add start, cast, and finish fishing protocol in park service and client"`

---

### Task 2: Automation Types and Database Schema / Persistence

**Files:**
- Modify: `avatar-web/server/src/session/automationTypes.ts`
- Modify: `avatar-web/server/src/accounts/automationRepo.ts`

**Interfaces:**
- Consumes: SQLite `Db` connection.
- Produces: `AutomationMode = 'off' | 'auto_farm' | 'find_npc' | 'auto_fishing'`, `FishingConfig`, `FishingRuntimeState`.

- [ ] **Step 1: Extend `automationTypes.ts`**
  Add `'auto_fishing'` to `AutomationMode`.
  Add `FishingConfig`:
  ```ts
  export interface FishingConfig {
    readonly map: number;
    readonly area: number;
    readonly castDelayMs: number;
  }
  export const DEFAULT_FISHING_CONFIG: FishingConfig = Object.freeze({
    map: 14,
    area: 0,
    castDelayMs: 3000,
  });
  ```
  Add `FishingRuntimeState`:
  ```ts
  export interface FishingRuntimeState {
    status: 'idle' | 'moving' | 'starting' | 'casting' | 'hooked' | 'caught' | 'rejected' | 'resting';
    totalCatches: number;
    lastFishId: number | null;
    lastError: string | null;
    currentMap: number;
    currentArea: number;
  }
  ```

- [ ] **Step 2: Update `automationRepo.ts`**
  Allow `'auto_fishing'` as a valid string value in `setDesiredMode` validation.

- [ ] **Step 3: Verify TypeScript Compilation**
  Run: `cd avatar-web/server && npm run typecheck`
  Expected: 0 errors.

- [ ] **Step 4: Commit**
  `git commit -m "feat(fishing): add auto_fishing to automation modes and config types"`

---

### Task 3: Continuous Fishing Loop in `AvatarSession`

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts`
- Modify: `avatar-web/server/src/session/manager.ts`

**Interfaces:**
- Consumes: `GameClient` fishing events, `ParkService`, `makeAutoDecision`, `ProductionInferenceClient`.
- Produces: `runFishingLoop()`, `fishingState` snapshot in runtime broadcasts.

- [ ] **Step 1: Add fishing state and event listeners in `AvatarSession`**
  In `AvatarSession`:
  - Add `private fishingState: FishingRuntimeState`.
  - Wire client events `fishing-start-result`, `fishing-success-result` in `wire(client, epoch)`.
  - When `fishing-success-result` arrives for current user: increment `totalCatches`, update `lastFishId`, update `fishingState.status = 'caught'`, push log `[câu cá] bắt được cá ID ${idFish}!`.
  - In `getRuntimeSnapshot()`: include `fishing: this.fishingState`.

- [ ] **Step 2: Implement `runFishingLoop` in `AvatarSession`**
  When `desiredMode === 'auto_fishing'`:
  - If not in Park context: `client.enterParkContext()`.
  - Join map: `client.park.doJoinPark(config.map, config.area)`.
  - Loop while `this.desiredMode === 'auto_fishing'` and `this.isCurrent(client, epoch)`:
    - Update state `status = 'starting'`.
    - Send `client.startFishing()`.
    - Wait for RX 45 response:
      - If `iss === false`: update state `status = 'rejected'`, `lastError = error`, push log `[câu cá] server từ chối: ${error}`. Delay 10s and retry.
    - If `iss === true`:
      - Update state `status = 'casting'`.
      - Send `client.quanCau()`.
      - Wait for RX 79 / challenge completion or timeout (15s).
      - On challenge completion / fish catch:
        - Send `client.cauCaXong()`.
        - Update state `status = 'resting'`.
        - Delay `config.castDelayMs` (default 3000ms).

- [ ] **Step 3: Wire `auto_fishing` in `switchAutomationMode` and `onOnline`**
  In `switchAutomationMode`: handle `intent.desiredMode === 'auto_fishing'` by canceling farm sync and launching `runFishingLoop`.
  In `onOnline`: if `this.desiredMode === 'auto_fishing'`, resume `runFishingLoop`.

- [ ] **Step 4: Verify TypeScript Compilation**
  Run: `cd avatar-web/server && npm run typecheck`
  Expected: 0 errors.

- [ ] **Step 5: Commit**
  `git commit -m "feat(fishing): implement continuous auto-fishing loop in avatar session"`

---

### Task 4: Frontend Types and Fishing Panel UI

**Files:**
- Modify: `avatar-web/web/src/types.ts`
- Create: `avatar-web/web/src/accounts/panels/FishingPanel.tsx`
- Modify: `avatar-web/web/src/accounts/AccountOperationsDrawer.tsx`

**Interfaces:**
- Consumes: `/api/accounts/:id/auto/mode`, `/api/accounts/:id/auto/config`, account runtime WebSocket state.
- Produces: `FishingPanel` component, `['fishing', 'Câu cá']` tab in drawer.

- [ ] **Step 1: Update `avatar-web/web/src/types.ts`**
  Add `'auto_fishing'` to `AutomationMode`.
  Add `FishingConfig` and `FishingRuntimeState` matching backend contracts.
  Add optional `fishing?: FishingRuntimeState` to `AccountRuntimeSnapshot`.

- [ ] **Step 2: Create `FishingPanel.tsx`**
  Build clean, responsive React component:
  - Header: Trạng thái câu cá (badge), nút Bật Auto Câu Cá / Tắt Auto Câu Cá.
  - Card Cấu hình:
    - Select Map: Map 14 (Khu cá rô - Mặc định), Map 15 (Khu cá lóc), Map 16 (Khu cá mập), Map 27 (Bến tàu).
    - Input Khu vực (Area): 0 đến 15 (mặc định 0).
    - Input Delay: milliseconds (mặc định 3000ms).
  - Card Thống kê & Giám sát:
    - Tổng số cá đã câu (`totalCatches`).
    - Cá vừa bắt được (`lastFishId`).
    - Trạng thái trực tiếp: Đang vào hồ, Đang quăng cần, Đang giải challenge ML, Đã dính cá, Nghỉ.
    - Lỗi gần nhất nếu có (`lastError`).

- [ ] **Step 3: Add Tab to `AccountOperationsDrawer.tsx`**
  Add `['fishing', 'Câu cá']` to `PANEL_TABS`.
  Render `<FishingPanel account={account} runtime={runtime} />` when active.

- [ ] **Step 4: Verify TypeScript Compilation on Web**
  Run: `cd avatar-web/web && npm run build`
  Expected: 0 errors.

- [ ] **Step 5: Commit**
  `git commit -m "feat(fishing): add fishing panel and drawer tab in web ui"`

---

### Task 5: End-to-End Verification & Documentation

**Files:**
- Read/Verify: `avatar-web/server` and `avatar-web/web` runtime logs.

- [ ] **Step 1: Run typecheck across the whole workspace**
  Run: `cd avatar-web/server && npm run typecheck`
  Run: `cd avatar-web/web && npm run build`
  Expected: Both pass with 0 errors.

- [ ] **Step 2: Verify live Web UI on port 5173**
  Verify the drawer renders the "Câu cá" tab and controls.
  Verify switching mode to `auto_fishing` triggers backend logging.

- [ ] **Step 3: Document completed features and hand off to user**
  Update documentation and present results to user.
