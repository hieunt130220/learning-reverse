# Auto Switch to Farm Mode After NPC and Maze Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tự động chuyển tài khoản sang chế độ Nông trại (`auto_farm`) khi chế độ Tìm NPC hoặc Mê cung dừng lại (hoàn thành hoặc lỗi), đồng thời đồng bộ trạng thái xuống cơ sở dữ liệu SQLite và cập nhật giao diện web.

**Architecture:** Bổ sung callback `onDesiredModeChange` vào `AvatarSessionOptions` để cập nhật `avatar_automation_state.desired_mode` trong SQLite mỗi khi session chuyển `desiredMode`. Trong `AvatarSession`, cấu hình các callback `onRequestStop` và `onTerminalFailure` của `AutoFindNpc` và `AutoMazeRunner` gọi `switchAutomationMode` với `desiredMode: 'auto_farm'`. Trên web UI `StatusPanel`, khi người dùng bấm dừng thủ công lúc đang ở mode `find_npc` hoặc `auto_maze`, giao diện chuyển chọn sẵn sang mode `auto_farm`.

**Tech Stack:** TypeScript, Node.js / Bun, React, SQLite (`better-sqlite3`), WebSocket

**Spec:** `docs/superpowers/specs/2026-09-26-auto-switch-farm-after-npc-maze-design.md`

## Global Constraints

- Tuân thủ quy định KHÔNG TDD theo `CLAUDE.md`: Không viết test trước khi viết code, không tạo test file mới trừ khi có yêu cầu rõ ràng.
- Chạy `gitnexus_impact` trước khi sửa code và `gitnexus_detect_changes` trước khi commit.
- Kết thúc commit message với `Co-Authored-By: Claude Code <noreply@anthropic.com>`.

---

### Task 1: Bổ sung callback persistence `onDesiredModeChange` cho AvatarSession và SessionManager

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts:200-240, 580-605`
- Modify: `avatar-web/server/src/session/manager.ts:365-385`

**Interfaces:**
- Consumes: `setDesiredMode(db, accountId, mode)` từ `avatar-web/server/src/accounts/automationRepo.ts`
- Produces: `onDesiredModeChange?: (mode: AutomationMode) => void` trên `AvatarSessionOptions`

- [ ] **Step 1: Thêm `onDesiredModeChange` vào `AvatarSessionOptions` và gọi trong `switchAutomationMode`**

Trong `avatar-web/server/src/session/avatarSession.ts`:
1. Bổ sung trường `onDesiredModeChange` vào `AvatarSessionOptions`:
```ts
export interface AvatarSessionOptions {
  accountId: number;
  loadCredentials: () => Promise<AvatarCredentials>;
  onEvent: (type: string, payload: unknown) => void;
  onPermanentFailure: (reason: string) => void;
  onAutomationFailure?: (reason: string) => void;
  onAutomationLocation: (location: NpcMapLocation | null) => void;
  onDesiredModeChange?: (mode: AutomationMode) => void;
  // ...
}
```

2. Trong hàm `switchAutomationMode`:
Sau khi gán `this.desiredMode = intent.desiredMode;`:
```ts
        this.desiredMode = intent.desiredMode;
        try {
          this.opts.onDesiredModeChange?.(intent.desiredMode);
        } catch {
          /* bỏ qua lỗi callback persistence */
        }
```

- [ ] **Step 2: Đăng ký `onDesiredModeChange` trong `SessionManager`**

Trong `avatar-web/server/src/session/manager.ts`, hàm `getOrCreate`:
Bổ sung `onDesiredModeChange` vào `opts`:
```ts
      onAutomationLocation: (location) => {
        saveAutomationLocation(db, accountId, location);
      },
      onDesiredModeChange: (mode) => {
        try {
          setDesiredMode(db, accountId, mode);
        } catch {
          /* bỏ qua lỗi persist */
        }
      },
      onMetrics: (patch) => {
```

- [ ] **Step 3: Kiểm tra biên dịch server**

Run: `cd avatar-web/server && npm run build`
Expected: Biên dịch TypeScript thành công, không có lỗi type error.

- [ ] **Step 4: Commit**

Run:
```bash
git add avatar-web/server/src/session/avatarSession.ts avatar-web/server/src/session/manager.ts
git commit -m "feat(server): add onDesiredModeChange persistence callback to AvatarSession

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: Cập nhật AutoFindNpc và AutoMazeRunner tự động chuyển sang mode nông trại khi dừng/lỗi

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts:1745-1790, 1900-1925`

**Interfaces:**
- Consumes: `this.switchAutomationMode({ desiredMode: 'auto_farm', ... })`
- Produces: Luồng chuyển tiếp tự động sang Nông trại khi runner hoàn thành nhiệm vụ hoặc gặp lỗi

- [ ] **Step 1: Cập nhật `onRequestStop` và `onTerminalFailure` trong `startFindNpc`**

Trong `avatar-web/server/src/session/avatarSession.ts`:
Tìm `startFindNpc`, cập nhật callback `onRequestStop`:
```ts
      onRequestStop: (_reason, message) => {
        if (this.findNpc !== finder) return;
        if (message) this.pushLog(`[tìm NPC] ${message}`);
        this.pushLog('[tìm NPC] chuyển sang chế độ tự động nông trại.');
        void this.switchAutomationMode({
          desiredMode: 'auto_farm',
          findNpcConfig: this.findNpcConfig,
          fishingConfig: this.fishingConfig,
          miningConfig: this.miningConfig,
          mazeConfig: this.mazeConfig,
          location: this.automationLocation,
        });
      },
```

Cập nhật `onTerminalFailure`:
```ts
      onTerminalFailure: (error) => {
        if (
          this.findNpc !== finder
          || !this.isAutomationGenerationCurrent(generation)
          || !this.isCurrent(client, epoch)
        ) return;
        this.findNpc = undefined;
        this.pushLog(`[tìm NPC] lỗi: ${error.message} — chuyển sang chế độ tự động nông trại.`);
        void this.switchAutomationMode({
          desiredMode: 'auto_farm',
          findNpcConfig: this.findNpcConfig,
          fishingConfig: this.fishingConfig,
          miningConfig: this.miningConfig,
          mazeConfig: this.mazeConfig,
          location: null,
        });
      },
```

- [ ] **Step 2: Cập nhật `onRequestStop` của AutoMazeRunner trong `startDesiredAutomation`**

Trong `avatar-web/server/src/session/avatarSession.ts`:
Tìm khối `if (this.desiredMode === 'auto_maze')`, cập nhật callback `onRequestStop`:
```ts
        onRequestStop: (_reason, message) => {
          if (message) this.pushLog(`[mê cung] ${message}`);
          this.pushLog('[mê cung] chuyển sang chế độ tự động nông trại.');
          void this.switchAutomationMode({
            desiredMode: 'auto_farm',
            findNpcConfig: this.findNpcConfig,
            fishingConfig: this.fishingConfig,
            miningConfig: this.miningConfig,
            mazeConfig: this.mazeConfig,
            location: this.automationLocation,
          });
        },
```

- [ ] **Step 3: Kiểm tra biên dịch server và chạy unit tests**

Run: `cd avatar-web/server && npm run build && npm test`
Expected: Biên dịch và các test hiện có vượt qua (PASS).

- [ ] **Step 4: Commit**

Run:
```bash
git add avatar-web/server/src/session/avatarSession.ts
git commit -m "feat(session): auto switch to farm mode when find npc or maze stops

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: Cập nhật giao diện Web UI khi dừng thủ công trên StatusPanel

**Files:**
- Modify: `avatar-web/web/src/accounts/panels/StatusPanel.tsx:210-230`

**Interfaces:**
- Consumes: `selectedMode`, `setSelectedMode('auto_farm')`
- Produces: UI tự động chuyển mode đã chọn sang `auto_farm` khi bấm Dừng thủ công từ mode tìm NPC hoặc mê cung

- [ ] **Step 1: Cập nhật `stopAuto()` trong `StatusPanel.tsx`**

Trong `avatar-web/web/src/accounts/panels/StatusPanel.tsx`:
Trong hàm `stopAuto()`:
```tsx
  async function stopAuto() {
    if (!autoActive || mutationBusy) return;
    setAutoAction('stop');
    onAutomationMutationBusyChange(true);
    setAutoErr('');
    try {
      const loaded = await apiPost<AutomationSnapshot>(
        `/api/accounts/${accountId}/automation/stop`,
        {},
      );
      if (loaded) onAutomationChange?.(loaded);
      if (selectedMode === 'find_npc' || selectedMode === 'auto_maze') {
        setSelectedMode('auto_farm');
      }
      onChanged();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        const loaded = (error.body as { snapshot?: AutomationSnapshot })?.snapshot;
        if (loaded) onAutomationChange?.(loaded);
        if (selectedMode === 'find_npc' || selectedMode === 'auto_maze') {
          setSelectedMode('auto_farm');
        }
        onChanged();
      } else {
        setAutoErr((error as Error).message);
      }
    } finally {
      setAutoAction(null);
      onAutomationMutationBusyChange(false);
    }
  }
```

- [ ] **Step 2: Kiểm tra biên dịch frontend web**

Run: `cd avatar-web/web && npm run build`
Expected: Frontend build thành công, không có lỗi syntax/type error.

- [ ] **Step 3: Commit**

Run:
```bash
git add avatar-web/web/src/accounts/panels/StatusPanel.tsx
git commit -m "fix(web): switch selected mode to auto_farm after manual stop of npc or maze

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: Kiểm tra toàn diện và xác nhận GitNexus

**Files:**
- Kiểm tra toàn bộ các file đã chỉnh sửa.

- [ ] **Step 1: Chạy build toàn bộ project**

Run: `cd avatar-web/server && npm run build && cd ../web && npm run build`
Expected: Cả server và web frontend build thành công.

- [ ] **Step 2: Chạy kiểm tra GitNexus detect_changes**

Run: `detect_changes({scope: "all"})`
Expected: Phân tích các thay đổi trên graph, không có rủi ro nghiêm trọng chưa được xử lý.
