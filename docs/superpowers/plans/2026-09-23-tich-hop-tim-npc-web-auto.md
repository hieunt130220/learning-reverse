# Tích Hợp Chế Độ "🎯 Tìm NPC" Vào Web Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tích hợp chế độ tự động **"🎯 Tìm NPC" (`find_npc`)** vào hệ thống Web Automation của `avatar-web` (cả Backend Runner và Frontend Web UI), cho phép quét tự động qua các map/khu công viên, đứng chờ nhận quà sự kiện từ NPC và tự động dừng khi đạt giới hạn ngày.

**Architecture:** Mở khóa `FIND_NPC_DISABLED = false`. Xây dựng lại `AutoFindNpc` runner sử dụng engine native từ `park-probe.ts` (Native park join, RX 80/RX 48 decoding, Target NPC waiting, RX 83 departure detection, `parseMaxQuantityDialog` auto-exit, periodic sweep cycles). Nối runner vào `AvatarSession` và phát sóng `findNpcRuntime` qua WebSocket. Cập nhật Web UI: mở tab Tìm NPC trên Drawer, thêm nút mode trên `StatusPanel`, và nâng cấp `FindNpcPanel` hiển thị trực quan thông tin quét live cùng thanh tiến độ quà sự kiện.

**Tech Stack:** TypeScript, Node.js (tsx), Express, React 18, Vite, WebSocket.

**Spec:** `docs/superpowers/specs/2026-09-23-tich-hop-tim-npc-web-auto-design.md`

## Global Constraints

- Tuân thủ nghiêm ngặt quy định **KHÔNG TDD** trong `CLAUDE.md` (không tạo test files, đi thẳng vào production code).
- Tuân thủ GitNexus (`node .gitnexus/run.cjs impact` trước khi sửa symbol, `node .gitnexus/run.cjs detect-changes` trước khi commit).
- Giữ nguyên schema database hiện có (bảng `avatar_automation_state` đã có sẵn cột `find_npc_config_json` và check constraint `desired_mode`).

---

### Task 1: Cập nhật Type Contracts & Feature Flags

**Files:**
- Modify: `avatar-web/server/src/session/featureFlags.ts:1-6`
- Modify: `avatar-web/server/src/session/automationTypes.ts:260-385`
- Modify: `avatar-web/web/src/types.ts:250-320`

**Interfaces:**
- Consumes: không
- Produces: `FIND_NPC_DISABLED = false`, `FindNpcConfig`, `DEFAULT_FIND_NPC_CONFIG`, `AutoFindNpcState` mở rộng

- [ ] **Step 1: Chạy GitNexus impact analysis trước khi sửa**
Run: `node .gitnexus/run.cjs impact "FIND_NPC_DISABLED" --direction upstream --repo .`
Expected: Xác định các caller của `FIND_NPC_DISABLED` (`routes.ts`, `manager.ts`).

- [ ] **Step 2: Đổi `FIND_NPC_DISABLED = false` trong `featureFlags.ts`**
Cập nhật `avatar-web/server/src/session/featureFlags.ts`:
```typescript
/**
 * Tính năng Tìm NPC: đặt false để bật hoạt động trên Web và API.
 */
export const FIND_NPC_DISABLED = false;
```

- [ ] **Step 3: Mở rộng `FindNpcConfig` và `AutoFindNpcState` trong `automationTypes.ts`**
Trong `avatar-web/server/src/session/automationTypes.ts`:
```typescript
export interface FindNpcConfig {
  readonly npcName: string;
  readonly fromMap?: number;
  readonly toMap?: number;
  readonly fromBoard?: number;
  readonly toBoard?: number;
  readonly stopOnMaxQuantity?: boolean;
  readonly cycleDelaySeconds?: number;
}

export const DEFAULT_FIND_NPC_CONFIG: FindNpcConfig = Object.freeze({
  npcName: 'Chú Cuội',
  fromMap: 1,
  toMap: 8,
  fromBoard: 0,
  toBoard: 19,
  stopOnMaxQuantity: true,
  cycleDelaySeconds: 30,
});

export type AutoFindNpcPhase =
  | 'idle'
  | 'entering_park'
  | 'scanning'
  | 'waiting_npc'
  | 'waiting_next_cycle'
  | 'daily_limit_reached'
  | 'scan_backoff'
  | 'tracking'
  | 'stopping';

export interface AutoFindNpcState {
  phase: AutoFindNpcPhase;
  running: boolean;
  targetName: string;
  cursor: number;
  total: number;
  timeoutStreak: number;
  currentMap?: number | null;
  currentBoard?: number | null;
  foundNpc?: { id: number; name: string; map: number; board: number } | null;
  waitingSeconds?: number;
  eventRewardProgress?: { current: number; max: number } | null;
  lastRewardMessage?: string | null;
  dailyLimitReached?: boolean;
  cycleCount?: number;
  backoffUntil?: number;
  probing?: NpcMapLocation;
  lastError?: string;
  updatedAt?: number;
}

export function idleFindNpcRuntime(targetName = 'Chú Cuội'): AutoFindNpcState {
  return {
    phase: 'idle',
    running: false,
    targetName,
    cursor: 0,
    total: 0,
    timeoutStreak: 0,
    currentMap: null,
    currentBoard: null,
    foundNpc: null,
    waitingSeconds: 0,
    eventRewardProgress: null,
    lastRewardMessage: null,
    dailyLimitReached: false,
    cycleCount: 0,
    updatedAt: Date.now(),
  };
}
```

- [ ] **Step 4: Đồng bộ types trong `avatar-web/web/src/types.ts`**
Cập nhật `FindNpcConfig`, `DEFAULT_FIND_NPC_CONFIG`, `AutoFindNpcPhase`, `AutoFindNpcState` trong `web/src/types.ts` tương ứng.

- [ ] **Step 5: Kiểm tra biên dịch**
Run: `npm --prefix avatar-web/server run typecheck && npm --prefix avatar-web/web run build`
Expected: Cả server và web build thành công, không có lỗi type.

- [ ] **Step 6: Kiểm tra GitNexus và commit**
Run: `node .gitnexus/run.cjs detect-changes --scope unstaged --repo .`
Run:
```bash
git add avatar-web/server/src/session/featureFlags.ts avatar-web/server/src/session/automationTypes.ts avatar-web/web/src/types.ts
git commit -m "feat(find-npc): enable feature flag and expand data contracts

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: Xây dựng lại Runner `AutoFindNpc` với engine native từ `park-probe.ts`

**Files:**
- Modify: `avatar-web/server/src/autoFindNpc.ts:1-250`

**Interfaces:**
- Consumes: `GameClient`, `FindNpcConfig`, `NATIVE_PARK_JOIN_POSITIONS`, `parseMaxQuantityDialog`
- Produces: `AutoFindNpc` runner class với các method `start(config)`, `stop()`, `updateConfig(config)`, `state()`

- [ ] **Step 1: Chạy GitNexus impact analysis trước khi sửa**
Run: `node .gitnexus/run.cjs impact "AutoFindNpc" --direction upstream --repo .`
Expected: Xác định caller là `avatarSession.ts`.

- [ ] **Step 2: Viết lại `avatar-web/server/src/autoFindNpc.ts`**
Tạo runner `AutoFindNpc` với các chức năng:
1. `start(config)`:
   - Đặt `running = true`, chuyển `phase = 'entering_park'`.
   - Gọi `client.enterParkContext()` và chờ ACK `RX -1 [9]`.
   - Bước vào vòng lặp quét chu kỳ (`runCycleLoop`):
     - Lặp `for (let m = fromMap; m <= toMap; m++)`:
       - Lấy vị trí native `getJoinPosition(m)`.
       - Lặp `for (let b = fromBoard; b <= toBoard; b++)`:
         - Kiểm tra nếu `!this.running`: break.
         - Cập nhật `phase = 'scanning'`, `currentMap = m`, `currentBoard = b`.
         - Bắt đầu capture `RX 48` updates (`startMapSpecialCapture`).
         - Gửi `TX 80` với toạ độ native và chờ `waitForParkJoinResponse`.
         - Chờ 150ms để tổng hợp specials từ `RX 48`.
         - Kiểm tra danh sách NPC tìm thấy:
           - So sánh `npc.name.trim().toLowerCase() === targetName.toLowerCase()`.
           - Nếu tìm thấy:
             - Cập nhật `phase = 'waiting_npc'`, `foundNpc = { id: npc.id, name: npc.name, map: m, board: b }`.
             - Thông báo `onFound({ map: m, area: b })`.
             - Lắng nghe `RX 83` (NPC rời đi), `RX 48 remove`, và `'dialog'`.
             - Khi nhận `dialog`:
               - Gọi `parseMaxQuantityDialog(text)`.
               - Nếu `check`: cập nhật `eventRewardProgress = { current: check.current, max: check.max }`, `lastRewardMessage = text`.
               - Nếu `check.isMax && config.stopOnMaxQuantity`:
                 - Cập nhật `dailyLimitReached = true`, `phase = 'daily_limit_reached'`.
                 - Thông báo `onRequestStop?.('daily_limit', text)`.
                 - Thoát chờ và dừng runner.
             - Đứng chờ cho đến khi NPC biến mất hoặc đạt max.
         - Delay giữa các phòng (1200ms).
     - Khi kết thúc 1 lượt duyệt hết các map/board mà chưa đạt max:
       - Tăng `cycleCount++`.
       - Cập nhật `phase = 'waiting_next_cycle'`, đếm lùi `cycleDelaySeconds` (mặc định 30s).
       - Lặp lại lượt quét tiếp theo.
2. `stop()`:
   - Dừng các timers, ngắt listeners, chuyển `phase = 'stopping'` rồi `'idle'`, `running = false`.
3. `updateConfig(config)`:
   - Cập nhật tham số dải map/khu hoặc tên NPC mục tiêu khi đang chạy.

- [ ] **Step 3: Kiểm tra biên dịch**
Run: `npm --prefix avatar-web/server run typecheck`
Expected: Compile thành công không có lỗi type.

- [ ] **Step 4: Kiểm tra GitNexus và commit**
Run: `node .gitnexus/run.cjs detect-changes --scope unstaged --repo .`
Run:
```bash
git add avatar-web/server/src/autoFindNpc.ts
git commit -m "feat(find-npc): rewrite AutoFindNpc runner using park probe engine

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: Tích hợp Runner vào `AvatarSession`, `manager.ts`, và `routes.ts`

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts:1690-1770`
- Modify: `avatar-web/server/src/session/manager.ts:250-270`
- Modify: `avatar-web/server/src/session/routes.ts:390-435`

**Interfaces:**
- Consumes: `AutoFindNpc`, `FindNpcConfig`, `FIND_NPC_DISABLED`
- Produces: API routes quản lý `find_npc`, Session coordinator start/stop runner, WebSocket emit

- [ ] **Step 1: Chạy GitNexus impact analysis trước khi sửa**
Run: `node .gitnexus/run.cjs impact "startFindNpc" --direction upstream --repo .`
Expected: Kiểm tra các luồng gọi `startFindNpc` trong `avatarSession.ts`.

- [ ] **Step 2: Cập nhật `startFindNpc` và `stopFindNpc` trong `avatarSession.ts`**
1. Trong `startFindNpc`:
   - Gỡ bỏ kiểm tra `catalog.length === 0` (vì engine mới dùng toạ độ native trực tiếp, không cần catalog ngoài).
   - Khởi tạo `AutoFindNpc` với callbacks `onState`, `onFound`, `onMissing`, `onRequestStop`.
   - Khi runner gọi `onRequestStop('daily_limit')`:
     - Tự động gọi `this.setDesiredMode('off')` và gửi thông báo log: `[tìm NPC] Đã đạt giới hạn tối đa sự kiện. Dừng tự động tìm NPC.`
   - Khởi chạy `finder.start(this.findNpcConfig.config)`.
2. Trong `stopFindNpc` và `switchMode`:
   - Dừng runner hiện tại qua `await finder.stop()`.

- [ ] **Step 3: Cập nhật `manager.ts`**
Trong `SessionManager.bootstrap()`:
- Gỡ bỏ logic filter loại trừ `find_npc` khi `FIND_NPC_DISABLED === false`, cho phép resume các tài khoản có `desired_mode === 'find_npc'`.

- [ ] **Step 4: Cập nhật `routes.ts`**
1. Trong `POST /api/accounts/:id/automation/start`:
   - Đảm bảo `mode: 'find_npc'` được chấp nhận và khởi động bình thường.
2. Thêm route GET/PUT:
   - `GET /api/accounts/:id/automation/find-npc/config`: Trả về `findNpcConfig`.
   - `PUT /api/accounts/:id/automation/find-npc/config`: Lưu và cập nhật `findNpcConfig`.
   - Giữ route cũ `PUT /api/accounts/:id/automation/find-npc-config/config` để tương thích ngược.

- [ ] **Step 5: Kiểm tra biên dịch**
Run: `npm --prefix avatar-web/server run typecheck`
Expected: Compile thành công không có lỗi type.

- [ ] **Step 6: Kiểm tra GitNexus và commit**
Run: `node .gitnexus/run.cjs detect-changes --scope unstaged --repo .`
Run:
```bash
git add avatar-web/server/src/session/avatarSession.ts avatar-web/server/src/session/manager.ts avatar-web/server/src/session/routes.ts
git commit -m "feat(find-npc): connect AutoFindNpc runner to session coordinator and routes

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: Cập nhật Web UI Frontend (`StatusPanel.tsx`, `AccountOperationsDrawer.tsx`, `FindNpcPanel.tsx`)

**Files:**
- Modify: `avatar-web/web/src/accounts/AccountOperationsDrawer.tsx:25-70`
- Modify: `avatar-web/web/src/accounts/panels/StatusPanel.tsx:50-280`
- Modify: `avatar-web/web/src/accounts/panels/FindNpcPanel.tsx:1-200`

**Interfaces:**
- Consumes: `AutomationSnapshot`, `FindNpcConfig`, `AutoFindNpcState`
- Produces: Web UI tab Tìm NPC, Mode button trong StatusPanel, Live monitor panel

- [ ] **Step 1: Mở lại tab Tìm NPC trong `AccountOperationsDrawer.tsx`**
1. Đặt `const FIND_NPC_TAB_HIDDEN = false;`.
2. Bổ sung `find_npc` vào danh sách tabs hiển thị trên drawer (trong `PANEL_GROUPS` nhóm `operations` hoặc group riêng).

- [ ] **Step 2: Cập nhật `StatusPanel.tsx`**
1. Trong `selectedMode`: Hỗ trợ `'find_npc'`.
2. Thêm button chọn mode:
```tsx
<button
  type="button"
  className={`automation-mode-button${selectedMode === 'find_npc' ? ' active' : ''}`}
  aria-pressed={selectedMode === 'find_npc'}
  disabled={controlsLocked}
  onClick={() => setSelectedMode('find_npc')}
>
  🎯 Tìm NPC
</button>
```
3. Trong `automationProgress`: Format hiển thị live của `find_npc`:
```tsx
if (progressMode === 'find_npc') {
  const f = automation.findNpcRuntime;
  const mapStr = f?.currentMap !== null && f?.currentMap !== undefined ? `Map ${f.currentMap} - Khu ${f.currentBoard ?? 0}` : 'đang vào công viên';
  const statusStr =
    f?.phase === 'waiting_npc'
      ? ` · 🎯 đang chờ ${f.foundNpc?.name ?? 'NPC'} (${f.waitingSeconds ?? 0}s)`
      : f?.phase === 'daily_limit_reached'
      ? ' · ⚠️ đã đạt giới hạn ngày'
      : f?.phase === 'waiting_next_cycle'
      ? ' · ⏳ chờ vòng quét tiếp'
      : ' · 🔍 đang quét';
  const progressStr = f?.eventRewardProgress ? ` · 🎁 ${f.eventRewardProgress.current}/${f.eventRewardProgress.max}` : '';
  return `tìm NPC: ${mapStr}${statusStr}${progressStr}`;
}
```

- [ ] **Step 3: Cập nhật `FindNpcPanel.tsx`**
1. Nâng cấp form cài đặt:
   - Input: Tên NPC (`npcName`).
   - Inputs: Dải Map (`fromMap` - `toMap`).
   - Inputs: Dải Khu (`fromBoard` - `toBoard`).
   - Switch checkbox: Dừng khi đạt giới hạn ngày (`stopOnMaxQuantity`).
   - Input: Thời gian nghỉ giữa các vòng (`cycleDelaySeconds`).
2. Nâng cấp bảng trạng thái Live:
   - Hiển thị phòng hiện tại đang quét (`Map ${currentMap} - Khu ${currentBoard}`).
   - Khi tìm thấy NPC: Box nổi bật hiển thị tên, ID, phòng và số giây đã đứng chờ.
   - Khi có tiến độ quà: Progress bar hoặc badge hiển thị `Số lượng: current/max` (ví dụ `50/50`).
   - Box cảnh báo khi `dailyLimitReached === true`: Đã nhận đủ quà trong ngày.
   - Nút Bắt đầu / Dừng nhanh.

- [ ] **Step 4: Kiểm tra biên dịch & Build frontend**
Run: `npm --prefix avatar-web/web run build`
Expected: Build Vite production thành công không có lỗi type hay syntax.

- [ ] **Step 5: Kiểm tra GitNexus và commit**
Run: `node .gitnexus/run.cjs detect-changes --scope unstaged --repo .`
Run:
```bash
git add avatar-web/web/src/accounts/AccountOperationsDrawer.tsx avatar-web/web/src/accounts/panels/StatusPanel.tsx avatar-web/web/src/accounts/panels/FindNpcPanel.tsx
git commit -m "feat(find-npc): integrate Find NPC mode controls and live panel into web UI

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: Kiểm tra toàn diện End-to-End

**Files:**
- Execute: Backend & Frontend

- [ ] **Step 1: Chạy Typecheck toàn bộ workspace**
Run:
```bash
npm --prefix avatar-web/server run typecheck
npm --prefix avatar-web/web run build
```
Expected: Exit 0 cho cả server và frontend.

- [ ] **Step 2: Khởi động server dev và kiểm tra API**
Run:
```bash
(cd avatar-web/server && node --env-file=.env --import tsx -e '
import { loadConfig } from "./src/config.js";
import { openDb } from "./src/db/index.js";
import { getFindNpcConfig } from "./src/accounts/automationRepo.js";
const db = openDb(loadConfig().dbPath);
console.log("Config account 3:", getFindNpcConfig(db, 3));
db.close();
')
```
Expected: Đọc cấu hình `findNpcConfig` thành công từ SQLite.

- [ ] **Step 3: Cập nhật hoàn thành Implementation Plan**
Tích chọn toàn bộ các checklist item `- [x]` trong plan file.
Run:
```bash
git add docs/superpowers/plans/2026-09-23-tich-hop-tim-npc-web-auto.md
git commit -m "docs(find-npc): mark implementation plan complete

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```
