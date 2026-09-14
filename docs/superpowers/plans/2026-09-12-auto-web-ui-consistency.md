# Auto Web UI Consistency Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Unify tokens, improve glanceability and feedback without changing product IA.

**Architecture:** CSS token expansion + small React components; no new deps, no API changes.

**Tech Stack:** React 18, plain CSS, existing vitest setup.

**Spec:** `docs/superpowers/specs/2026-09-12-auto-web-ui-consistency-design.md`

## Global Constraints
- Match existing dark ops aesthetic; no new brand
- Vietnamese UI copy
- Do not invent server fields (no dirty flag on dashboard API)
- Keep existing tests green; update only if selectors intentionally change

### Task 1: Tokens + badges + focus

**Files:** Modify `avatar-web/web/src/styles.css`

- [ ] Expand `:root` with raised/muted surfaces, warn, semantic bg
- [ ] Map one-off hexes to tokens where low-risk
- [ ] Global `button:hover` + `:focus-visible`
- [ ] Badge styles: connecting/handshaking/logging-in (accent), idle (default)

### Task 2: StatusBanner + StatusPanel

**Files:** Create `StatusBanner.tsx`; Modify `StatusPanel.tsx`, `styles.css`

- [ ] `StatusBanner` tone: info|success|warn|error; optional action
- [ ] Replace StatusPanel error/sync messages with banner
- [ ] CSS `.status-banner`

### Task 3: Dashboard fleet strip

**Files:** Modify `AccountCard.tsx`, `AccountStatus.tsx`, `styles.css`

- [ ] `automationModeLabel(mode)` helper
- [ ] Card shows mode chip + cycle / last-run / switching state
- [ ] CSS for mode chip

### Task 4: AutoFarm sticky save + section dirty

**Files:** Modify `AutoFarmPanel.tsx`, `styles.css`

- [ ] Per-section dirty computed from draft vs stored
- [ ] Section h3 shows dirty marker
- [ ] Sticky save row (position sticky bottom) with StatusBanner for notice/error/conflict

### Task 5: Log filter

**Files:** Modify `LogPanel.tsx`, `styles.css`

- [ ] Filter input, case-insensitive substring
- [ ] Show match count; empty state when filtered out

### Task 6: Verify

- [ ] Run web tests + build
- [ ] Self-review contrast/focus/copy
