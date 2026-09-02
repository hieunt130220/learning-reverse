# Fix Auto Cycle Temporary Login Rejection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khi auto farm bật và gặp lỗi đăng nhập tạm thời, bỏ qua vòng hiện tại nhưng giữ auto bật và đặt một lịch vòng mới theo interval.

**Architecture:** Thêm một nhánh xử lý riêng trong `AvatarSession.onDisconnected` cho `retryAfter` của lỗi tạm thời. Nhánh này chỉ chạy sau cleanup hiện tại, giữ `desiredMode = auto_farm`, hủy timer cũ và dùng `scheduleAutoCycle` thay cho backoff kết nối tổng quát.

**Tech Stack:** TypeScript, Node.js event lifecycle, AvatarSession, GameClient.

**Spec:** `docs/superpowers/specs/2026-09-02-fix-auto-cycle-temporary-login-rejection-design.md`

## Global Constraints

- Không thêm test file vì người dùng không yêu cầu.
- Không thay đổi `GameClient`, protocol parser, UI hoặc database.
- Không tắt `desiredMode`, không persist auto về `off` cho lỗi tạm thời.
- Không thay đổi xử lý lỗi vĩnh viễn (`LOGIN_FAIL` / `-35`) hay lỗi kết nối thông thường.
- Chỉ giữ một `autoCycleTimer` duy nhất.
- Timer vòng mới phải bằng `max(intervalMs, thời gian server yêu cầu chờ)`.

### Task 1: Bỏ qua vòng auto khi lỗi tạm thời

**Files:**

- Modify: `avatar-web/server/src/session/avatarSession.ts:696-746`
- Modify: `avatar-web/server/src/session/avatarSession.ts:420-435`
- Modify: `avatar-web/server/src/session/avatarSession.ts:1486-1522`

**Interfaces:**

- Consumes: `GameClient` event `temporary-rejection` → `AvatarSession.retryAfter` (`epoch`, `notBefore`), `desiredMode`, `lastAutoConfig.intervalMs`, `scheduleAutoCycle(delayMs)`.
- Produces: Một lịch chạy vòng auto mới trong `autoCycleTimer`; `desiredMode` vẫn giữ `auto_farm`; runner auto của epoch cũ bị dừng.

- [x] **Step 1: Thêm nhánh lỗi tạm thời sau cleanup**

`connect()` không đặt `scheduleRetry` khi `retryAfter` của epoch hiện tại đã tồn tại; đây là đường client tự logout sau thông báo tạm thời.

Trong `switchAutomationMode`, nếu transition chờ kết nối gặp client offline trong khi `retryAfter` khớp epoch và `desiredMode` là `auto_farm`, trả `connect-pending` trước logic dừng transition; điều này giữ lại `autoCycleTimer`.

Trong `onDisconnected`, giữ nguyên toàn bộ cleanup hiện tại. Trước khi gọi `scheduleRetry`, thay đoạn điều kiện cuối bằng logic sau:

```ts
if (!this.wanted || this.permanentlyFailed || epoch !== this.connectionEpoch) return;

const rejection = this.retryAfter?.epoch === epoch ? this.retryAfter : undefined;
if (this.desiredMode === 'auto_farm' && rejection) {
  const rawInterval = this.lastAutoConfig.intervalMs;
  const intervalMs = typeof rawInterval === 'number' && Number.isFinite(rawInterval)
    ? Math.max(0, rawInterval)
    : DEFAULT_AUTO_INTERVAL_MS;
  const waitMs = Math.max(intervalMs, Math.max(0, rejection.notBefore - this.now()));
  this.scheduleAutoCycle(waitMs);
  this.pushLog(
    `bỏ qua vòng auto hiện tại vì lỗi đăng nhập tạm thời; đặt lịch vòng mới sau ${Math.round(waitMs / 1000)}s`,
  );
  return;
}

if (this.autoCycleTimer) return;
this.scheduleRetry(epoch);
```

- [x] **Step 2: Verify typecheck**

Run: `cd avatar-web/server && npm run typecheck`

Expected: `tsc --noEmit` không báo lỗi.

- [x] **Step 3: Verify test hiện có**

Run: `cd avatar-web/server && npm test`

Expected: toàn bộ test hiện tại pass; không tạo test mới.

- [x] **Step 4: Kiểm tra thay đổi graph**

Run: `node .gitnexus/run.cjs detect-changes --scope all --repo .`

Expected: kiểm tra graph hoàn tất và không có lỗi; nếu CLI bootstrap lỗi, dùng bản CLI GitNexus khả dụng hoặc chạy lại sau khi môi trường khôi phục trước khi commit.

- [x] **Step 5: Commit**

`git commit -m "fix: retry auto farm after temporary login rejection"`
