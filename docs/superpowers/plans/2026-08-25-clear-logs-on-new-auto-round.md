# Clear Logs On New Auto Round Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xoá sạch log cũ (server RAM + web UI) mỗi khi một round auto farm mới khởi động.

**Architecture:** Thêm method `clearLogs()` vào `AvatarSession` — reset buffer `logs` và phát WS event mới `'logs-clear'`. Gọi `clearLogs()` ngay trước mỗi lệnh `this.auto!.start(...)` tại 2 điểm duy nhất (`tryStartAuto()`, `startDesiredAutomation()`) để phủ đủ 3 đường start round. Web reducer thêm case `'logs-clear'` đặt `logs: []`.

**Tech Stack:** TypeScript, Node.js (Express + ws), React 18 (reducer thuần).

**Spec:** `docs/superpowers/specs/2026-08-25-clear-logs-on-new-auto-round-design.md`

## Global Constraints

- Không đổi chữ ký hàm nào; thay đổi thuần cộng thêm (impact: LOW — đã đánh giá thủ công vì GitNexus MCP không khả dụng).
- Không đổi ring-buffer 500 dòng trong `pushLog`, không đụng `traffic`/`lastActions`.
- `'logs-clear'` KHÔNG được thêm vào `LIGHT_EVENTS` (giữ là event nặng, chỉ tới client mở trang chi tiết).
- Không viết test mới, không TDD (theo AGENTS.md). Chỉ chạy typecheck + test hiện có.
- Giữ nguyên style comment tiếng Việt hiện có của codebase.

---

### Task 1: Server — thêm `clearLogs()` và gọi trước mọi lệnh start round

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts:646-651` (kế bên `pushLog`)
- Modify: `avatar-web/server/src/session/avatarSession.ts:1164-1171` (`startDesiredAutomation`, nhánh `auto_farm`)
- Modify: `avatar-web/server/src/session/avatarSession.ts:1188-1192` (`tryStartAuto`)

**Interfaces:**
- Consumes: `this.logs`, `this.emit()` (có sẵn trong class).
- Produces: WS event `{ type: 'logs-clear', accountId, payload: null }` cho Task 2.

- [x] **Step 1: Thêm method `clearLogs()` ngay sau `pushLog()` (~dòng 651)**

```ts
  /** Round auto mới bắt đầu: xoá log cũ ở server và báo client dọn phần tích luỹ. */
  private clearLogs(): void {
    this.logs = [];
    this.emit('logs-clear', null);
  }
```

- [x] **Step 2: Gọi trong nhánh `auto_farm` của `startDesiredAutomation()` — trước `this.auto!.start(this.lastAutoConfig)` (dòng 1171)**

```ts
    if (this.desiredMode === 'auto_farm') {
      this.shop?.assertIdleForAutomation();
      if (
        !this.isAutomationGenerationCurrent(generation)
        || !this.isCurrent(client, epoch)
        || client.status !== 'online'
      ) return false;
      this.clearLogs();
      this.auto!.start(this.lastAutoConfig);
```

- [x] **Step 3: Gọi trong `tryStartAuto()` — trước `this.auto!.start(this.lastAutoConfig)` (dòng 1192)**

```ts
  private tryStartAuto(): void {
    if (this.desiredMode !== 'auto_farm') return;
    try {
      this.shop?.assertIdleForAutomation();
      this.clearLogs();
      this.auto!.start(this.lastAutoConfig);
    } catch (err) {
      this.pushLog(`không bật được tự động: ${(err as Error).message}`);
    }
  }
```

Lưu ý: nếu `start()` ném lỗi sau khi đã clear, `pushLog` lỗi vẫn ghi lại được → panel sạch nhưng thấy lỗi vừa xảy ra (đúng edge case trong spec).

- [x] **Step 4: Verify**
Run: `cd avatar-web/server && npm run typecheck`
Expected: không có lỗi TypeScript.

### Task 2: Web — reducer xử lý event `'logs-clear'`

**Files:**
- Modify: `avatar-web/web/src/accounts/accountRuntime.ts:102-103` (case `'log'` trong switch)

**Interfaces:**
- Consumes: WS event `'logs-clear'` từ Task 1 (payload `null`, không cần đọc payload).

- [x] **Step 1: Thêm case mới ngay trên case `'log'`**

```ts
    case 'logs-clear':
      return { ...current, logs: [] };
    case 'log':
      return { ...current, logs: [...current.logs.slice(-499), message.payload] };
```

- [x] **Step 2: Verify**
Run: `cd avatar-web/web && npx tsc -b --noEmit`
Expected: không có lỗi TypeScript.

### Task 3: Kiểm tra tổng thể & commit

**Files:** không sửa thêm.

- [x] **Step 1: Chạy test hiện có của server** (đảm bảo test ring-buffer ở `avatarSession.test.ts` không vỡ)
Run: `cd avatar-web/server && npm test`
Expected: toàn bộ pass.

- [x] **Step 2: Rà soát diff trước commit** (thay thế cho `gitnexus_detect_changes` không khả dụng)
Run: `git diff --stat && git diff`
Expected: chỉ đúng 2 file `avatarSession.ts` + `accountRuntime.ts`; không symbol ngoài dự kiến.

- [x] **Step 3: Commit**
`git add avatar-web/server/src/session/avatarSession.ts avatar-web/web/src/accounts/accountRuntime.ts && git commit -m "feat: xoa log cu khi round auto moi bat dau"`
