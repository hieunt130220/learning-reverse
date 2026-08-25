# Disable Find NPC (Tạm đóng) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tạm đóng toàn bộ chức năng Auto Tìm NPC (`find_npc`) ở 3 điểm vào — API start, bootstrap sau restart, UI drawer — bằng kill-switch flip được.

**Architecture:** Thêm hằng số kill-switch module-level mỗi app (server + web). Server chặn sớm request start `find_npc` trước khi đụng DB/bootstrap; manager lọc bỏ intent `find_npc` khi resume; web không render tab/panel Find NPC. Không đổi schema, không reset `desired_mode`, không sửa runner `autoFindNpc.ts`.

**Tech Stack:** TypeScript, Express (server), React 18 + Vite (web), node:test / vitest.

**Spec:** `docs/superpowers/specs/2026-08-25-disable-find-npc-design.md`

## Global Constraints

- KHÔNG viết test mới, KHÔNG TDD (theo AGENTS.md). Chỉ chạy suite hiện có.
- KHÔNG đổi DB schema, KHÔNG ghi `desired_mode='off'` cho account bị skip.
- Endpoint `/automation/stop` và `PUT /automation/find-npc-config/config` giữ nguyên hành vi.
- Error mới phải thêm vào union `AutomationApiErrorCode` để giữ type-safety của `automationError`/`automationFailure`.
- Trước khi sửa symbol theo quy GitNexus: nếu MCP `gitnexus_impact` khả dụng thì chạy cho `bootstrap` và route handler start; nếu không, đã xác định thủ công caller duy nhất của cả hai là `src/index.ts` (mount routes, gọi `manager.bootstrap()`).
- Trước khi commit chạy `gitnexus_detect_changes({scope:"staged"})` (hoặc rà soát `git status`/`git diff --stat` nếu tool không khả dụng).
- Không thêm comment thừa ngoài những comment thiết kế nêu trong plan.

---

### Task 1: Kill-switch server + error code

**Files:**
- Create: `avatar-web/server/src/session/featureFlags.ts`
- Modify: `avatar-web/server/src/session/automationTypes.ts:70-77`

**Interfaces:**
- Consumes: không
- Produces: `FIND_NPC_DISABLED: boolean` (dùng bởi Task 2, 3); error code `'find-npc-disabled'` (dùng bởi Task 2)

- [ ] **Step 1: Tạo `featureFlags.ts`**

```ts
/**
 * Bật lại tính năng Tìm NPC: đặt thành false rồi deploy/restart server.
 * Xem docs/superpowers/specs/2026-08-25-disable-find-npc-design.md.
 */
export const FIND_NPC_DISABLED = true;
```

- [ ] **Step 2: Thêm error code vào `AutomationApiErrorCode`**

Trong `avatar-web/server/src/session/automationTypes.ts`, sửa union thành:

```ts
export type AutomationApiErrorCode =
  | 'invalid-automation-mode'
  | 'invalid-find-npc-config'
  | 'find-npc-name-required'
  | 'catalog-unverified'
  | 'find-npc-disabled'
  | 'revision-conflict'
  | 'automation-connect-pending'
  | 'automation-start-failed';
```

- [ ] **Step 3: Verify compile**

Run: `cd avatar-web/server && npm run typecheck`
Expected: exit 0, không lỗi mới.

### Task 2: Chặn API start mode `find_npc`

**Files:**
- Modify: `avatar-web/server/src/session/routes.ts:26,246-247`

**Interfaces:**
- Consumes: `FIND_NPC_DISABLED` (Task 1), `'find-npc-disabled'` (Task 1)
- Produces: HTTP response `503 {"error":"Tính năng Tìm NPC đang tạm đóng","code":"find-npc-disabled"}`

- [ ] **Step 1: Import kill-switch**

Thêm vào import block (cùng nhóm với `./manager.js`):

```ts
import { FIND_NPC_DISABLED } from './featureFlags.js';
```

- [ ] **Step 2: Short-circuit trước `serializeAutomation`**

Trong handler `POST /:id/automation/start`, ngay sau `const mode = req.body.mode;` (routes.ts:247), thêm:

```ts
if (mode === 'find_npc' && FIND_NPC_DISABLED) {
  automationError(res, 503, 'find-npc-disabled', 'Tính năng Tìm NPC đang tạm đóng');
  return;
}
```

Đặt TRƯỚC khối `try { serializeAutomation(...) }` vì chưa đọc/ghi gì DB nên không cần serialize; các mode khác đi đường cũ nguyên vẹn.

- [ ] **Step 3: Verify**

Run: `cd avatar-web/server && npm run typecheck`
Expected: exit 0.

### Task 3: Bootstrap bỏ qua `find_npc`

**Files:**
- Modify: `avatar-web/server/src/session/manager.ts:204-206`
- Modify: `avatar-web/server/src/session/manager.ts:1-20` (chỉ thêm import)

**Interfaces:**
- Consumes: `FIND_NPC_DISABLED` (Task 1)
- Produces: `bootstrap()` chỉ resume account `auto_farm` khi flag bật; log warn một dòng liệt kê account bị bỏ qua

- [ ] **Step 1: Thêm import**

```ts
import { FIND_NPC_DISABLED } from './featureFlags.js';
```

- [ ] **Step 2: Sửa đầu `bootstrap()`**

Thay:

```ts
async bootstrap(): Promise<void> {
    const entries = listDesiredAutomation(this.deps.db);
    if (entries.length === 0) return;
```

bằng:

```ts
async bootstrap(): Promise<void> {
    const desired = listDesiredAutomation(this.deps.db);
    const entries = FIND_NPC_DISABLED
      ? desired.filter((entry) => entry.intent.desiredMode !== 'find_npc')
      : desired;
    if (entries.length !== desired.length) {
      const skippedIds = desired
        .filter((entry) => entry.intent.desiredMode === 'find_npc')
        .map((entry) => entry.accountId)
        .join(', #');
      console.warn(`bootstrap bỏ qua find_npc (tạm đóng): #${skippedIds}`);
    }
    if (entries.length === 0) return;
```

Phần thân còn lại (`startAt`, stagger) giữ nguyên. Không ghi DB → khi bật lại flag, account tự resume như cũ.

- [ ] **Step 3: Verify**

Run: `cd avatar-web/server && npm run typecheck && npm test`
Expected: typecheck pass; suite hiện có pass (các test bootstrap dùng auto_farm nên không bị ảnh hưởng).

### Task 4: Web ẩn tab & panel "Tìm NPC"

**Files:**
- Modify: `avatar-web/web/src/accounts/AccountOperationsDrawer.tsx:18-28,128-136,142,186-195`

**Interfaces:**
- Consumes: không (hằng số local)
- Produces: drawer không hiển thị tab/panel `find_npc`; keyboard nav khớp danh sách tab hiển thị

- [ ] **Step 1: Thêm flag + danh sách tab hiển thị**

Ngay dưới `type PanelId = ...` (sau dòng 28):

```ts
const FIND_NPC_TAB_HIDDEN = true;

const VISIBLE_TABS = PANEL_TABS.filter(
  ([id]) => !(id === 'find_npc' && FIND_NPC_TAB_HIDDEN),
) as Array<(typeof PANEL_TABS)[number]>;
```

Giữ nguyên `PANEL_TABS` và type `PanelId` (logic khác còn dùng).

- [ ] **Step 2: Tabbar + arrow-nav dùng `VISIBLE_TABS`**

- Dòng 142: `{PANEL_TABS.map(([id, label], index) => (` → `{VISIBLE_TABS.map(([id, label], index) => (`
- Trong `handleTabKeyDown` (dòng 129-135): thay `PANEL_TABS.length` → `VISIBLE_TABS.length` và `const [nextPanel] = PANEL_TABS[nextIndex];` → `const [nextPanel] = VISIBLE_TABS[nextIndex];`

- [ ] **Step 3: Bọc điều kiện panel slot**

Dòng 186-195, bọc div `drawer-panel-find_npc`:

```tsx
{!FIND_NPC_TAB_HIDDEN && (
  <div id="drawer-panel-find_npc" className="drawer-panel-slot" role={isMobile ? 'tabpanel' : undefined} aria-labelledby={isMobile ? 'drawer-tab-find_npc' : undefined} hidden={!visible('find_npc')}>
    <FindNpcPanel
      accountId={account.id}
      automation={automation}
      onDirtyChange={onFindNpcDirtyChange}
      automationMutationBusy={automationMutationBusy}
      onAutomationMutationBusyChange={setAutomationMutationBusy}
      onAutomationCapabilityChange={handleAutomationCapabilityChange}
    />
  </div>
)}
```

Không xóa wiring `dirtySources.findNpc`/`onFindNpcDirtyChange` — panel không mount thì cờ không bao giờ dirty; bật lại chỉ cần flip flag.

- [ ] **Step 4: Verify**

Run: `cd avatar-web/web && npm run build`
Expected: `tsc -b` + vite build thành công.

### Task 5: Kiểm thử tích hợp & commit

**Files:**
- Modify: none (verification only)

- [ ] **Step 1: Full verify cả hai app**

Run:
```bash
cd avatar-web/server && npm run typecheck && npm test
cd avatar-web/web && npm run build && npm test
```
Expected: tất cả pass.

- [ ] **Step 2: Rà soát phạm vi thay đổi**

Run: `git status && git diff --stat` (và `gitnexus_detect_changes({scope:"staged"})` sau khi stage nếu tool khả dụng)
Expected: đúng 5 file (4 modify + 1 create), không file lạ.

- [ ] **Step 3: Commit**

```bash
git add avatar-web/server/src/session/featureFlags.ts \
  avatar-web/server/src/session/automationTypes.ts \
  avatar-web/server/src/session/routes.ts \
  avatar-web/server/src/session/manager.ts \
  avatar-web/web/src/accounts/AccountOperationsDrawer.tsx
git commit -m "feat: tam dong chuc nang auto tim NPC qua kill-switch"
```

- [ ] **Step 4: Cập nhật index GitNexus (nếu dự án yêu cầu)**

Run: `npx gitnexus analyze`
Expected: index cập nhật, không lỗi.
