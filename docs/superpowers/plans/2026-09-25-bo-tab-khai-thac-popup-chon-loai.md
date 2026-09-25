# Kế Hoạch Thực Hiện: Bỏ Tab Khai Thác & Thêm Popup Chọn Loại Khai Thác Khi Bật Auto

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bỏ tab Khai thác khỏi Drawer console và Cài đặt, đồng thời thêm popup modal cho phép người dùng chọn loại tài nguyên (Đá / Gỗ / Cả hai) khi bấm nút "Bắt đầu" ở chế độ Khai thác gỗ/đá.

**Architecture:** Tạo component `MiningTargetModal.tsx` quản lý việc đọc/ghi cấu hình mục tiêu khai thác qua REST API và kích hoạt `auto_mining`. Tích hợp modal vào `StatusPanel.tsx` để chặn luồng start auto thông thường khi mode là `auto_mining`. Xóa bỏ các tab, sub-tab và component khai thác cũ (`MiningPanel.tsx`, `MiningSettingsPanel.tsx`).

**Tech Stack:** React, TypeScript, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-25-bo-tab-khai-thac-popup-chon-loai-design.md`

## Global Constraints
- Tuân thủ quy tắc không dùng TDD (không test-first, viết code trước, cập nhật test sau).
- Giữ nguyên các quy chuẩn modal hiện tại (`dialog-backdrop`, `account-modal`, `useDialogFocus`, phím ESC, đóng khi click backdrop).
- Chạy `gitnexus_impact` trước khi sửa code và `gitnexus_detect_changes` trước khi commit.

---

### Task 1: Xây Dựng Component `MiningTargetModal.tsx`

**Files:**
- Create: `avatar-web/web/src/accounts/MiningTargetModal.tsx`

**Interfaces:**
- Consumes:
  - `apiGet`, `apiPut`, `apiPost` từ `../api.js`
  - `MiningConfig`, `MiningTarget`, `StoredMiningConfigState`, `AutomationSnapshot` từ `../types.js`
  - `useDialogFocus` từ `./useDialogFocus.js`
- Produces:
  - React Component `MiningTargetModal` nhận props:
    ```typescript
    export interface MiningTargetModalProps {
      open: boolean;
      accountId: number;
      onClose(): void;
      onSuccess(snapshot: AutomationSnapshot): void;
    }
    ```

- [ ] **Step 1: Viết Component `MiningTargetModal.tsx`**

```tsx
import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react';

import { apiGet, apiPost, apiPut } from '../api.js';
import type {
  AutomationSnapshot,
  MiningConfig,
  MiningTarget,
  StoredMiningConfigState,
} from '../types.js';
import { useDialogFocus } from './useDialogFocus.js';

export interface MiningTargetModalProps {
  open: boolean;
  accountId: number;
  onClose(): void;
  onSuccess(snapshot: AutomationSnapshot): void;
}

const TARGET_OPTIONS: Array<{
  value: MiningTarget;
  label: string;
  desc: string;
  icon: string;
}> = [
  {
    value: 'diamond',
    label: 'Khai thác Đá (Kim cương)',
    desc: 'Room 26 (Mỏ Đá Ngoại Ô) — 4 mỏ kim cương trữ lượng 3000/mỏ',
    icon: '💎',
  },
  {
    value: 'wood',
    label: 'Khai thác Gỗ (Củi khô)',
    desc: 'Room 22 (Rừng Cây Ngoại Ô) — Khai thác củi từ thân cây khô (Khu 1-9)',
    icon: '🪵',
  },
  {
    value: 'patrol',
    label: 'Tuần Tra Cả Hai (Đá & Gỗ)',
    desc: 'Đào hết kim cương ở Room 26 rồi chuyển sang chặt củi ở Room 22',
    icon: '🔄',
  },
];

export function MiningTargetModal({
  open,
  accountId,
  onClose,
  onSuccess,
}: MiningTargetModalProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const firstOptionRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [target, setTarget] = useState<MiningTarget>('diamond');
  const [revision, setRevision] = useState(0);
  const [currentConfig, setCurrentConfig] = useState<MiningConfig | null>(null);

  useDialogFocus({ open, containerRef: dialogRef, initialFocusRef: firstOptionRef, onClose });

  useEffect(() => {
    if (!open || !accountId) return;
    let active = true;
    setLoading(true);
    setError('');

    apiGet<StoredMiningConfigState>(`/api/accounts/${accountId}/automation/mining/config`)
      .then((data) => {
        if (!active) return;
        setRevision(data.revision);
        setTarget(data.config.target);
        setCurrentConfig(data.config);
      })
      .catch((err) => {
        if (!active) return;
        // Nếu lỗi tải, vẫn cho phép chọn target với revision 0
        setError((err as Error).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, accountId]);

  if (!open) return null;

  function onBackdrop(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget && !busy) onClose();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy || !accountId) return;
    setBusy(true);
    setError('');

    try {
      // 1. Cập nhật cấu hình mục tiêu khai thác
      const nextConfig: MiningConfig = {
        target,
        startArea: currentConfig?.startArea ?? 0,
        switchAreaWhenDepleted: currentConfig?.switchAreaWhenDepleted ?? true,
        maxAreasToScan: currentConfig?.maxAreasToScan ?? 10,
        delayBetweenActionsMs: currentConfig?.delayBetweenActionsMs ?? 3000,
      };

      const putRes = await apiPut<StoredMiningConfigState>(
        `/api/accounts/${accountId}/automation/mining/config`,
        {
          expectedRevision: revision,
          config: nextConfig,
        },
      );
      setRevision(putRes.revision);

      // 2. Kích hoạt auto_mining
      const startRes = await apiPost<AutomationSnapshot>(
        `/api/accounts/${accountId}/automation/start`,
        { mode: 'auto_mining' },
      );

      onSuccess(startRes);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop dialog-backdrop--modal" onMouseDown={onBackdrop}>
      <section
        ref={dialogRef}
        className="account-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mining-target-title"
        style={{ maxWidth: '480px', width: '100%' }}
      >
        <header className="dialog-heading">
          <h2 id="mining-target-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⛏️</span> Chọn Loại Khai Thác
          </h2>
          <button type="button" className="ghost" onClick={onClose} disabled={busy} aria-label="Đóng">
            ×
          </button>
        </header>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
          <p className="hint" style={{ margin: 0 }}>
            Chọn tài nguyên bạn muốn tự động khai thác khi bắt đầu:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {TARGET_OPTIONS.map((opt, idx) => {
              const isSelected = target === opt.value;
              return (
                <label
                  key={opt.value}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    background: isSelected ? 'rgba(88, 166, 255, 0.12)' : 'var(--bg-deep, #111722)',
                    border: `1.5px solid ${isSelected ? 'var(--accent, #58a6ff)' : 'var(--line, #30363d)'}`,
                    cursor: busy ? 'not-allowed' : 'pointer',
                    transition: 'border-color 0.15s, background-color 0.15s',
                  }}
                >
                  <input
                    ref={idx === 0 ? firstOptionRef : undefined}
                    type="radio"
                    name="miningTarget"
                    value={opt.value}
                    checked={isSelected}
                    disabled={busy}
                    onChange={() => setTarget(opt.value)}
                    style={{ marginTop: '3px' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem', color: isSelected ? 'var(--accent, #58a6ff)' : 'inherit' }}>
                      {opt.icon} {opt.label}
                    </div>
                    <small style={{ color: 'var(--muted, #8b949e)', display: 'block', marginTop: '2px', lineHeight: 1.35 }}>
                      {opt.desc}
                    </small>
                  </div>
                </label>
              );
            })}
          </div>

          {error && <p className="err" style={{ margin: 0 }}>{error}</p>}

          <footer className="dialog-actions" style={{ marginTop: '0.5rem' }}>
            <button type="button" className="ghost" onClick={onClose} disabled={busy}>
              Hủy
            </button>
            <button type="submit" disabled={busy || loading}>
              {busy ? 'Đang kích hoạt…' : 'Bắt đầu khai thác'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Commit**
`git commit -m "feat(web): add MiningTargetModal component"`

---

### Task 2: Tích Hợp `MiningTargetModal` Vào `StatusPanel.tsx`

**Files:**
- Modify: `avatar-web/web/src/accounts/panels/StatusPanel.tsx`
- Modify: `avatar-web/web/src/accounts/panels/StatusPanel.test.tsx`

**Interfaces:**
- Consumes: `MiningTargetModal` từ `../MiningTargetModal.js`.
- Produces: Khi `selectedMode === 'auto_mining'` và bấm nút "Bắt đầu", `StatusPanel` mở modal popup thay vì gửi request trực tiếp.

- [ ] **Step 1: Cập nhật `StatusPanel.tsx`**
  - Import `MiningTargetModal`.
  - Thêm state `const [showMiningModal, setShowMiningModal] = useState(false);`.
  - Trong `startAuto()`:
    ```tsx
    if (selectedMode === 'auto_mining') {
      setShowMiningModal(true);
      return;
    }
    ```
  - Thêm handler khi modal kích hoạt thành công:
    ```tsx
    function handleMiningStarted(snapshot: AutomationSnapshot) {
      if (snapshot) onAutomationChange?.(snapshot);
      onChanged();
    }
    ```
  - Render `<MiningTargetModal open={showMiningModal} accountId={accountId} onClose={() => setShowMiningModal(false)} onSuccess={handleMiningStarted} />` bên dưới JSX.

- [ ] **Step 2: Cập nhật Unit Tests trong `StatusPanel.test.tsx`**
  - Bổ sung mock cho `GET /api/accounts/1/automation/mining/config` và `PUT /api/accounts/1/automation/mining/config`.
  - Viết test case: Bấm chọn `⛏️ Khai thác gỗ/đá` -> bấm `Bắt đầu` -> modal "Chọn Loại Khai Thác" xuất hiện -> chọn "Khai thác Gỗ (Củi khô)" -> bấm "Bắt đầu khai thác" -> gọi đúng PUT config và POST automation/start.

- [ ] **Step 3: Chạy test xác minh**
Run: `cd avatar-web/web && npx vitest run src/accounts/panels/StatusPanel.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**
`git commit -m "feat(web): integrate MiningTargetModal into StatusPanel"`

---

### Task 3: Bỏ Tab Khai Thác Khỏi Drawer Console Và Tab Cài Đặt

**Files:**
- Modify: `avatar-web/web/src/accounts/AccountOperationsDrawer.tsx`
- Modify: `avatar-web/web/src/accounts/panels/SettingsPanel.tsx`
- Delete: `avatar-web/web/src/accounts/panels/MiningPanel.tsx`
- Delete: `avatar-web/web/src/accounts/panels/MiningSettingsPanel.tsx`

**Interfaces:**
- Consumes: None (loại bỏ liên kết không dùng).
- Produces: Giao diện drawer và settings panel sạch sẽ, không còn tab/subtab mining.

- [ ] **Step 1: Cập nhật `AccountOperationsDrawer.tsx`**
  - Bỏ `['mining', '⛏️ Khai thác'],` trong `PANEL_TABS`.
  - Bỏ `{ id: 'mining', label: '⛏️ Khai thác', panels: ['mining'] },` trong `PANEL_GROUPS`.
  - Bỏ `{ id: 'mining', label: '⛏️ Khai thác', icon: '⛏️', hotkey: '4' },` trong `DESKTOP_CONSOLE_GROUPS` và đánh số lại hotkey 1..7:
    - 1: operations
    - 2: farm
    - 3: fishing
    - 4: maze
    - 5: find_npc
    - 6: assets
    - 7: logs
  - Xóa import `MiningPanel` và slot `<div id="drawer-panel-mining">`.

- [ ] **Step 2: Cập nhật `SettingsPanel.tsx`**
  - Bỏ `'mining'` khỏi kiểu `SettingsSubTab` (`type SettingsSubTab = 'farm' | 'fishing';`).
  - Xóa button `#settings-tab-mining`.
  - Xóa slot `#settings-panel-mining` và import `MiningSettingsPanel`.

- [ ] **Step 3: Xóa hai file component cũ không còn sử dụng**
  - Xóa `avatar-web/web/src/accounts/panels/MiningPanel.tsx`
  - Xóa `avatar-web/web/src/accounts/panels/MiningSettingsPanel.tsx`

- [ ] **Step 4: Commit**
`git commit -m "refactor(web): remove mining tabs and unused panels from drawer and settings"`

---

### Task 4: Chạy Toàn Bộ Test Suite Và Verify End-to-End

**Files:**
- Modify: `avatar-web/web/src/accounts/accountsRoutes.test.tsx` (nếu cần cập nhật mock)

- [ ] **Step 1: Chạy test toàn bộ web**
Run: `cd avatar-web/web && npm test -- --run`
Expected: Tất cả các file test pass 100%.

- [ ] **Step 2: Verify `detect_changes`**
Run: `mcp__gitnexus__detect_changes` để phân tích đồ thị trước khi hoàn tất.

- [ ] **Step 3: Commit**
`git commit -m "test(web): verify all tests pass after removing mining tabs"`
