# Accounts Drawer UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the six approved accounts-drawer UI corrections for automation controls, checkbox layout, asset spacing, market naming, and slot-unlock visibility.

**Architecture:** Keep all behavioral contracts intact and change presentation at the narrowest existing component boundary. Use component-scoped CSS classes for responsive fixes, a shop-only display-name override for market item ID `200`, and remove only the frontend slot-unlock entry point and its now-dead local code.

**Tech Stack:** React 18, TypeScript 5.7, CSS, Vite 6, GitNexus CLI/MCP, browser smoke testing.

**Spec:** `docs/superpowers/specs/2026-09-10-accounts-drawer-ui-polish-design.md`

## Global Constraints

- Do not use TDD and do not create new test files; the user did not request tests.
- Do not change backend APIs, protocol decoding, cache data, persistence, automation payloads, or revision/conflict handling.
- Preserve the separate `Bắt đầu` action: selecting an automation mode must not start it.
- Keep native checkbox semantics for auto-sell and fishing settings.
- Apply ID `200` → `Ngô` only in `ShopPanel`; do not change the shared item/produce catalog.
- Remove only the frontend slot-unlock UI/state/handler; keep backend capability and transaction contracts intact.
- Run GitNexus upstream impact analysis before editing every named function/component; warn before editing if any result is HIGH or CRITICAL.
- Preserve unrelated dirty changes in `AGENTS.md` and `CLAUDE.md`.
- Do not stage or commit unless the user explicitly authorizes a commit. Commit steps below are gated and must be marked skipped when authorization is absent.
- Before any build, verify at least 15 GiB free with `df -h` and inspect task artifact sizes with `du -sh`; reuse `avatar-web/web/dist` and existing dependency caches rather than creating duplicate build directories.

---

### Task 1: Replace Automation Mode Checkboxes with Buttons

**Files:**
- Modify: `avatar-web/web/src/accounts/panels/StatusPanel.tsx:183-202`
- Modify: `avatar-web/web/src/styles.css:139-152`

**Interfaces:**
- Consumes: existing `selectedMode: 'auto_farm' | 'auto_fishing'`, `controlsLocked: boolean`, and `setSelectedMode(mode)` state setter inside `StatusPanel`.
- Produces: `.automation-mode-selector` group and `.automation-mode-button` buttons with `aria-pressed: boolean`; no API or prop changes.

- [x] **Step 1: Check the blast radius before editing**

Run GitNexus upstream impact analysis for `StatusPanel` in repository `learning-reverse`.

Expected: direct use remains within `AccountOperationsDrawer`; if risk is HIGH or CRITICAL, stop and report the callers/processes before editing.

- [x] **Step 2: Replace the checkbox markup with exclusive mode buttons**

Replace the current `label.inline` checkbox pair with:

```tsx
<div className="row automation-mode-selector" role="group" aria-label="Chọn chế độ tự động">
  <button
    type="button"
    className={`automation-mode-button${selectedMode === 'auto_farm' ? ' active' : ''}`}
    aria-pressed={selectedMode === 'auto_farm'}
    disabled={controlsLocked}
    onClick={() => setSelectedMode('auto_farm')}
  >
    Auto Farm
  </button>
  <button
    type="button"
    className={`automation-mode-button${selectedMode === 'auto_fishing' ? ' active' : ''}`}
    aria-pressed={selectedMode === 'auto_fishing'}
    disabled={controlsLocked}
    onClick={() => setSelectedMode('auto_fishing')}
  >
    Auto Fishing
  </button>
</div>
```

- [x] **Step 3: Add component-scoped button styling**

Add near the shared button/row rules in `styles.css`:

```css
.automation-mode-selector {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  width: min(100%, 360px);
}

.automation-mode-button {
  min-width: 0;
  border: 1px solid var(--line);
  background: transparent;
  color: var(--muted);
}

.automation-mode-button.active {
  border-color: var(--accent);
  background: var(--accent);
  color: #0d1017;
}

.automation-mode-button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

- [x] **Step 4: Inspect the focused diff**

Run:

```bash
git diff -- avatar-web/web/src/accounts/panels/StatusPanel.tsx avatar-web/web/src/styles.css
git diff --check -- avatar-web/web/src/accounts/panels/StatusPanel.tsx avatar-web/web/src/styles.css
```

Expected: only mode-selector markup/styles changed; `startAuto`, `stopAuto`, API calls, and progress copy remain untouched; whitespace check exits 0.

- [x] **Step 5: Commit only with explicit authorization — skipped because no commit was requested**

If the user has explicitly requested commits:

```bash
git add avatar-web/web/src/accounts/panels/StatusPanel.tsx avatar-web/web/src/styles.css
git diff --cached --check
git commit -m "fix(avatar-web): highlight automation mode controls"
```

Otherwise mark this step skipped and leave the files unstaged.

---

### Task 2: Repair Auto-Sell and Fishing Checkbox Layouts

**Files:**
- Modify: `avatar-web/web/src/accounts/AutoSellRulesEditor.tsx:123-134`
- Modify: `avatar-web/web/src/accounts/panels/FishingSettingsPanel.tsx:245-275`
- Modify: `avatar-web/web/src/styles.css:1563-1590`

**Interfaces:**
- Consumes: `autoSellProduce`, `disabled`, `onChange`, `autoBuyTicket`, `isFishing`, `selectedMap`, and `getTicketHint(mapId)` exactly as currently defined.
- Produces: `.auto-sell-checkbox-label` with correctly sized native input plus `.fishing-ticket-control`, `.fishing-ticket-label`, and `.fishing-ticket-hint` layout classes; no state or payload changes.

- [x] **Step 1: Check both component blast radii before editing**

Run GitNexus upstream impact analysis for `AutoSellRulesEditor` and `FishingSettingsPanel` in repository `learning-reverse`.

Expected: callers remain in the accounts settings flow; stop and report before editing if either risk is HIGH or CRITICAL.

- [x] **Step 2: Normalize the auto-sell checkbox within its existing class**

Keep the JSX and callback unchanged. Extend its CSS:

```css
.auto-sell-checkbox-label {
  min-width: 0;
  margin: 0;
}

.auto-sell-checkbox-label input[type='checkbox'] {
  flex: 0 0 auto;
  width: auto;
  margin: 0;
  padding: 0;
}

.auto-sell-checkbox-label span {
  min-width: 0;
}
```

Merge these declarations into the existing rule where possible instead of duplicating it.

- [x] **Step 3: Replace the fishing ticket inline layout with named classes**

Replace only the first ticket-control block with:

```tsx
<div className="fishing-ticket-control">
  <label className={`fishing-ticket-label${isFishing ? ' disabled' : ''}`}>
    <input
      type="checkbox"
      checked={autoBuyTicket}
      onChange={(e) => setAutoBuyTicket(e.target.checked)}
      disabled={isFishing}
    />
    <span>Tự động mua vé câu theo hồ</span>
  </label>
  <div className={`fishing-ticket-hint${selectedMap === 16 ? ' warning' : ''}`}>
    {getTicketHint(selectedMap)}
  </div>
</div>
```

Do not change `getTicketHint`, boolean state, or disabled conditions.

- [x] **Step 4: Add the fishing ticket layout CSS**

Add near `.setting-section` rules:

```css
.fishing-ticket-control {
  display: grid;
  gap: 0.35rem;
}

.fishing-ticket-label {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  color: var(--muted);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
}

.fishing-ticket-label.disabled {
  cursor: not-allowed;
}

.fishing-ticket-label input[type='checkbox'] {
  flex: 0 0 auto;
  width: auto;
  margin: 0;
  padding: 0;
}

.fishing-ticket-label span {
  min-width: 0;
}

.fishing-ticket-hint {
  margin-left: 1.4rem;
  color: var(--muted);
  font-size: 0.8rem;
  overflow-wrap: anywhere;
}

.fishing-ticket-hint.warning {
  color: #e3b341;
}
```

- [x] **Step 5: Inspect the focused diff**

Run:

```bash
git diff -- avatar-web/web/src/accounts/AutoSellRulesEditor.tsx avatar-web/web/src/accounts/panels/FishingSettingsPanel.tsx avatar-web/web/src/styles.css
git diff --check -- avatar-web/web/src/accounts/AutoSellRulesEditor.tsx avatar-web/web/src/accounts/panels/FishingSettingsPanel.tsx avatar-web/web/src/styles.css
```

Expected: event handlers and state expressions are byte-for-byte equivalent in behavior; only markup classes and CSS layout change; whitespace check exits 0.

- [x] **Step 6: Commit only with explicit authorization — skipped because no commit was requested**

If the user has explicitly requested commits:

```bash
git add avatar-web/web/src/accounts/AutoSellRulesEditor.tsx avatar-web/web/src/accounts/panels/FishingSettingsPanel.tsx avatar-web/web/src/styles.css
git diff --cached --check
git commit -m "fix(avatar-web): align drawer checkbox controls"
```

Otherwise mark this step skipped and leave the files unstaged.

---

### Task 3: Add Spacing Between Asset Sections

**Files:**
- Modify: `avatar-web/web/src/accounts/panels/AssetsPanel.tsx:35-65`
- Modify: `avatar-web/web/src/styles.css:552-558`

**Interfaces:**
- Consumes: existing `FarmSection`, `KhoSection`, and `AnimalSection` render contracts.
- Produces: `.assets-panel-stack` wrapper; `AssetsPanel` props and child props stay unchanged.

- [x] **Step 1: Check the component blast radius before editing**

Run GitNexus upstream impact analysis for `AssetsPanel` in repository `learning-reverse`.

Expected: the direct consumer is `AccountOperationsDrawer`; stop and report before editing if risk is HIGH or CRITICAL.

- [x] **Step 2: Replace the root fragment with a layout container**

Change only the return wrapper:

```tsx
return (
  <div className="assets-panel-stack">
    <FarmSection farm={farm} trees={trees} />
    <KhoSection
      inventory={inventory}
      produce={produce}
      trees={trees}
      items={items}
      animals={animals}
    />
    <AnimalSection farm={farm} catalog={animals} />
  </div>
);
```

- [x] **Step 3: Add stack spacing**

Add near drawer panel rules:

```css
.assets-panel-stack {
  display: grid;
  gap: 16px;
}
```

- [x] **Step 4: Inspect the focused diff**

Run:

```bash
git diff -- avatar-web/web/src/accounts/panels/AssetsPanel.tsx avatar-web/web/src/styles.css
git diff --check -- avatar-web/web/src/accounts/panels/AssetsPanel.tsx avatar-web/web/src/styles.css
```

Expected: all child props and conditional `AnimalSection` behavior remain unchanged; whitespace check exits 0.

- [x] **Step 5: Commit only with explicit authorization — skipped because no commit was requested**

If the user has explicitly requested commits:

```bash
git add avatar-web/web/src/accounts/panels/AssetsPanel.tsx avatar-web/web/src/styles.css
git diff --cached --check
git commit -m "fix(avatar-web): space asset panel sections"
```

Otherwise mark this step skipped and leave the files unstaged.

---

### Task 4: Correct Shop Produce Name and Remove Slot-Unlock UI

**Files:**
- Modify: `avatar-web/web/src/accounts/panels/ShopPanel.tsx:40-49,94-100,116-128,308-323,467-477`

**Interfaces:**
- Consumes: raw market/listing `itemId: number`, the existing `nameById: Map<number, string>`, and all shop read/write flows other than slot unlock.
- Produces: `SHOP_PRODUCE_NAME_OVERRIDES: Readonly<Record<number, string>>` with `200: 'Ngô'`; updated local `itemName(itemId)`; no new exported interface.

- [x] **Step 1: Check the panel and helper blast radii before editing**

Run GitNexus upstream impact analysis for `ShopPanel` and `itemName` in repository `learning-reverse`.

Expected: `itemName` references are internal to `ShopPanel`; stop and report before editing if either risk is HIGH or CRITICAL.

- [x] **Step 2: Add a shop-context display-name override**

Add after `STATUS_LABELS`:

```tsx
const SHOP_PRODUCE_NAME_OVERRIDES: Readonly<Record<number, string>> = {
  200: 'Ngô',
};
```

Update the local resolver to prefer the override:

```tsx
const itemName = (itemId: number) => (
  SHOP_PRODUCE_NAME_OVERRIDES[itemId]
  ?? nameById.get(itemId)
  ?? `#${itemId}`
);
```

This ensures catalog ID `200` is shown as `Ngô` even when the generic items catalog contains `Phân bón giảm 60 phút` for the same numeric ID.

- [x] **Step 3: Remove dead slot-unlock local state**

Delete only:

```tsx
const [unlockType, setUnlockType] = useState('0');
```

Keep `ShopTab`, `TRANSACTION_LABELS.unlock`, capabilities, and all other state.

- [x] **Step 4: Remove the slot-unlock handler**

Delete the complete local `async function unlockSlot()` block from `ShopPanel`. Do not remove `submitWrite`, purchase, withdraw, paid refresh, or backend routes.

- [x] **Step 5: Remove the slot-unlock JSX section**

Delete only:

```tsx
{shop?.own?.data.canOpenSlot && (
  <div className="shop-paid-action">
    <label>Loại mở slot <input value={unlockType} onChange={(event) => setUnlockType(event.target.value)} inputMode="numeric" /></label>
    <button
      type="button"
      disabled={!baseWriteReady || capabilities?.slotUnlockEnabled !== true}
      onClick={() => void unlockSlot()}
    >Mở slot</button>
    <span className="hint">Chỉ bật khi backend đã xác minh loại/chi phí live.</span>
  </div>
)}
```

Keep `.shop-paid-action` CSS because the paid market-refresh section still uses it.

- [x] **Step 6: Prove slot-unlock references were removed only from this frontend panel**

Run:

```bash
rg -n "unlockType|unlockSlot|Loại mở slot|Mở slot" avatar-web/web/src/accounts/panels/ShopPanel.tsx
rg -n "shop-paid-action" avatar-web/web/src/accounts/panels/ShopPanel.tsx avatar-web/web/src/styles.css
git diff --check -- avatar-web/web/src/accounts/panels/ShopPanel.tsx
```

Expected: first command has no matches; second still finds the paid-refresh JSX and shared CSS; whitespace check exits 0.

- [x] **Step 7: Commit only with explicit authorization — skipped because no commit was requested**

If the user has explicitly requested commits:

```bash
git add avatar-web/web/src/accounts/panels/ShopPanel.tsx
git diff --cached --check
git commit -m "fix(avatar-web): simplify shop controls and naming"
```

Otherwise mark this step skipped and leave the file unstaged.

---

### Task 5: Build, Scope Audit, and Browser Verification

**Files:**
- Verify: `avatar-web/web/src/accounts/panels/StatusPanel.tsx`
- Verify: `avatar-web/web/src/accounts/AutoSellRulesEditor.tsx`
- Verify: `avatar-web/web/src/accounts/panels/FishingSettingsPanel.tsx`
- Verify: `avatar-web/web/src/accounts/panels/AssetsPanel.tsx`
- Verify: `avatar-web/web/src/accounts/panels/ShopPanel.tsx`
- Verify: `avatar-web/web/src/styles.css`

**Interfaces:**
- Consumes: completed Tasks 1-4 and the running local page `/accounts/3`.
- Produces: current build evidence, GitNexus affected-scope report, mobile/desktop browser-smoke evidence, and an explicit cleanup report.

- [x] **Step 1: Verify disk capacity and artifact ownership before build**

Run:

```bash
df -h /Users/devios/learning-reverse
du -sh avatar-web/web/dist avatar-web/web/node_modules .gitnexus 2>/dev/null
```

Expected: at least 15 GiB free. Reuse `avatar-web/web/dist`; do not create a second output or scratch build directory.

- [x] **Step 2: Build the frontend once on the final source**

Run:

```bash
npm run build
```

Working directory: `avatar-web/web`

Expected: `tsc -b && vite build` exits 0. This is build/typecheck evidence, not automated test-suite evidence.

- [x] **Step 3: Run final whitespace and scope checks**

Run:

```bash
git diff --check
git status --short
```

Then run GitNexus `detect_changes` with scope `all` in repository `learning-reverse`.

Expected: only the six approved production files plus the approved spec/plan are reported for this task; pre-existing `AGENTS.md` and `CLAUDE.md` remain unrelated and unstaged.

- [x] **Step 4: Verify the mobile UI at 656×1250**

Open or refresh `http://localhost:5173/accounts/3` and inspect all affected tabs. Confirm:

1. `Auto Farm` and `Auto Fishing` render as two clear buttons; exactly one has active styling and `aria-pressed="true"`.
2. Clicking the inactive mode changes selection but does not invoke `Bắt đầu` automatically.
3. `Tự động bán trên sạp` has a natural-size checkbox and readable label.
4. `Tự động mua vé câu theo hồ` aligns with its checkbox; the ticket hint sits below without overlap, including `⚠️ Tiêu Lượng` for Map 16.
5. `Nông trại`, `Kho`, and `Vật nuôi` have visible 16 px separation.
6. Market entry ID `200` reads `Ngô` instead of `Phân bón giảm 60 phút`.
7. `Sạp của tôi` contains no `Loại mở slot` field or `Mở slot` button.

Expected: all seven checks pass without clipped text or horizontal overflow introduced by this change.

- [x] **Step 5: Verify the desktop breakpoint**

Repeat the affected-panel smoke at a viewport width of at least 680 px.

Expected: button group, checkbox controls, asset stack, market table, and paid-refresh section retain valid desktop layout.

- [x] **Step 6: Clean owned intermediate artifacts and report retained output**

Because the task reuses the existing `avatar-web/web/dist`, do not delete it unless ownership is proven to belong exclusively to this task. Remove no shared cache. Re-run:

```bash
df -h /Users/devios/learning-reverse
du -sh avatar-web/web/dist avatar-web/web/node_modules .gitnexus 2>/dev/null
```

Expected: report post-verification free space, state that no task-owned duplicate build/cache was created, and list `avatar-web/web/dist` as the retained build output with its measured size.

- [x] **Step 7: Commit the combined change only if separately authorized — skipped because no commit was requested**

Use this single scoped commit instead of per-task commits when Tasks 1-4 were intentionally left unstaged:

```bash
git add \
  avatar-web/web/src/accounts/panels/StatusPanel.tsx \
  avatar-web/web/src/accounts/AutoSellRulesEditor.tsx \
  avatar-web/web/src/accounts/panels/FishingSettingsPanel.tsx \
  avatar-web/web/src/accounts/panels/AssetsPanel.tsx \
  avatar-web/web/src/accounts/panels/ShopPanel.tsx \
  avatar-web/web/src/styles.css \
  docs/superpowers/specs/2026-09-10-accounts-drawer-ui-polish-design.md \
  docs/superpowers/plans/2026-09-10-accounts-drawer-ui-polish.md
git diff --cached --name-only
git diff --cached --check
git commit -m "fix(avatar-web): polish account drawer controls"
```

Expected staged paths are exactly the eight paths listed above. Never stage `AGENTS.md` or `CLAUDE.md`.
