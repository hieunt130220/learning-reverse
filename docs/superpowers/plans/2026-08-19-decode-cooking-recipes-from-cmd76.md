# Decode Cooking Recipes From Cmd 76 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decode the server-provided Cmd 76 food catalog safely and make backend, auto-cooking, and web UI use that dynamic catalog without unsafe recipe fallbacks.

**Architecture:** Keep wire decoding in `farmData.ts` behind a bounded cursor API, publish only fully validated catalogs through the existing GameClient/session snapshot path, and make consumers distinguish “catalog not received” from “catalog received empty/invalid.” AutoFarm and UI will resolve recipe IDs only against the dynamic catalog.

**Tech Stack:** TypeScript, Node.js, React, WebSocket session snapshots, Vitest/Jest project runner as already configured.

**Spec:** `docs/superpowers/specs/2026-08-19-decode-cooking-recipes-from-cmd76-design.md`

## Global Constraints

- Cmd 76 is the only source of truth for recipe values; do not invent replacement recipes.
- Preserve raw packet captures and write decode evidence separately; never overwrite originals.
- Do not change Cmd 91/92/93 wire operations or unrelated farm/animal logic.
- Follow project no-TDD policy: production changes first; add tests only after implementation and only for requested verification.
- Run GitNexus impact analysis before editing symbols and `gitnexus_detect_changes` before any commit.

---

### Task 1: Harden the Cmd 76 Food Catalog Decoder

**Files:**
- Modify: `avatar-web/server/src/game/farmData.ts`
- Modify: `avatar-web/server/src/game/client.ts` only where the existing Cmd 76 decode is invoked
- Create: `avatar-re/notes/cmd76-food-catalog-decode.md` for packet schema/offset evidence

**Interfaces:**
- Consumes: raw Cmd 76 farm-data bytes and existing `FoodRecipe` type.
- Produces: a bounded decoder such as `decodeFoodCatalog(input: Uint8Array, offset: number): { recipes: FoodRecipe[]; nextOffset: number }` plus explicit decode error/status; no partial catalog is returned as valid.

- [x] **Step 1: Run GitNexus impact analysis for the decoder and existing Cmd 76 handler**
  Run the repository GitNexus impact command for `decodeFoodCatalog`, `FarmData`, and the existing `readTreeInfo`/handler symbol (or document unavailable MCP and use direct callers from `rg`). Record direct callers and risk before editing.

- [x] **Step 2: Implement bounded cursor reads and validation**
  Reuse the existing big-endian packet conventions. Validate the two-byte UTF length before slicing, cap `totalFoods` and `numMaterials` to finite protocol-safe limits, reject truncated records, and return a structured invalid result without advancing the live catalog on failure.

- [x] **Step 3: Wire the decoder into the current Cmd 76 farm-data path**
  Decode the catalog at the exact offset after the existing tree/animal fields, replace the catalog only after all records and the expected packet boundary validate, and emit a catalog update event or state change through the current client mechanism.

- [x] **Step 4: Record evidence and run focused type/build checks**
  Document the confirmed field order, cursor offsets, and the packet sample/source used. Run the server’s existing typecheck/build command and `git diff --check`; expected result is no TypeScript errors and clean diff whitespace.

### Task 2: Remove Unsafe Static Recipe Authority

**Files:**
- Modify: `avatar-web/server/src/game/client.ts`
- Modify: `avatar-web/server/src/session/avatarSession.ts`
- Modify: `avatar-web/server/src/session/routes.ts` or the existing snapshot route if needed
- Modify: `avatar-web/server/src/game/farmData.ts`

**Interfaces:**
- Consumes: validated catalog update from Task 1.
- Produces: snapshot field with explicit catalog readiness/status and dynamic `FoodRecipe[]` shared by all consumers.

- [x] **Step 1: Initialize recipe state as not-yet-received**
  Replace eager use of `DEFAULT_FOOD_CATALOG` as runtime truth with an empty/not-ready state while preserving type compatibility for existing snapshots.

- [x] **Step 2: Publish only validated updates**
  Add the catalog field/status to the existing session snapshot/event flow without changing unrelated snapshot contracts. On decode failure, retain the last valid catalog and expose a warning/status rather than replacing it with partial records.

- [x] **Step 3: Remove or quarantine fallback exports from active consumers**
  Keep legacy constants only if other non-runtime tooling requires them, but ensure no production path imports them as a recipe source when the dynamic catalog is unavailable.

- [x] **Step 4: Run focused server build and snapshot checks**
  Verify a new session starts with `catalogReady: false`, a valid Cmd 76 update becomes ready, and an invalid packet does not erase the last valid catalog.

### Task 3: Make Auto-Cooking Catalog-Safe

**Files:**
- Modify: `avatar-web/server/src/autoFarm.ts`
- Modify: `avatar-web/server/src/accounts/autoConfig.ts` only if current DTO typing rejects catalog status

**Interfaces:**
- Consumes: dynamic `FoodRecipe[]`, catalog readiness/status, `cookingSlotPlan`, and current inventory state.
- Produces: cook commands only for recipe IDs present in the validated dynamic catalog, with actionable skip logs when unavailable.

- [x] **Step 1: Run GitNexus impact analysis for `AutoFarm.runCycle` and recipe resolution helpers**
  Record direct callers and risk before editing; warn if the graph reports HIGH/CRITICAL.

- [x] **Step 2: Replace fallback resolution with dynamic lookup**
  Resolve configured `recipeId` using the current catalog map. If the catalog is not ready, skip the cooking action and log that Cmd 76 data has not arrived. If the ID is missing, skip and log the unknown ID; never select index zero or a static recipe.

- [x] **Step 3: Preserve existing harvest/skip behavior**
  Keep automatic harvest and explicit `action: 'skip'` semantics unchanged, limiting this task to recipe authority and diagnostics.

- [x] **Step 4: Run focused autoFarm verification after production changes**
  Add/update tests only now (not test-first) for catalog-not-ready, unknown recipe ID, and valid dynamic recipe selection; run the focused server test command and report pass/fail separately from build evidence.

### Task 4: Make Web UI Reflect Dynamic Catalog Readiness

**Files:**
- Modify: `avatar-web/web/src/accounts/panels/CookingPanel.tsx`
- Modify: `avatar-web/web/src/accounts/kitchenPlan.ts`
- Modify: `avatar-web/web/src/accounts/KitchenPlanEditor.tsx`
- Modify: `avatar-web/web/src/types.ts` and account runtime reducer only if snapshot typing requires it

**Interfaces:**
- Consumes: session snapshot `foods` plus catalog readiness/status.
- Produces: recipe selectors/cards populated only from server catalog, with an explicit waiting/empty state.

- [x] **Step 1: Remove hard-coded fallback as active UI source**
  Replace `FALLBACK_RECIPES` usage with the snapshot catalog and render a Vietnamese “đang chờ dữ liệu công thức từ máy chủ” state when not ready; do not display guessed recipes.

- [x] **Step 2: Drive kitchen plan options from the same catalog**
  Make `KitchenPlanEditor` consume the dynamic recipe list and preserve configured IDs even when temporarily unavailable, marking them invalid instead of silently remapping.

- [x] **Step 3: Run web typecheck/build and a DOM smoke check**
  Verify empty/not-ready, valid catalog, and unknown configured ID states. Expected build succeeds and no static 35-recipe list remains in active rendering.

### Task 5: Evidence, Regression Verification, and Scope Review

**Files:**
- Modify: focused existing test files only after Tasks 1–4 are complete and only where tests are required to verify the new behavior.
- Modify: `docs/superpowers/plans/2026-08-19-decode-cooking-recipes-from-cmd76.md` to tick completed steps.

**Interfaces:**
- Consumes: all production changes and packet evidence from Tasks 1–4.
- Produces: reproducible verification record and confirmed change scope.

- [x] **Step 1: Run focused server and web verification**
  Run decoder/catalog, AutoFarm, snapshot, and web build/typecheck checks; label test passes, build-only evidence, and unavailable live UI/runtime checks separately.

- [x] **Step 2: Run repository hygiene checks**
  Run `git diff --check`, inspect `git status --short`, and confirm raw captures/unrelated dirty files are preserved.

- [x] **Step 3: Run GitNexus detect-changes**
  Run `gitnexus_detect_changes` with staged/all scope as appropriate; confirm only expected symbols, files, and flows changed. Do not commit unless explicitly requested.

- [x] **Step 4: Update plan checkboxes and report residual uncertainty**
  Record any missing real packet sample, simulator limitation, or unresolved server-side catalog issue explicitly; do not claim recipe correctness beyond evidence available.
