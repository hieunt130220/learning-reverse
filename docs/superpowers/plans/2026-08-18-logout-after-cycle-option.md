# Tuỳ chọn Đăng xuất sau khi chạy xong 1 Cycle (logoutAfterCycle) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bổ sung tuỳ chọn `logoutAfterCycle` (mặc định bật) cho phép người dùng lựa chọn tự động đăng xuất ngắt kết nối sau mỗi chu kỳ auto-farm hay giữ online liên tục giữa các chu kỳ.

**Architecture:** Mở rộng `AutoFarmConfig` và parser tại backend, xử lý phân nhánh ngắt kết nối vs giữ online trong `AvatarSession.onAutoCycleComplete`, và hiển thị checkbox toggle nhanh đồng bộ tức thì tại card `StatusPanel` và bảng `AutoFarmPanel`.

**Tech Stack:** Node.js, TypeScript, Express, React, SQLite

**Spec:** `docs/superpowers/specs/2026-08-18-logout-after-cycle-option-design.md`

## Global Constraints
- Tuân thủ nghiêm ngặt quy tắc Không TDD (không tạo test files mới trừ khi được yêu cầu; giữ vững các test hiện có).
- Giá trị mặc định của `logoutAfterCycle` là `true` (đảm bảo tương thích ngược 100% với các tài khoản đã có cấu hình trong DB).
- Lưu trữ cấu hình bền vững qua API `GET/PUT /api/accounts/:id/auto/config`.

---

### Task 1: Mở rộng `AutoFarmConfig` & Schema Parser ở Server

**Files:**
- Modify: `avatar-web/server/src/autoFarm.ts:140-150, 230-245`
- Modify: `avatar-web/server/src/accounts/autoConfig.ts:220-235`
- Modify: `avatar-web/server/src/accounts/autoConfig.test.ts:10-30`

**Interfaces:**
- Produces: `AutoFarmConfig.logoutAfterCycle?: boolean`, parser `logoutAfterCycle: (value, key) => boolean`.

- [ ] **Step 1: Cập nhật `AutoFarmConfig` và `DEFAULTS` trong `autoFarm.ts`**
Thêm trường `logoutAfterCycle?: boolean;` vào interface `AutoFarmConfig` và `logoutAfterCycle: true` vào `DEFAULTS`:
```ts
export interface AutoFarmConfig {
  // ...
  /** Tự động nhận thưởng nhiệm vụ hàng ngày và mở rương quà khi đủ điều kiện. */
  autoClaimDailyQuests?: boolean;
  /** Tự động đăng xuất sau khi hoàn thành 1 chu kỳ auto và đăng nhập lại khi tới chu kỳ kế tiếp. Mặc định: true. */
  logoutAfterCycle?: boolean;
}
```
Và trong `DEFAULTS`:
```ts
export const DEFAULTS: AutoFarmConfig = {
  // ...
  autoClaimDailyQuests: true,
  logoutAfterCycle: true,
};
```

- [ ] **Step 2: Cập nhật parser trong `autoConfig.ts`**
Thêm parser cho `logoutAfterCycle` vào object `parsers`:
```ts
  autoClaimDailyQuests: (value, key) => {
    if (typeof value !== 'boolean') throw new Error(`${key} phải là boolean`);
    return value;
  },
  logoutAfterCycle: (value, key) => {
    if (typeof value !== 'boolean') throw new Error(`${key} phải là boolean`);
    return value;
  },
```

- [ ] **Step 3: Chạy test kiểm tra `autoConfig.test.ts`**
Run: `npm test` trong thư mục `avatar-web/server`
Expected: PASS

- [ ] **Step 4: Commit**
`git commit -m "feat(server): add logoutAfterCycle to AutoFarmConfig and autoConfig parser"`

---

### Task 2: Xử lý Vòng đời Phiên trong `AvatarSession`

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts:585-625`

**Interfaces:**
- Consumes: `this.lastAutoConfig.logoutAfterCycle`
- Produces: `scheduleOnlineAutoCycle(delayMs: number)`

- [ ] **Step 1: Cập nhật `onAutoCycleComplete` và thêm `scheduleOnlineAutoCycle` trong `avatarSession.ts`**
Trong `avatar-web/server/src/session/avatarSession.ts`:
```ts
  private onAutoCycleComplete(epoch: number): void {
    if (epoch !== this.connectionEpoch || !this.wantAuto || this.status !== 'online') return;
    const rawInterval = this.lastAutoConfig.intervalMs;
    const intervalMs = typeof rawInterval === 'number' && Number.isFinite(rawInterval)
      ? Math.max(0, rawInterval)
      : DEFAULT_AUTO_INTERVAL_MS;
    const shouldLogout = this.lastAutoConfig.logoutAfterCycle ?? true;

    this.auto?.stop();
    if (shouldLogout) {
      this.scheduleAutoCycle(intervalMs);
      this.cancelAutoSyncKickoff();
      this.teardown();
      this.emit('status', 'idle');
    } else {
      this.scheduleOnlineAutoCycle(intervalMs);
    }
  }

  private scheduleOnlineAutoCycle(delayMs: number): void {
    this.cancelAutoCycleTimer();
    this.autoCycleTimer = this.setTimeoutFn(() => {
      this.autoCycleTimer = undefined;
      if (!this.wantAuto || this.permanentlyFailed) return;
      if (this.status === 'online') {
        this.tryStartAuto();
      } else {
        this.pushLog('phiên bị ngắt trong lúc chờ, đang kết nối lại cho vòng kế tiếp...');
        void this.start().catch((err: Error) => {
          this.pushLog('kết nối lại cho vòng auto kế tiếp lỗi: ' + err.message);
          this.scheduleRetry(this.connectionEpoch);
        });
      }
    }, delayMs);
  }
```

- [ ] **Step 2: Chạy test `avatarSession.test.ts`**
Run: `npm test` trong thư mục `avatar-web/server`
Expected: PASS

- [ ] **Step 3: Commit**
`git commit -m "feat(server): support continuous online between cycles when logoutAfterCycle is false"`

---

### Task 3: Cập nhật Web UI trên `StatusPanel` và `AutoFarmPanel`

**Files:**
- Modify: `avatar-web/web/src/types.ts:310-335`
- Modify: `avatar-web/web/src/accounts/panels/StatusPanel.tsx`
- Modify: `avatar-web/web/src/accounts/panels/AutoFarmPanel.tsx:85-98, 480-500`

**Interfaces:**
- Consumes: `GET/PUT /api/accounts/:id/auto/config`
- Produces: UI checkbox toggle trong `StatusPanel` và `AutoFarmPanel`.

- [ ] **Step 1: Cập nhật `AutoFarmConfigDto` trong `web/src/types.ts`**
Thêm `logoutAfterCycle?: boolean;` vào `AutoFarmConfigDto`.

- [ ] **Step 2: Thêm checkbox toggle nhanh vào `StatusPanel.tsx`**
- Tải `autoConfig` của tài khoản khi mount / `accountId` thay đổi.
- Lưu trạng thái `logoutAfterCycle` (mặc định `true`).
- Render checkbox:
  ```tsx
  <div className="row" style={{ marginTop: '0.35rem' }}>
    <label className="inline" style={{ fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
      <input
        type="checkbox"
        checked={logoutAfterCycle}
        disabled={savingOpt || loadingOpt}
        onChange={(e) => void handleToggleLogoutAfterCycle(e.target.checked)}
        style={{ width: 'auto', margin: 0 }}
      />
      Đăng xuất sau khi chạy xong 1 vòng (tự đăng nhập lại ở vòng kế)
    </label>
  </div>
  ```
- Khi toggle: Cập nhật state và gọi `PUT /api/accounts/${accountId}/auto/config` với `expectedRevision`.

- [ ] **Step 3: Bổ sung `logoutAfterCycle` vào `AutoFarmPanel.tsx`**
- Thêm `'logoutAfterCycle'` vào `AUTO_CONFIG_KEYS`.
- Thêm state `logoutAfterCycle` trong `AutoFarmPanel` và render checkbox trong phần cài đặt.

- [ ] **Step 4: Chạy test web `StatusPanel.test.tsx` và `AutoFarmPanel.test.tsx`**
Run: `npm test` trong thư mục `avatar-web/web`
Expected: PASS

- [ ] **Step 5: Commit**
`git commit -m "feat(web): add logout-after-cycle toggle to StatusPanel and AutoFarmPanel"`

---

### Task 4: Kiểm thử Toàn diện & Build Kiểm tra

**Files:**
- Modify: Không có

- [ ] **Step 1: Build server và web**
Run: `npm run build` ở cả `avatar-web/server` và `avatar-web/web`
Expected: Build thành công không có lỗi type hoặc compile.

- [ ] **Step 2: Commit và tổng kết**
`git status` sạch sẽ và sẵn sàng.
