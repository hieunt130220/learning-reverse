# Tự Động Quay Lại Mode Farm Khi Hết Cuốc Khai Thác Gỗ/Đá Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tự động chuyển bot từ chế độ khai thác gỗ/đá (`auto_mining`) về chế độ nông trại (`auto_farm`) khi phát hiện phản hồi hết cuốc từ máy chủ.

**Architecture:** Mở rộng `AutoMiningRunnerDeps` với callback `onRequestStop`, nhận diện chính xác từ khóa `"hết cuốc"` trong game dialog, phối hợp với `AvatarSession.switchAutomationMode` để đưa bot về `auto_farm` an toàn; bổ sung tùy chọn `returnToFarm` trên cả backend config lẫn frontend modal.

**Tech Stack:** TypeScript, Node.js, React, Vite, SQLite.

**Spec:** `docs/superpowers/specs/2026-10-09-auto-mining-fallback-to-farm-when-no-tool-design.md`

## Global Constraints
- Không dùng TDD (không tạo test files mới trừ khi được yêu cầu).
- Chạy GitNexus impact trước khi chỉnh sửa các symbol cốt lõi.
- Chạy GitNexus detect_changes trước khi commit.
- Tuân thủ quy định quản lý dung lượng ổ đĩa.

---

### Task 1: Cập Nhật Contracts & Types (`MiningConfig.returnToFarm`)

**Files:**
- Modify: `avatar-web/server/src/session/automationTypes.ts:186-203`
- Modify: `avatar-web/web/src/types.ts`

**Interfaces:**
- Consumes: `MiningConfig`, `DEFAULT_MINING_CONFIG`
- Produces: Thuộc tính `returnToFarm?: boolean` trong `MiningConfig` (mặc định `true`)

- [x] **Step 1: Bổ sung `returnToFarm` vào server `automationTypes.ts`**
  Thêm `readonly returnToFarm?: boolean;` vào `MiningConfig` và `returnToFarm: true` vào `DEFAULT_MINING_CONFIG`.

- [x] **Step 2: Bổ sung `returnToFarm` vào client `types.ts`**
  Thêm `readonly returnToFarm?: boolean;` vào `MiningConfig` trong `avatar-web/web/src/types.ts`.

- [x] **Step 3: Kiểm tra biên dịch**
  Run: `npm --prefix avatar-web/server run build && npm --prefix avatar-web/web run build`
  Expected: Cả hai package biên dịch sạch, không lỗi type.

- [x] **Step 4: Commit**
  Run: `git commit -m "feat(mining): add returnToFarm option to MiningConfig contracts"`

---

### Task 2: Nhận Diện `"hết cuốc"` & Kích Hoạt `onRequestStop` Trong `AutoMiningRunner`

**Files:**
- Modify: `avatar-web/server/src/mining/autoMining.ts`

**Interfaces:**
- Consumes: `AutoMiningRunnerDeps`, `isNoToolDialog`
- Produces: Callback `onRequestStop` gửi mã `'no_tool'` về session khi gặp dialog hết cuốc

- [x] **Step 1: Chạy GitNexus impact trước khi sửa**
  Run: `impact({ target: "AutoMiningRunner", direction: "upstream" })`

- [x] **Step 2: Cập nhật `AutoMiningRunnerDeps` và hàm `isNoToolDialog`**
  ```typescript
  export interface AutoMiningRunnerDeps {
    accountId: number;
    onStateChange?: (state: MiningRuntimeState) => void;
    onRequestStop?: (reason: 'no_tool' | 'low_energy' | 'depleted' | 'error' | 'stopped', message?: string) => void;
    onLog?: (message: string) => void;
  }

  export function isNoToolDialog(text: string): boolean {
    return /hết cuốc/i.test(text);
  }
  ```

- [x] **Step 3: Cập nhật logic xử lý dialog trong `runLoop`**
  Trong vòng lặp xử lý `result.dialogs`:
  ```typescript
  if (isNoToolDialog(dialog)) {
    this.state = {
      ...this.state,
      status: 'paused_no_tool',
      lastMessage: `Tạm dừng: ${dialog}`,
    };
    this.emitState();
    this.running = false;
    this.deps.onRequestStop?.('no_tool', dialog);
    return;
  }
  ```

- [x] **Step 4: Kiểm tra biên dịch server**
  Run: `npm --prefix avatar-web/server run build`
  Expected: Build thành công không có lỗi.

- [x] **Step 5: Phân tích thay đổi đồ thị & Commit**
  Run: `detect_changes({ scope: "unstaged" })` và `git commit -m "feat(mining): trigger onRequestStop when pickaxes run out"`

---

### Task 3: Tích Hợp `onRequestStop` Chuyển Về `auto_farm` Trong `AvatarSession`

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts:1922-1940`

**Interfaces:**
- Consumes: `AutoMiningRunner`, `switchAutomationMode`, `this.miningConfig.config.returnToFarm`
- Produces: Chuyển đổi trạng thái tự động về `auto_farm` khi nhận được sự kiện `no_tool`

- [x] **Step 1: Chạy GitNexus impact trước khi sửa**
  Run: `impact({ target: "AvatarSession", direction: "upstream" })`

- [x] **Step 2: Gắn callback `onRequestStop` cho `miningRunner` trong `startDesiredAutomation`**
  ```typescript
      this.miningRunner = new AutoMiningRunner(client, {
        accountId: this.opts.accountId,
        onStateChange: (state) => {
          this.miningRuntime = state;
          this.emitAutomation();
        },
        onRequestStop: (_reason, message) => {
          if (message) this.pushLog(`[khai thác] ${message}`);
          if (this.miningConfig.config.returnToFarm !== false) {
            this.pushLog('[khai thác] hết cuốc, chuyển sang chế độ tự động nông trại.');
            void this.switchAutomationMode({
              desiredMode: 'auto_farm',
              findNpcConfig: this.findNpcConfig,
              fishingConfig: this.fishingConfig,
              miningConfig: this.miningConfig,
              mazeConfig: this.mazeConfig,
              schoolConfig: this.schoolConfig,
              location: this.automationLocation,
            });
          } else {
            this.pushLog('[khai thác] tạm dừng khai thác.');
            void this.stopAutomation();
          }
        },
      });
  ```

- [x] **Step 3: Kiểm tra biên dịch server**
  Run: `npm --prefix avatar-web/server run build`
  Expected: Build thành công không có lỗi.

- [x] **Step 4: Phân tích thay đổi đồ thị & Commit**
  Run: `detect_changes({ scope: "unstaged" })` và `git commit -m "feat(session): fallback to auto_farm on mining tool depletion"`

---

### Task 4: Bổ Sung Tùy Chọn `returnToFarm` Vào Modal Khai Thác (`MiningTargetModal.tsx`)

**Files:**
- Modify: `avatar-web/web/src/accounts/MiningTargetModal.tsx`

**Interfaces:**
- Consumes: `MiningConfig.returnToFarm`
- Produces: Checkbox cho phép người dùng cấu hình tự động quay lại Nông trại khi hết cuốc

- [x] **Step 1: Thêm state `returnToFarm` và tải giá trị từ config hiện tại**
  Thêm `const [returnToFarm, setReturnToFarm] = useState<boolean>(true);` và đồng bộ trong `useEffect` khi load config:
  `setReturnToFarm(data.config.returnToFarm ?? true);`

- [x] **Step 2: Cập nhật `handleSubmit` gửi `returnToFarm` trong `nextConfig`**
  ```typescript
  const nextConfig: MiningConfig = {
    target,
    startArea: currentConfig?.startArea ?? 0,
    switchAreaWhenDepleted: currentConfig?.switchAreaWhenDepleted ?? true,
    maxAreasToScan: currentConfig?.maxAreasToScan ?? 10,
    delayBetweenActionsMs: currentConfig?.delayBetweenActionsMs ?? 3000,
    returnToFarm,
  };
  ```

- [x] **Step 3: Thêm Checkbox UI vào form trước nút Submit**
  ```tsx
  <div>
    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: busy ? 'not-allowed' : 'pointer' }}>
      <input
        type="checkbox"
        checked={returnToFarm}
        disabled={busy}
        onChange={(e) => setReturnToFarm(e.target.checked)}
      />
      <span style={{ fontWeight: 500 }}>Tự động chuyển về Nông trại khi hết cuốc</span>
    </label>
    <p className="hint" style={{ margin: '4px 0 0 24px', fontSize: '0.82rem' }}>
      Khi phát hiện hết cuốc, bot sẽ tự động quay về nông trại để tiếp tục chăm sóc nông trại.
    </p>
  </div>
  ```

- [x] **Step 4: Kiểm tra biên dịch frontend web**
  Run: `npm --prefix avatar-web/web run build`
  Expected: Vite build thành công sạch sẽ.

- [x] **Step 5: Commit**
  Run: `git commit -m "feat(web): add returnToFarm checkbox in MiningTargetModal"`

---

### Task 5: Kiểm Tra Toàn Diện & Verification

- [x] **Step 1: Kiểm tra build toàn bộ dự án**
  Run: `npm --prefix avatar-web/server run build && npm --prefix avatar-web/web run build`
  Expected: Cả server và web đều build thành công không warning/error.

- [x] **Step 2: Kiểm tra GitNexus detect_changes trên toàn repo**
  Run: `detect_changes({ scope: "all" })`
  Expected: Không có cảnh báo rủi ro cao bất thường.
