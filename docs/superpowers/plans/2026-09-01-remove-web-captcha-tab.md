# Remove Web Captcha Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the Captcha tab from the account operations web drawer while preserving Captcha collection backend behavior.

**Architecture:** Make a UI-only change in `AccountOperationsDrawer` by removing the Captcha tab declaration, its import, and its conditional-independent render block. Keyboard and mobile navigation already derive from `VISIBLE_TABS`, so the removed tab disappears automatically.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-01-remove-web-captcha-tab-design.md`

## Global Constraints

- UI-only change; do not modify server code, API routes, WebSocket events, or `CaptchaPanel.tsx`.
- Preserve the remaining tab order: Status, Autofarm, Quests, Cooking, Assets, Shop, Logs.
- Do not add test files because tests were not requested.
- No `TODO`, `TBD`, or placeholder implementation.
- Run GitNexus impact analysis before editing production code.
- Run GitNexus graph change analysis before committing.

### Task 1: Remove Captcha Tab From Operations Drawer

**Files:**
- Modify: `avatar-web/web/src/accounts/AccountOperationsDrawer.tsx:11`
- Modify: `avatar-web/web/src/accounts/AccountOperationsDrawer.tsx:19-29`
- Modify: `avatar-web/web/src/accounts/AccountOperationsDrawer.tsx:239-241`

**Interfaces:**
- Consumes: `PANEL_TABS` and `VISIBLE_TABS` constants in `AccountOperationsDrawer`.
- Produces: Operations drawer without a Captcha tab; mobile tabbar and keyboard navigation use the remaining seven tabs.

- [x] **Step 1: Run pre-edit impact analysis**

Run:

```bash
node /private/tmp/gitnexus-native-probe.47OFES/node_modules/.pnpm/gitnexus@1.6.10_graphology-types@0.24.8_zod@4.5.4/node_modules/gitnexus/dist/cli/index.js impact 'AccountOperationsDrawer' --direction upstream --repo /Users/hieunt/learning-reverse
```

Expected: `risk: LOW`; upstream contains `App` and `main.tsx`.

- [x] **Step 2: Remove Captcha UI wiring**

In `AccountOperationsDrawer.tsx`, remove:

```tsx
import { CaptchaPanel } from './panels/CaptchaPanel.js';
```

Remove from `PANEL_TABS`:

```tsx
['captcha', 'Captcha'],
```

Remove render block:

```tsx
<div id="drawer-panel-captcha" className="drawer-panel-slot" role={isMobile ? 'tabpanel' : undefined} aria-labelledby={isMobile ? 'drawer-tab-captcha' : undefined} hidden={!visible('captcha')}>
  <CaptchaPanel accountId={account.id} />
</div>
```

- [x] **Step 3: Verify source references**

Run:

```bash
rg -n 'CaptchaPanel|drawer-tab-captcha|drawer-panel-captcha' avatar-web/web/src/accounts/AccountOperationsDrawer.tsx || true
```

Expected: no output; `CaptchaPanel.tsx` remains unchanged and available.

- [x] **Step 4: Build and run existing web tests**

Run from `avatar-web/web`:

```bash
pnpm build
pnpm test -- --run
```

Expected: TypeScript/Vite build succeeds and all existing web tests pass without adding test files.

- [x] **Step 5: Commit**

Run GitNexus graph change analysis first:

```bash
node /private/tmp/gitnexus-native-probe.47OFES/node_modules/.pnpm/gitnexus@1.6.10_graphology-types@0.24.8_zod@4.5.4/node_modules/gitnexus/dist/cli/index.js detect-changes --scope all --repo /Users/hieunt/learning-reverse
```

Expected: clean result with no `partial: true` or `truncated: true`; affected scope limited to web UI.

Then commit:

```bash
git add docs/superpowers/specs/2026-09-01-remove-web-captcha-tab-design.md docs/superpowers/plans/2026-09-01-remove-web-captcha-tab.md avatar-web/web/src/accounts/AccountOperationsDrawer.tsx
git commit -m "fix: remove captcha tab from web"
```
