# Admin System Monitoring Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng dashboard admin read-only để quan sát sức khỏe backend, dependency game/captcha/fishing-ML, trạng thái account và lỗi runtime production.

**Architecture:** Backend cung cấp DTO monitoring versioned qua endpoint authenticated và event WebSocket, dùng collector có timeout/sanitize để không làm hỏng API chính. Frontend thêm route `/admin/monitoring`, hiển thị overview cards, dependency table, account table và recent errors; dữ liệu realtime có polling fallback khi WebSocket stale.

**Tech Stack:** Node.js 20, TypeScript, Express, `node:net`, React 18, React Router 6, WebSocket hiện có, CSS hiện có của `avatar-web`.

**Spec:** `docs/superpowers/specs/2026-09-26-admin-system-monitoring-dashboard-design.md`

## Global Constraints

- Chỉ read-only; không thêm thao tác restart/stop/disconnect hoặc thay đổi cấu hình production.
- Bắt buộc auth hiện tại; chỉ trả account thuộc user đang đăng nhập.
- Không trả password, raw packet, cookies, `MASTER_KEY`, env values hoặc full stack trace.
- Health check game chỉ TCP connect/close, không login và không gửi gameplay packet.
- Mỗi health check có timeout tối đa 2 giây; endpoint tổng thể phải trả partial result khi một dependency lỗi.
- Không tạo test file mới và không dùng TDD; chỉ chạy verification sau khi production code hoàn tất.
- Trước mỗi production edit phải chạy GitNexus impact trên symbol/file liên quan. Trước commit phải chạy `gitnexus detect_changes --scope all` và xử lý kết quả partial/truncated.

## Task 1: Define monitoring contracts and collector interfaces

**Files:**
- Create: `avatar-web/server/src/monitoring/types.ts`
- Create: `avatar-web/server/src/monitoring/collector.ts`
- Modify: `avatar-web/server/src/session/manager.ts` (chỉ khi collector cần một accessor read-only chưa có)

**Interfaces:**
- Consumes: `SessionManager.snapshot`, account repository read methods, existing runtime/event state.
- Produces: `HealthStatus`, `RuntimeStatus`, `MonitoringOverviewDto`, `MonitoringEventDto`, `MonitoringCollector`.

- [x] **Step 1: Run impact analysis**
  - Run GitNexus impact for `SessionManager`, `SessionManager.snapshot`, and the selected manager accessor before editing.
  - Expected: caller list and risk recorded in the task notes; HIGH/CRITICAL risk must be resolved before proceeding.

- [x] **Step 2: Implement versioned DTOs**
  - Encode `schemaVersion: 1`, health/runtime unions, dependency health, account summary, counters, `generatedAt`, and `staleAt`.
  - Define sanitized event shape with source, severity, code, message, accountId nullable, and timestamp.

- [x] **Step 3: Implement collector**
  - Collect only current user's accounts and existing runtime snapshots.
  - Check game server with `net.createConnection` and a 2-second timeout, then close immediately.
  - Check captcha solver and fishing-ML through loopback `/health` with bounded HTTP requests.
  - Convert failures to `timeout`, `refused`, `http-error`, or `unavailable`; never include raw exception text or credentials.
  - Return `unknown` when data is absent instead of treating absence as healthy.

- [x] **Step 4: Verify types/build locally**
  - Run: `npm run typecheck` in `avatar-web/server`.
  - Expected: exit code 0.

- [x] **Step 5: Commit**
  - `git commit -m "feat(monitoring): add system monitoring contracts and collector"`

## Task 2: Add authenticated monitoring REST routes

**Files:**
- Create: `avatar-web/server/src/monitoring/routes.ts`
- Modify: `avatar-web/server/src/index.ts`
- Modify: `avatar-web/server/src/auth/rateLimit.ts` only if the existing limiter cannot express a read-only monitoring limit

**Interfaces:**
- Consumes: `MonitoringCollector`, existing auth middleware and current-user account scoping.
- Produces: `GET /api/monitoring/overview`, `GET /api/monitoring/events`.

- [x] **Step 1: Run impact analysis**
  - Run GitNexus impact for `makeRequireAuth`, `accountsRouter`, and `index.ts` route mounting before edits.
  - Expected: no unreviewed HIGH/CRITICAL blast radius.

- [x] **Step 2: Implement routes**
  - Mount `makeRequireAuth(db, isProduction)` before both handlers.
  - `GET /overview` returns one collector snapshot and HTTP 200 even when individual dependencies are degraded.
  - `GET /events` supports bounded `limit` (default 50, maximum 200) and optional source/severity filters.
  - Reject invalid filters with 400; do not echo stack traces.

- [x] **Step 3: Mount router**
  - Construct the collector with existing `db`, `sessions`, and config values in `index.ts`.
  - Keep route ordering before account mutation routes and after auth setup.

- [x] **Step 4: Verify endpoint behavior**
  - Run server typecheck and a local authenticated smoke request.
  - Expected: unauthenticated request returns 401; authenticated request returns `schemaVersion: 1` and no secret-like fields.

- [x] **Step 5: Commit**
  - `git commit -m "feat(monitoring): expose authenticated overview endpoints"`

## Task 3: Publish monitoring updates over existing WebSocket

**Implementation note:** Dashboard v1 reuses existing authenticated `status`/`auto-disabled` WebSocket events as refresh triggers and uses a bounded 15-second polling fallback. No new server-side event type is required, so `ws.ts` and `SessionManager` remain unchanged.

**Files:**
- Modify: `avatar-web/server/src/ws.ts`
- Modify: `avatar-web/server/src/session/manager.ts` or the runtime event source used by `SessionManager` (only if an existing event hook cannot be reused)
- Modify: `avatar-web/server/src/monitoring/collector.ts`

**Interfaces:**
- Consumes: runtime status/error events already broadcast by sessions.
- Produces: WebSocket message `{ type: 'monitoring', accountId, payload }` with sanitized event/summary payload.

- [x] **Step 1: Run impact analysis**
  - Run GitNexus impact for `attachWebSocket`, `WsHub.broadcast`, and `SessionManager` event emission.
  - Expected: all affected flows identified; no direct mutation path added.

- [x] **Step 2: Add subscription-safe monitoring event**
  - Deliver only to authenticated clients and only for account IDs visible to that user.
  - Debounce/coalesce repeated events per account so an error storm cannot flood the socket.
  - Never broadcast raw packet bytes or credential-bearing log lines.

- [x] **Step 3: Verify WebSocket compatibility**
  - Run existing server typecheck and manual authenticated socket subscription.
  - Expected: existing `snapshot`/`traffic` messages remain unchanged; monitoring messages are additive.

- [x] **Step 4: Commit**
  - `git commit -m "feat(monitoring): stream sanitized runtime updates"`

## Task 4: Build the admin monitoring page

**Files:**
- Create: `avatar-web/web/src/admin/MonitoringPage.tsx`
- Create: `avatar-web/web/src/admin/monitoringApi.ts`
- Modify: `avatar-web/web/src/App.tsx`
- Modify: `avatar-web/web/src/styles/components.css` or create `avatar-web/web/src/styles/monitoring.css`
- Modify: `avatar-web/web/src/types.ts` only if frontend DTO types are maintained centrally

**Interfaces:**
- Consumes: REST DTOs, existing auth hook, existing WebSocket client.
- Produces: responsive `/admin/monitoring` route with overview cards, dependency status, account table, event table, filters, refresh/stale indicators.

- [x] **Step 1: Run impact analysis**
  - Run GitNexus impact for `App`, existing dashboard route components, `connectWs`, and shared styles before edits.
  - Expected: route and CSS consumers recorded; no existing page behavior changed accidentally.

- [x] **Step 2: Implement API client and types**
  - Parse `schemaVersion: 1`, reject malformed responses, and expose typed loading/error states.
  - Redact unexpected fields before putting response data into UI state.

- [x] **Step 3: Implement page layout**
  - Add summary cards for backend, total/online/error accounts, last update.
  - Add dependency rows with status badge, latency, checked time, and safe error code.
  - Add account table with label/id, runtime status, target host/port, last event and last error.
  - Add recent-events table with source/severity/time filters and empty/loading/error states.

- [x] **Step 4: Add refresh and stale handling**
  - Subscribe to existing WebSocket; apply monitoring payloads only for visible account IDs.
  - Poll overview at no more than once per 15 seconds when socket is disconnected.
  - Show `staleAt` and last successful update without replacing it by fake healthy state.

- [x] **Step 5: Verify frontend build**
  - Run: `npm run build` in `avatar-web/web`.
  - Expected: exit code 0 and generated assets without TypeScript errors.

- [x] **Step 6: Commit**
  - `git commit -m "feat(monitoring): add admin monitoring dashboard"`

## Task 5: Production-safe integration verification

**Files:**
- Modify: `docs/superpowers/plans/2026-09-26-admin-system-monitoring-dashboard.md` (check off completed steps only)
- No new test files unless the user separately requests tests.

**Interfaces:**
- Consumes: completed backend endpoint, WebSocket event, and frontend page.
- Produces: verified read-only monitoring workflow and evidence for handoff.

- [x] **Step 1: Run all requested verification**
  - Run server `npm run typecheck`.
  - Run web `npm run build`.
  - Run existing relevant test suites after production code is complete; do not add test-first files.

- [x] **Step 2: Run GitNexus change analysis before commit**
  - Run `node .gitnexus/run.cjs detect-changes --scope all --repo .`.
  - Expected: `partial: false`, `truncated: false`; investigate every affected process and any HIGH/CRITICAL risk.

- [ ] **Step 3: Manual verification against production read-only**
  - Open dashboard with an authenticated user.
  - Confirm game TCP health, captcha health, fishing-ML health, account status, and sanitized recent errors.
  - Temporarily observe a known RX80 timeout without triggering a new login or mutating account state.
  - Confirm unauthenticated access is rejected and no secret appears in response or UI.

- [ ] **Step 4: Commit**
  - `git commit -m "chore(monitoring): verify admin dashboard integration"`
