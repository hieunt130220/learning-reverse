# Avatar Web Dashboard Card and Operations Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay bảng tài khoản bằng dashboard card responsive, mở phần Vận hành trong drawer theo route và giữ Debug ở trang riêng mà không đổi backend.

**Architecture:** Route cha `/accounts` dùng `AccountsProvider` để giữ danh sách và xử lý sự kiện WebSocket nhẹ. Dashboard render card và một Outlet cho drawer `/accounts/:id`; drawer và trang `/accounts/:id/debug` dùng chung `useAccountRuntime` để subscribe đúng một tài khoản và xử lý sự kiện nặng bằng một reducer thuần. Modal thêm tài khoản, drawer và card dùng các API hiện có.

**Tech Stack:** React 18, TypeScript 5.7 strict, React Router 6, Vite 6, Vitest 3, jsdom 26, React Testing Library 16, WebSocket client hiện có.

**Spec:** [docs/superpowers/specs/2026-08-12-avatar-web-dashboard-drawer-design.md](../specs/2026-08-12-avatar-web-dashboard-drawer-design.md)

## Global Constraints

- Chỉ thay đổi `avatar-web/web/`, file spec và file plan; không thay đổi `avatar-web/server/`.
- Không sao chép mã nguồn, CSS, hình ảnh hoặc tài nguyên từ `3x.4utovip.com`.
- Giữ nguyên REST API, định dạng WebSocket, SQLite và logic session hiện có.
- Không thêm uptime vào card vì `SessionSnapshot` không có dữ liệu này.
- Mọi chuỗi UI và lỗi hướng tới người dùng viết bằng tiếng Việt có dấu.
- Không tạo WebSocket mới; tiếp tục dùng singleton trong `web/src/ws.ts`.
- Chỉ account đang mở drawer/Debug được subscribe event nặng.
- TypeScript giữ `strict: true`; không thêm `any`, `@ts-ignore` hoặc type assertion để che lỗi thiết kế mới. `WsMessage.payload` là `any` có sẵn và không nằm trong phạm vi sửa.
- Không commit, stage hoặc sửa các thay đổi không thuộc task. Chỉ commit nếu người dùng yêu cầu rõ ràng sau này.
- Worktree hiện có thay đổi ngoài phạm vi; không reset, checkout hoặc ghi đè chúng.

## GitNexus Preflight Bắt Buộc

Index cục bộ đã được làm mới đến commit `6c003cf`. Báo cáo tại thời điểm lập plan:

- `AccountsPage`: LOW, 0 caller trực tiếp, 0 process bị ảnh hưởng.
- `AccountDetailPage`: LOW, 0 caller trực tiếp, 0 process bị ảnh hưởng.
- `StatusBadge`: LOW, 0 caller trực tiếp, 0 process bị ảnh hưởng.
- `subscribeAccounts`: LOW, 2 caller trực tiếp (`AccountsPage`, `AccountDetailPage`), ảnh hưởng trực tiếp khu vực Accounts và một luồng Accounts.

Trước khi thực thi plan trong phiên khác, chạy lại:

```bash
cd /Users/devios/learning-reverse
node .gitnexus/run.cjs status
node .gitnexus/run.cjs impact AccountsPage --direction upstream --repo learning-reverse --depth 3 --include-tests
node .gitnexus/run.cjs impact AccountDetailPage --direction upstream --repo learning-reverse --depth 3 --include-tests
node .gitnexus/run.cjs impact StatusBadge --direction upstream --repo learning-reverse --depth 3 --include-tests
node .gitnexus/run.cjs impact subscribeAccounts --direction upstream --repo learning-reverse --depth 3 --include-tests
```

Nếu index stale, chạy `node .gitnexus/run.cjs analyze --force` rồi kiểm tra lại. Nếu bất kỳ symbol nào chuyển thành HIGH hoặc CRITICAL, dừng và báo người dùng blast radius trước khi sửa. Trước khi sửa thêm một symbol hiện hữu chưa có trong danh sách trên, chạy impact riêng cho symbol đó.

## File Structure

**Tạo mới:**

| File | Trách nhiệm |
|---|---|
| `web/src/App.tsx` | Route shell có thể test độc lập với `BrowserRouter` |
| `web/src/test/setup.ts` | Thiết lập jest-dom, cleanup và DOM shim cho test |
| `web/src/test/fixtures.ts` | Factory `SessionSnapshot` và `AccountWithRuntime` dùng chung |
| `web/src/accounts/accountRuntime.ts` | Reducer thuần cho event runtime |
| `web/src/accounts/accountRuntime.test.ts` | Test reducer |
| `web/src/accounts/useAccountRuntime.ts` | Hook subscribe/unsubscribe một account |
| `web/src/accounts/useAccountRuntime.test.tsx` | Test vòng đời subscription |
| `web/src/accounts/AccountStatus.tsx` | `statusLabel` và `StatusBadge` dùng chung |
| `web/src/accounts/AccountsProvider.tsx` | Danh sách, reload và sự kiện WS nhẹ |
| `web/src/accounts/AccountsProvider.test.tsx` | Test provider |
| `web/src/accounts/AccountCard.tsx` | Card trạng thái và thao tác account |
| `web/src/accounts/AccountCard.test.tsx` | Test card và chống navigation ngoài ý muốn |
| `web/src/accounts/useDialogFocus.ts` | Escape, focus trap, scroll lock, restore focus |
| `web/src/accounts/AddAccountModal.tsx` | Modal tạo tài khoản |
| `web/src/accounts/AddAccountModal.test.tsx` | Test modal và focus |
| `web/src/accounts/AccountsDashboardPage.tsx` | Header, grid, empty/error, modal và Outlet drawer |
| `web/src/accounts/AccountOperationsDrawer.tsx` | Drawer ghép bốn panel Vận hành |
| `web/src/accounts/AccountDebugPage.tsx` | Trang Debug riêng |
| `web/src/accounts/accountsRoutes.test.tsx` | Test route dashboard/drawer/Debug |

**Sửa:**

- `web/package.json`
- `web/package-lock.json`
- `web/vite.config.ts`
- `web/src/main.tsx`
- `web/src/styles.css`
- `web/src/accounts/panels/StatusPanel.tsx`

**Xóa sau khi route mới đã pass:**

- `web/src/accounts/AccountsPage.tsx`
- `web/src/accounts/AccountDetailPage.tsx`

---

### Task 1: Test Harness, Runtime Reducer, and Subscription Hook

**Files:**

- Modify: `avatar-web/web/package.json`
- Modify: `avatar-web/web/package-lock.json`
- Modify: `avatar-web/web/vite.config.ts`
- Create: `avatar-web/web/src/test/setup.ts`
- Create: `avatar-web/web/src/test/fixtures.ts`
- Create: `avatar-web/web/src/accounts/accountRuntime.ts`
- Test: `avatar-web/web/src/accounts/accountRuntime.test.ts`
- Create: `avatar-web/web/src/accounts/useAccountRuntime.ts`
- Test: `avatar-web/web/src/accounts/useAccountRuntime.test.tsx`

**Interfaces:**

- Consumes:
  - `WsMessage` from `web/src/ws.ts`.
  - `SessionSnapshot` and `AccountWithRuntime` from `web/src/types.ts`.
  - `subscribeAccounts(ids: number[]): void`.
  - `onWsMessage(listener): () => void`.
- Produces:
  - `makeSnapshot(overrides?: Partial<SessionSnapshot>): SessionSnapshot` test factory.
  - `makeAccount(overrides?: Partial<AccountWithRuntime>): AccountWithRuntime` test factory.
  - `reduceAccountRuntime(accountId: number, current: SessionSnapshot | null, message: WsMessage): SessionSnapshot | null`.
  - `useAccountRuntime(accountId: number, initialSnapshot: SessionSnapshot | null): SessionSnapshot | null`.

- [ ] **Step 1: Cài test dependencies bằng cache ghi được**

Run:

```bash
cd /Users/devios/learning-reverse/avatar-web/web
npm install --save-dev --cache /private/tmp/avatar-web-npm-cache \
  vitest@3.2.4 jsdom@26.1.0 \
  @testing-library/react@16.3.0 \
  @testing-library/user-event@14.6.1 \
  @testing-library/jest-dom@6.6.3
```

Sửa scripts trong `package.json`:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "test": "vitest run",
  "test:watch": "vitest",
  "preview": "vite preview"
}
```

Không dùng cache mặc định `~/.npm`: máy hiện tại có cache root-owned và trả EPERM.

- [ ] **Step 2: Cấu hình Vitest và test setup**

Đổi import đầu `vite.config.ts` sang:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
```

Giữ nguyên proxy và thêm vào object cấu hình:

```ts
test: {
  environment: 'jsdom',
  setupFiles: './src/test/setup.ts',
  clearMocks: true,
  restoreMocks: true,
},
```

Tạo `src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => cleanup());

Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  configurable: true,
  value: vi.fn(),
});
```

- [ ] **Step 3: Tạo fixture dùng chung**

Tạo `src/test/fixtures.ts`:

```ts
import type { AccountWithRuntime, SessionSnapshot } from '../types.js';

export function makeSnapshot(overrides: Partial<SessionSnapshot> = {}): SessionSnapshot {
  return {
    accountId: 1,
    status: 'online',
    playerId: 101,
    money: 1_250_000,
    auto: { running: true, cycle: 32, lastActions: [] },
    macro: { running: false, cycle: 0 },
    inventory: [],
    trees: [],
    items: [],
    animals: [],
    logs: [],
    traffic: [],
    retries: 0,
    desiredConnected: true,
    ...overrides,
  };
}

export function makeAccount(overrides: Partial<AccountWithRuntime> = {}): AccountWithRuntime {
  const id = overrides.id ?? 1;
  return {
    id,
    label: 'Farm chính',
    gameUser: 'avatar01',
    host: '27.0.14.120',
    port: 19129,
    autoEnabled: true,
    hasPassword: true,
    createdAt: 1,
    updatedAt: 1,
    runtime: makeSnapshot({ accountId: id }),
    ...overrides,
  };
}
```

- [ ] **Step 4: Viết failing tests cho reducer**

Tạo `src/accounts/accountRuntime.test.ts` với các case cụ thể:

```ts
import { describe, expect, test } from 'vitest';

import { makeSnapshot } from '../test/fixtures.js';
import type { WsMessage } from '../ws.js';
import { reduceAccountRuntime } from './accountRuntime.js';

const event = (type: string, payload: WsMessage['payload'], accountId = 1): WsMessage => ({
  type,
  payload,
  accountId,
});

describe('reduceAccountRuntime', () => {
  test('snapshot thay toàn bộ runtime', () => {
    const next = makeSnapshot({ money: 99 });
    expect(reduceAccountRuntime(1, makeSnapshot({ money: 1 }), event('snapshot', next))).toBe(next);
  });

  test.each([
    ['status', 'error', 'status'],
    ['auto', { running: false, cycle: 7, lastActions: [] }, 'auto'],
    ['macro', { running: true, cycle: 2 }, 'macro'],
    ['farm', { idFarm: 7, cells: [], animals: [], updatedAt: 3 }, 'farm'],
    ['inventory', [{ id: 12, num: 4 }], 'inventory'],
  ] as const)('%s chỉ cập nhật trường %s', (type, payload, key) => {
    const before = makeSnapshot();
    const after = reduceAccountRuntime(1, before, event(type, payload));
    expect(after).toEqual({ ...before, [key]: payload });
  });

  test('money đọc balance và giữ các trường khác', () => {
    const before = makeSnapshot({ money: 1 });
    expect(reduceAccountRuntime(1, before, event('money', { balance: 88 }))).toEqual({
      ...before,
      money: 88,
    });
  });

  test('trees cập nhật đồng thời cây, vật phẩm và vật nuôi', () => {
    const before = makeSnapshot();
    const payload = {
      trees: [{ id: 1, name: 'Khế', growMinutes: 5, value: 10 }],
      items: [{ id: 2, name: 'Nước', price: 100 }],
      animals: [{ id: 3, name: 'Gà', desc: '' }],
    };
    expect(reduceAccountRuntime(1, before, event('trees', payload))).toMatchObject(payload);
  });

  test('bỏ qua event của account khác', () => {
    const before = makeSnapshot({ money: 1 });
    expect(reduceAccountRuntime(1, before, event('money', { balance: 88 }, 2))).toBe(before);
  });

  test('event lẻ không dựng snapshot khi runtime đang null', () => {
    expect(reduceAccountRuntime(1, null, event('status', 'online'))).toBeNull();
  });

  test('log giữ đúng 500 dòng gần nhất', () => {
    const logs = Array.from({ length: 500 }, (_, t) => ({ t, line: String(t) }));
    const after = reduceAccountRuntime(1, makeSnapshot({ logs }), event('log', { t: 500, line: '500' }));
    expect(after?.logs).toHaveLength(500);
    expect(after?.logs[0].t).toBe(1);
    expect(after?.logs.at(-1)?.t).toBe(500);
  });

  test('traffic giữ đúng 300 gói gần nhất', () => {
    const traffic = Array.from({ length: 300 }, (_, t) => ({
      t,
      dir: 'rx' as const,
      cmd: t,
      name: String(t),
      len: 0,
      hex: '',
    }));
    const incoming = { t: 300, dir: 'tx' as const, cmd: 300, name: '300', len: 1, hex: '00' };
    const after = reduceAccountRuntime(1, makeSnapshot({ traffic }), event('traffic', incoming));
    expect(after?.traffic).toHaveLength(300);
    expect(after?.traffic[0].t).toBe(1);
    expect(after?.traffic.at(-1)?.t).toBe(300);
  });
});
```

- [ ] **Step 5: Chạy reducer test để xác nhận thất bại**

Run:

```bash
cd /Users/devios/learning-reverse/avatar-web/web
npm test -- src/accounts/accountRuntime.test.ts
```

Expected: FAIL với `Cannot find module './accountRuntime.js'`.

- [ ] **Step 6: Viết reducer tối thiểu đầy đủ**

Tạo `src/accounts/accountRuntime.ts`:

```ts
import type { SessionSnapshot } from '../types.js';
import type { WsMessage } from '../ws.js';

export function reduceAccountRuntime(
  accountId: number,
  current: SessionSnapshot | null,
  message: WsMessage,
): SessionSnapshot | null {
  if (message.accountId !== accountId) return current;
  if (message.type === 'snapshot') return message.payload as SessionSnapshot;
  if (!current) return current;

  switch (message.type) {
    case 'status':
      return { ...current, status: message.payload };
    case 'auto':
      return { ...current, auto: message.payload };
    case 'macro':
      return { ...current, macro: message.payload };
    case 'farm':
      return { ...current, farm: message.payload };
    case 'inventory':
      return { ...current, inventory: message.payload };
    case 'money':
      return { ...current, money: message.payload.balance ?? current.money };
    case 'trees':
      return {
        ...current,
        trees: message.payload.trees ?? [],
        items: message.payload.items ?? [],
        animals: message.payload.animals ?? [],
      };
    case 'log':
      return { ...current, logs: [...current.logs.slice(-499), message.payload] };
    case 'traffic':
      return { ...current, traffic: [...current.traffic.slice(-299), message.payload] };
    default:
      return current;
  }
}
```

Không sửa kiểu `WsMessage` trong task này. Nếu TypeScript buộc xử lý `payload` do trạng thái repo đã đổi, tạo type guards theo từng event; không đổi ngược nó thành `any` mới.

- [ ] **Step 7: Viết failing test cho vòng đời hook**

Tạo `src/accounts/useAccountRuntime.test.tsx`:

```tsx
import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';

import { makeSnapshot } from '../test/fixtures.js';
import type { WsMessage } from '../ws.js';
import { useAccountRuntime } from './useAccountRuntime.js';

const ws = vi.hoisted(() => ({
  listeners: new Set<(message: WsMessage) => void>(),
  subscribeAccounts: vi.fn(),
}));

vi.mock('../ws.js', () => ({
  subscribeAccounts: ws.subscribeAccounts,
  onWsMessage(listener: (message: WsMessage) => void) {
    ws.listeners.add(listener);
    return () => ws.listeners.delete(listener);
  },
}));

beforeEach(() => ws.listeners.clear());

test('subscribe id khi mount, nhận event đúng account và cleanup về mảng rỗng', () => {
  const initial = makeSnapshot({ accountId: 1, money: 1 });
  const { result, unmount } = renderHook(() => useAccountRuntime(1, initial));

  expect(ws.subscribeAccounts).toHaveBeenLastCalledWith([1]);

  act(() => {
    for (const listener of ws.listeners) listener({ type: 'money', accountId: 2, payload: { balance: 2 } });
  });
  expect(result.current?.money).toBe(1);

  act(() => {
    for (const listener of ws.listeners) listener({ type: 'money', accountId: 1, payload: { balance: 88 } });
  });
  expect(result.current?.money).toBe(88);

  unmount();
  expect(ws.subscribeAccounts).toHaveBeenLastCalledWith([]);
  expect(ws.listeners.size).toBe(0);
});

test('đổi account cleanup subscription cũ trước khi subscribe id mới', () => {
  const first = makeSnapshot({ accountId: 1 });
  const second = makeSnapshot({ accountId: 2 });
  const { rerender } = renderHook(
    ({ id, snapshot }) => useAccountRuntime(id, snapshot),
    { initialProps: { id: 1, snapshot: first } },
  );

  rerender({ id: 2, snapshot: second });
  expect(ws.subscribeAccounts.mock.calls.slice(-2)).toEqual([[[]], [[2]]]);
});
```

- [ ] **Step 8: Chạy hook test để xác nhận thất bại**

Run: `npm test -- src/accounts/useAccountRuntime.test.tsx`

Expected: FAIL với `Cannot find module './useAccountRuntime.js'`.

- [ ] **Step 9: Viết hook dùng một listener và cleanup xác định**

Tạo `src/accounts/useAccountRuntime.ts`:

```ts
import { useEffect, useState } from 'react';

import type { SessionSnapshot } from '../types.js';
import { onWsMessage, subscribeAccounts } from '../ws.js';
import { reduceAccountRuntime } from './accountRuntime.js';

export function useAccountRuntime(
  accountId: number,
  initialSnapshot: SessionSnapshot | null,
): SessionSnapshot | null {
  const [snapshot, setSnapshot] = useState(initialSnapshot);

  useEffect(() => {
    setSnapshot(initialSnapshot);
    subscribeAccounts([accountId]);
    const removeListener = onWsMessage((message) => {
      setSnapshot((current) => reduceAccountRuntime(accountId, current, message));
    });

    return () => {
      removeListener();
      subscribeAccounts([]);
    };
  }, [accountId]);

  return snapshot;
}
```

Không thêm `initialSnapshot` vào dependency: provider có thể cập nhật snapshot nhẹ trong khi drawer đã tích lũy log/traffic nặng; reset theo object mới sẽ làm mất dữ liệu drawer. Snapshot mới thực sự đến qua event `snapshot`.

- [ ] **Step 10: Chạy Task 1 tests và build**

Run:

```bash
npm test -- src/accounts/accountRuntime.test.ts src/accounts/useAccountRuntime.test.tsx
npm run build
```

Expected: toàn bộ test PASS; TypeScript và Vite build PASS.

- [ ] **Step 11: Review checkpoint, không commit**

Run:

```bash
cd /Users/devios/learning-reverse
git diff --check
git status --short
```

Expected: chỉ test harness, reducer/hook và hai tài liệu của task xuất hiện ngoài các thay đổi người dùng đã có; không stage/commit.

---

### Task 2: Shared Account Provider and Status Component

**Files:**

- Create: `avatar-web/web/src/accounts/AccountStatus.tsx`
- Create: `avatar-web/web/src/accounts/AccountsProvider.tsx`
- Test: `avatar-web/web/src/accounts/AccountsProvider.test.tsx`
- Modify: `avatar-web/web/src/accounts/panels/StatusPanel.tsx`

**Interfaces:**

- Consumes:
  - `apiGet<AccountWithRuntime[]>('/api/accounts')`.
  - `onWsMessage` singleton listener API.
- Produces:
  - `statusLabel: Record<ClientStatus, string>`.
  - `StatusBadge({status}: {status: ClientStatus}): JSX.Element`.
  - `AccountsContextValue { accounts; loading; error; reload(): Promise<void> }`.
  - `AccountsProvider(): JSX.Element` rendering an Outlet.
  - `useAccounts(): AccountsContextValue`.

- [ ] **Step 1: Chạy impact ngay trước khi sửa `StatusPanel`/di chuyển `StatusBadge`**

Run:

```bash
cd /Users/devios/learning-reverse
node .gitnexus/run.cjs impact StatusBadge --direction upstream --repo learning-reverse --depth 3 --include-tests
node .gitnexus/run.cjs impact StatusPanel --direction upstream --repo learning-reverse --depth 3 --include-tests
```

Expected: không có HIGH/CRITICAL. Nếu có, dừng và báo người dùng.

- [ ] **Step 2: Viết failing provider tests**

Tạo `src/accounts/AccountsProvider.test.tsx`:

```tsx
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';

import { makeAccount } from '../test/fixtures.js';
import type { WsMessage } from '../ws.js';
import { AccountsProvider, useAccounts } from './AccountsProvider.js';

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  listeners: new Set<(message: WsMessage) => void>(),
}));

vi.mock('../api.js', () => ({ apiGet: mocks.apiGet }));
vi.mock('../ws.js', () => ({
  onWsMessage(listener: (message: WsMessage) => void) {
    mocks.listeners.add(listener);
    return () => mocks.listeners.delete(listener);
  },
}));

function Probe() {
  const { accounts, loading, error, reload } = useAccounts();
  return (
    <div>
      <output data-testid="loading">{String(loading)}</output>
      <output data-testid="error">{error}</output>
      <output data-testid="account">{accounts[0]?.runtime?.status ?? 'none'}</output>
      <button onClick={() => void reload()}>Nạp lại</button>
      <Outlet />
    </div>
  );
}

function renderProvider() {
  return render(
    <MemoryRouter>
      <Routes>
        <Route element={<AccountsProvider />}>
          <Route element={<Probe />}>
            <Route index element={<span>child</span>} />
          </Route>
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => mocks.listeners.clear());

test('tải danh sách lần đầu và cập nhật status nhẹ qua WS', async () => {
  mocks.apiGet.mockResolvedValue([makeAccount()]);
  renderProvider();
  expect(await screen.findByTestId('account')).toHaveTextContent('online');

  act(() => {
    for (const listener of mocks.listeners) listener({ type: 'status', accountId: 1, payload: 'error' });
  });
  expect(screen.getByTestId('account')).toHaveTextContent('error');
});

test('reload lỗi giữ danh sách cũ và công bố lỗi không chặn', async () => {
  mocks.apiGet.mockResolvedValueOnce([makeAccount()]).mockRejectedValueOnce(new Error('mất mạng'));
  renderProvider();
  await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
  await userEvent.click(screen.getByRole('button', { name: 'Nạp lại' }));
  await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('mất mạng'));
  expect(screen.getByTestId('account')).toHaveTextContent('online');
});

test('auto-disabled nạp lại vì DB đã đổi', async () => {
  mocks.apiGet.mockResolvedValue([makeAccount()]);
  renderProvider();
  await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
  act(() => {
    for (const listener of mocks.listeners) listener({ type: 'auto-disabled', accountId: 1, payload: {} });
  });
  await waitFor(() => expect(mocks.apiGet).toHaveBeenCalledTimes(2));
});
```

- [ ] **Step 3: Chạy test để xác nhận thất bại**

Run: `cd avatar-web/web && npm test -- src/accounts/AccountsProvider.test.tsx`

Expected: FAIL với module `AccountsProvider.js` chưa tồn tại.

- [ ] **Step 4: Tách status badge khỏi page cũ**

Tạo `src/accounts/AccountStatus.tsx`:

```tsx
import type { ClientStatus } from '../types.js';

export const statusLabel: Record<ClientStatus, string> = {
  idle: 'chưa kết nối',
  connecting: 'đang kết nối',
  handshaking: 'đang bắt tay',
  'logging-in': 'đang đăng nhập',
  online: 'đang online',
  error: 'lỗi',
};

export function StatusBadge({ status }: { status: ClientStatus }) {
  return <span className={`badge badge-${status}`}>{statusLabel[status]}</span>;
}
```

Đổi import trong `panels/StatusPanel.tsx` từ `../AccountsPage.js` sang `../AccountStatus.js`. Chưa xóa symbol cũ khỏi `AccountsPage.tsx`; việc đó chỉ làm sau khi route mới pass ở Task 5.

- [ ] **Step 5: Viết provider tối thiểu**

Tạo `src/accounts/AccountsProvider.tsx`:

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';

import { apiGet } from '../api.js';
import type { AccountWithRuntime } from '../types.js';
import { onWsMessage } from '../ws.js';

export interface AccountsContextValue {
  accounts: AccountWithRuntime[];
  loading: boolean;
  error: string;
  reload(): Promise<void>;
}

const AccountsContext = createContext<AccountsContextValue | null>(null);

export function AccountsProvider() {
  const [accounts, setAccounts] = useState<AccountWithRuntime[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try {
      setAccounts(await apiGet<AccountWithRuntime[]>('/api/accounts'));
      setError('');
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => void reload(), [reload]);

  useEffect(
    () =>
      onWsMessage((message) => {
        if (message.type === 'auto-disabled') {
          void reload();
          return;
        }
        if (message.type !== 'status' && message.type !== 'auto') return;
        setAccounts((current) =>
          current.map((account) => {
            if (account.id !== message.accountId || !account.runtime) return account;
            return {
              ...account,
              runtime: { ...account.runtime, [message.type]: message.payload },
            };
          }),
        );
      }),
    [reload],
  );

  const value = useMemo(
    () => ({ accounts, loading, error, reload }),
    [accounts, loading, error, reload],
  );

  return (
    <AccountsContext.Provider value={value}>
      <Outlet />
    </AccountsContext.Provider>
  );
}

export function useAccounts(): AccountsContextValue {
  const context = useContext(AccountsContext);
  if (!context) throw new Error('useAccounts phải nằm trong AccountsProvider');
  return context;
}
```

- [ ] **Step 6: Chạy provider tests và build**

Run:

```bash
npm test -- src/accounts/AccountsProvider.test.tsx
npm run build
```

Expected: PASS. Nếu computed property `[message.type]` không thu hẹp đủ kiểu, tách thành hai nhánh `status`/`auto`; không cast cả object sang `AccountWithRuntime`.

- [ ] **Step 7: Review checkpoint, không commit**

Run: `git diff --check && git status --short`

Expected: chỉ file Task 1–2 và tài liệu; không stage/commit.

---

### Task 3: Account Dashboard Card

**Files:**

- Create: `avatar-web/web/src/accounts/AccountCard.tsx`
- Test: `avatar-web/web/src/accounts/AccountCard.test.tsx`

**Interfaces:**

- Consumes:
  - `AccountWithRuntime`.
  - `StatusBadge`.
  - `apiPost` for connect/disconnect.
  - `apiDelete` for deletion.
- Produces:
  - `AccountCardProps { account: AccountWithRuntime; reload(): Promise<void> }`.
  - `AccountCard(props): JSX.Element`.

- [ ] **Step 1: Viết failing card tests**

Tạo `src/accounts/AccountCard.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';

import { makeAccount, makeSnapshot } from '../test/fixtures.js';
import { AccountCard } from './AccountCard.js';

const api = vi.hoisted(() => ({ apiPost: vi.fn(), apiDelete: vi.fn() }));
vi.mock('../api.js', () => api);

function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

function renderCard(account = makeAccount(), reload = vi.fn().mockResolvedValue(undefined)) {
  render(
    <MemoryRouter initialEntries={['/accounts']}>
      <AccountCard account={account} reload={reload} />
      <Location />
    </MemoryRouter>,
  );
  return { reload };
}

beforeEach(() => vi.spyOn(window, 'confirm').mockReturnValue(true));

test('hiển thị nhãn, game user, trạng thái, xu và vòng auto', () => {
  renderCard();
  expect(screen.getByText('Farm chính')).toBeInTheDocument();
  expect(screen.getByText('avatar01')).toBeInTheDocument();
  expect(screen.getByText('đang online')).toBeInTheDocument();
  expect(screen.getByText(/1[.\s]250[.\s]000/)).toBeInTheDocument();
  expect(screen.getByText('vòng 32')).toBeInTheDocument();
});

test('ưu tiên lastError; nếu không có lỗi thì hiển thị thời điểm retry', () => {
  const account = makeAccount({
    runtime: makeSnapshot({ lastError: 'mất kết nối', nextRetryAt: Date.now() + 60_000 }),
  });
  renderCard(account);
  expect(screen.getByText('mất kết nối')).toBeInTheDocument();
  expect(screen.queryByText(/thử lại lúc/)).not.toBeInTheDocument();
});

test('click vùng nội dung hoặc nút Mở vận hành đi tới route drawer', async () => {
  const user = userEvent.setup();
  renderCard();
  await user.click(screen.getByRole('button', { name: 'Mở Farm chính' }));
  expect(screen.getByTestId('location')).toHaveTextContent('/accounts/1');
});

test('Ngắt gọi API và reload nhưng không mở drawer', async () => {
  const user = userEvent.setup();
  api.apiPost.mockResolvedValue({});
  const { reload } = renderCard();
  await user.click(screen.getByRole('button', { name: 'Ngắt' }));
  expect(api.apiPost).toHaveBeenCalledWith('/api/accounts/1/disconnect');
  expect(reload).toHaveBeenCalledOnce();
  expect(screen.getByTestId('location')).toHaveTextContent('/accounts');
});

test('Xóa xác nhận, gọi DELETE và không mở drawer', async () => {
  const user = userEvent.setup();
  api.apiDelete.mockResolvedValue({});
  const { reload } = renderCard();
  await user.click(screen.getByRole('button', { name: 'Xóa Farm chính' }));
  expect(window.confirm).toHaveBeenCalledWith('Xoá tài khoản "Farm chính"? Phiên đang chạy sẽ bị dừng.');
  expect(api.apiDelete).toHaveBeenCalledWith('/api/accounts/1');
  expect(reload).toHaveBeenCalledOnce();
  expect(screen.getByTestId('location')).toHaveTextContent('/accounts');
});

test('busy khóa các thao tác xung đột của cùng card', async () => {
  let resolveRequest!: () => void;
  api.apiPost.mockReturnValue(new Promise<void>((resolve) => { resolveRequest = resolve; }));
  renderCard();
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Ngắt' }));
  expect(screen.getByRole('button', { name: 'Ngắt' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Xóa Farm chính' })).toBeDisabled();
  resolveRequest();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Ngắt' })).toBeEnabled());
});
```

- [ ] **Step 2: Chạy tests để xác nhận thất bại**

Run: `npm test -- src/accounts/AccountCard.test.tsx`

Expected: FAIL vì `AccountCard.js` chưa tồn tại.

- [ ] **Step 3: Viết card với vùng mở và footer tách rời**

Tạo `src/accounts/AccountCard.tsx` theo khung sau; giữ nguyên tên class để Task 6 style:

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { apiDelete, apiPost } from '../api.js';
import type { AccountWithRuntime } from '../types.js';
import { StatusBadge } from './AccountStatus.js';

export interface AccountCardProps {
  account: AccountWithRuntime;
  reload(): Promise<void>;
}

export function AccountCard({ account, reload }: AccountCardProps) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<'control' | 'delete' | null>(null);
  const [actionError, setActionError] = useState('');
  const runtime = account.runtime;
  const online = runtime?.status === 'online';
  const runtimeNotice = runtime?.lastError
    ?? (runtime?.nextRetryAt
      ? `thử lại lúc ${new Date(runtime.nextRetryAt).toLocaleTimeString('vi-VN')}`
      : '');
  const open = () => navigate(`/accounts/${account.id}`);

  async function control() {
    setBusy('control');
    setActionError('');
    try {
      await apiPost(`/api/accounts/${account.id}/${online ? 'disconnect' : 'connect'}`);
      await reload();
    } catch (cause) {
      setActionError((cause as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!confirm(`Xoá tài khoản "${account.label}"? Phiên đang chạy sẽ bị dừng.`)) return;
    setBusy('delete');
    setActionError('');
    try {
      await apiDelete(`/api/accounts/${account.id}`);
      await reload();
    } catch (cause) {
      setActionError((cause as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="account-card" data-account-id={account.id}>
      <button className="account-card-main" type="button" onClick={open} aria-label={`Mở ${account.label}`}>
        <span className="account-card-heading">
          <span><b>{account.label}</b><small>{account.gameUser}</small></span>
          <StatusBadge status={runtime?.status ?? 'idle'} />
        </span>
        <span className="account-card-stats">
          <span><small>Xu</small><b>{runtime?.money === undefined ? '—' : Intl.NumberFormat('vi-VN').format(runtime.money)}</b></span>
          <span><small>Tự động</small><b>{runtime?.auto.running ? `vòng ${runtime.auto.cycle}` : 'đang tắt'}</b></span>
        </span>
        {runtimeNotice && <span className="account-card-notice">{runtimeNotice}</span>}
      </button>
      <footer className="account-card-actions">
        <button type="button" onClick={() => void control()} disabled={busy !== null}>
          {online ? 'Ngắt' : 'Kết nối'}
        </button>
        <button className="ghost" type="button" onClick={open} disabled={busy !== null}>Mở vận hành</button>
        <button className="ghost danger" type="button" onClick={() => void remove()} disabled={busy !== null} aria-label={`Xóa ${account.label}`}>Xóa</button>
      </footer>
      {actionError && <p className="err account-card-error">{actionError}</p>}
    </article>
  );
}
```

`account-card-main` và footer là sibling; tuyệt đối không bọc footer trong button chính.

- [ ] **Step 4: Chạy tests và build**

Run:

```bash
npm test -- src/accounts/AccountCard.test.tsx
npm run build
```

Expected: PASS.

- [ ] **Step 5: Review checkpoint, không commit**

Run: `git diff --check && git status --short`

---

### Task 4: Dialog Focus Primitive and Add Account Modal

**Files:**

- Create: `avatar-web/web/src/accounts/useDialogFocus.ts`
- Create: `avatar-web/web/src/accounts/AddAccountModal.tsx`
- Test: `avatar-web/web/src/accounts/AddAccountModal.test.tsx`

**Interfaces:**

- Produces:
  - `useDialogFocus({ open, containerRef, initialFocusRef, onClose }): void`.
  - `AddAccountModalProps { open; onClose(); reload(): Promise<void> }`.
  - `AddAccountModal(props): JSX.Element | null`.

- [ ] **Step 1: Viết failing modal tests**

Tạo `src/accounts/AddAccountModal.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, test, vi } from 'vitest';

import { AddAccountModal } from './AddAccountModal.js';

const api = vi.hoisted(() => ({ apiPost: vi.fn() }));
vi.mock('../api.js', () => api);

function Harness({ reload = vi.fn().mockResolvedValue(undefined) }: { reload?: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Mở thêm tài khoản</button>
      <AddAccountModal open={open} onClose={() => setOpen(false)} reload={reload} />
    </>
  );
}

test('mở modal, focus Nhãn, Escape đóng và trả focus về trigger', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  const trigger = screen.getByRole('button', { name: 'Mở thêm tài khoản' });
  await user.click(trigger);
  expect(screen.getByRole('dialog', { name: 'Thêm tài khoản' })).toBeInTheDocument();
  expect(screen.getByLabelText('Nhãn')).toHaveFocus();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

test('API lỗi giữ modal và dữ liệu đã nhập', async () => {
  api.apiPost.mockRejectedValue(new Error('không tạo được'));
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(screen.getByRole('button', { name: 'Mở thêm tài khoản' }));
  await user.type(screen.getByLabelText('Nhãn'), 'Farm mới');
  await user.type(screen.getByLabelText('Tài khoản game'), 'avatar02');
  await user.type(screen.getByLabelText('Mật khẩu game'), 'secret');
  await user.click(screen.getByRole('button', { name: 'Thêm' }));
  expect(await screen.findByText('không tạo được')).toBeInTheDocument();
  expect(screen.getByLabelText('Nhãn')).toHaveValue('Farm mới');
});

test('thành công đóng modal, reset form và reload đúng một lần', async () => {
  api.apiPost.mockResolvedValue({ id: 2 });
  const reload = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(<Harness reload={reload} />);
  await user.click(screen.getByRole('button', { name: 'Mở thêm tài khoản' }));
  await user.type(screen.getByLabelText('Nhãn'), 'Farm mới');
  await user.type(screen.getByLabelText('Tài khoản game'), 'avatar02');
  await user.type(screen.getByLabelText('Mật khẩu game'), 'secret');
  await user.click(screen.getByRole('button', { name: 'Thêm' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(api.apiPost).toHaveBeenCalledWith('/api/accounts', {
    label: 'Farm mới', gameUser: 'avatar02', gamePass: 'secret',
  });
  expect(reload).toHaveBeenCalledOnce();
});

test('Tab không thoát ra ngoài modal', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(screen.getByRole('button', { name: 'Mở thêm tài khoản' }));
  const close = screen.getByRole('button', { name: 'Đóng' });
  close.focus();
  await user.keyboard('{Shift>}{Tab}{/Shift}');
  expect(screen.getByRole('button', { name: 'Thêm' })).toHaveFocus();
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npm test -- src/accounts/AddAccountModal.test.tsx`

Expected: FAIL vì modal chưa tồn tại.

- [ ] **Step 3: Viết focus trap dùng chung**

Tạo `src/accounts/useDialogFocus.ts`:

```ts
import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',');

interface DialogFocusOptions {
  open: boolean;
  containerRef: RefObject<HTMLElement | null>;
  initialFocusRef: RefObject<HTMLElement | null>;
  onClose(): void;
}

export function useDialogFocus({ open, containerRef, initialFocusRef, onClose }: DialogFocusOptions) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    queueMicrotask(() => initialFocusRef.current?.focus());

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !containerRef.current) return;
      const focusable = [...containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
        .filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open, containerRef, initialFocusRef]);
}
```

- [ ] **Step 4: Viết modal**

Tạo `src/accounts/AddAccountModal.tsx`. Dùng hook trên, ba state field, state `busy` và `error`. Markup bắt buộc:

```tsx
<div className="dialog-backdrop dialog-backdrop--modal" onMouseDown={onBackdrop}>
  <section ref={dialogRef} className="account-modal" role="dialog" aria-modal="true" aria-labelledby="add-account-title">
    <header className="dialog-heading">
      <h2 id="add-account-title">Thêm tài khoản</h2>
      <button type="button" className="ghost" onClick={onClose} aria-label="Đóng">×</button>
    </header>
    <form onSubmit={submit}>
      <label>
        Nhãn
        <input ref={labelRef} value={label} onChange={(event) => setLabel(event.target.value)} required />
      </label>
      <label>
        Tài khoản game
        <input value={gameUser} onChange={(event) => setGameUser(event.target.value)} autoComplete="off" required />
      </label>
      <label>
        Mật khẩu game
        <input type="password" value={gamePass} onChange={(event) => setGamePass(event.target.value)} autoComplete="new-password" required />
      </label>
      <p className="hint">Mật khẩu game được mã hoá trước khi lưu và không bao giờ hiện lại.</p>
      {error && <p className="err">{error}</p>}
      <footer className="dialog-actions">
        <button type="button" className="ghost" onClick={onClose} disabled={busy}>Hủy</button>
        <button type="submit" disabled={busy}>{busy ? 'đang thêm…' : 'Thêm'}</button>
      </footer>
    </form>
  </section>
</div>
```

`onBackdrop` chỉ đóng khi `event.target === event.currentTarget`. `submit` phải làm đúng thứ tự:

```ts
await apiPost('/api/accounts', { label, gameUser, gamePass });
setLabel('');
setGameUser('');
setGamePass('');
onClose();
await reload();
```

Nếu POST ném lỗi, không reset/đóng. `reload()` của provider tự giữ lỗi và không ném, nên POST thành công luôn đóng modal dù lần reload sau đó lỗi.

- [ ] **Step 5: Chạy modal tests và build**

Run:

```bash
npm test -- src/accounts/AddAccountModal.test.tsx
npm run build
```

Expected: PASS.

- [ ] **Step 6: Review checkpoint, không commit**

Run: `git diff --check && git status --short`

---

### Task 5: Nested Routes, Dashboard, Operations Drawer, and Debug Page

**Files:**

- Create: `avatar-web/web/src/App.tsx`
- Create: `avatar-web/web/src/accounts/AccountsDashboardPage.tsx`
- Create: `avatar-web/web/src/accounts/AccountOperationsDrawer.tsx`
- Create: `avatar-web/web/src/accounts/AccountDebugPage.tsx`
- Test: `avatar-web/web/src/accounts/accountsRoutes.test.tsx`
- Modify: `avatar-web/web/src/main.tsx`
- Delete: `avatar-web/web/src/accounts/AccountsPage.tsx`
- Delete: `avatar-web/web/src/accounts/AccountDetailPage.tsx`

**Interfaces:**

- Consumes all Task 1–4 interfaces and existing panels.
- Produces:
  - `App(): JSX.Element` route shell.
  - `AccountsDashboardPage(): JSX.Element`.
  - `AccountOperationsDrawer(): JSX.Element`.
  - `AccountDebugPage(): JSX.Element`.

- [ ] **Step 1: Xác nhận impact cũ vẫn LOW trước khi thay route/page**

Run:

```bash
cd /Users/devios/learning-reverse
node .gitnexus/run.cjs impact AccountsPage --direction upstream --repo learning-reverse --depth 3 --include-tests
node .gitnexus/run.cjs impact AccountDetailPage --direction upstream --repo learning-reverse --depth 3 --include-tests
```

Nếu HIGH/CRITICAL, dừng. Kết quả dự kiến theo preflight là LOW.

- [ ] **Step 2: Viết failing route integration tests**

Tạo `src/accounts/accountsRoutes.test.tsx`. Mock `apiGet` theo path, mock singleton WS đủ ba export `connectWs`, `onWsMessage`, `subscribeAccounts`, rồi render `App` trong `MemoryRouter`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';

import { App } from '../App.js';
import { makeAccount } from '../test/fixtures.js';
import type { WsMessage } from '../ws.js';

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn(),
  connectWs: vi.fn(),
  subscribeAccounts: vi.fn(),
  listeners: new Set<(message: WsMessage) => void>(),
}));

vi.mock('../api.js', () => ({
  apiGet: mocks.apiGet,
  apiPost: mocks.apiPost,
  apiDelete: mocks.apiDelete,
}));
vi.mock('../ws.js', () => ({
  connectWs: mocks.connectWs,
  subscribeAccounts: mocks.subscribeAccounts,
  onWsMessage(listener: (message: WsMessage) => void) {
    mocks.listeners.add(listener);
    return () => mocks.listeners.delete(listener);
  },
}));

function LocationProbe() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

function renderRoute(path: string) {
  mocks.apiGet.mockImplementation((url: string) => {
    if (url === '/api/auth/me') return Promise.resolve({ id: 9, email: 'user@example.com' });
    if (url === '/api/accounts') return Promise.resolve([makeAccount()]);
    throw new Error(`API ngoài dự kiến: ${url}`);
  });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <LocationProbe />
    </MemoryRouter>,
  );
}

beforeEach(() => mocks.listeners.clear());

test('/accounts hiển thị dashboard và không có drawer', async () => {
  renderRoute('/accounts');
  expect(await screen.findByText('Farm chính')).toBeInTheDocument();
  expect(screen.queryByRole('dialog', { name: /Vận hành/ })).not.toBeInTheDocument();
});

test('/accounts/:id giữ dashboard phía sau và mở drawer đúng account', async () => {
  renderRoute('/accounts/1');
  expect(await screen.findByRole('dialog', { name: 'Vận hành Farm chính' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Tài khoản avatar' })).toBeInTheDocument();
  expect(mocks.subscribeAccounts).toHaveBeenCalledWith([1]);
});

test('Escape đóng drawer về /accounts và cleanup subscription', async () => {
  renderRoute('/accounts/1');
  await screen.findByRole('dialog', { name: 'Vận hành Farm chính' });
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/accounts'));
  expect(mocks.subscribeAccounts).toHaveBeenLastCalledWith([]);
});

test('id không tồn tại hiển thị lỗi an toàn trong drawer', async () => {
  renderRoute('/accounts/999');
  expect(await screen.findByText('không có tài khoản này')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Về dashboard' })).toHaveAttribute('href', '/accounts');
});

test('/accounts/:id/debug hiển thị Debug riêng và link về Vận hành', async () => {
  renderRoute('/accounts/1/debug');
  expect(await screen.findByRole('heading', { name: 'Debug: Farm chính' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Về Vận hành' })).toHaveAttribute('href', '/accounts/1');
  expect(screen.getByText('Hành động')).toBeInTheDocument();
});
```

- [ ] **Step 3: Chạy route tests để xác nhận thất bại**

Run: `npm test -- src/accounts/accountsRoutes.test.tsx`

Expected: FAIL vì `App.js` và các page mới chưa tồn tại.

- [ ] **Step 4: Tạo route shell testable**

Tạo `src/App.tsx`:

```tsx
import { Navigate, Route, Routes } from 'react-router-dom';

import { AccountDebugPage } from './accounts/AccountDebugPage.js';
import { AccountOperationsDrawer } from './accounts/AccountOperationsDrawer.js';
import { AccountsDashboardPage } from './accounts/AccountsDashboardPage.js';
import { AccountsProvider } from './accounts/AccountsProvider.js';
import { LoginPage } from './auth/LoginPage.js';
import { RegisterPage } from './auth/RegisterPage.js';
import { AuthProvider, RequireAuth } from './auth/useAuth.js';

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/accounts" element={<RequireAuth><AccountsProvider /></RequireAuth>}>
          <Route element={<AccountsDashboardPage />}>
            <Route index element={<></>} />
            <Route path=":id" element={<AccountOperationsDrawer />} />
          </Route>
          <Route path=":id/debug" element={<AccountDebugPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/accounts" replace />} />
      </Routes>
    </AuthProvider>
  );
}
```

Sửa `main.tsx` thành phần lắp ráp duy nhất:

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { App } from './App.js';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter><App /></BrowserRouter>
  </React.StrictMode>,
);
```

- [ ] **Step 5: Tạo dashboard**

`AccountsDashboardPage.tsx` phải:

- lấy `user/logout` từ `useAuth`;
- lấy `accounts/loading/error/reload` từ `useAccounts`;
- luôn render card “+ Thêm tài khoản” khi không có loading lỗi chặn;
- render lỗi ban đầu với nút `Thử lại` nếu `accounts.length === 0 && error`;
- giữ card cũ và render banner lỗi nếu `accounts.length > 0 && error`;
- render `<Outlet />` sau modal để drawer nằm trên dashboard.

Khung JSX:

```tsx
export function AccountsDashboardPage() {
  const { user, logout } = useAuth();
  const { accounts, loading, error, reload } = useAccounts();
  const [adding, setAdding] = useState(false);

  return (
    <div className="app accounts-dashboard">
      <header className="dashboard-header">
        <div><p className="eyebrow">AVATAR WEB</p><h1>Tài khoản avatar</h1></div>
        <span className="hint">{user?.email}</span>
        <button className="ghost" onClick={() => void logout()}>Đăng xuất</button>
      </header>
      {error && accounts.length > 0 && <p className="dashboard-error err">{error}</p>}
      {loading && accounts.length === 0 && <p className="hint">đang tải…</p>}
      {!loading && error && accounts.length === 0 ? (
        <section className="card dashboard-empty"><p className="err">{error}</p><button onClick={() => void reload()}>Thử lại</button></section>
      ) : (
        <section className="accounts-grid" aria-label="Danh sách tài khoản">
          {accounts.map((account) => <AccountCard key={account.id} account={account} reload={reload} />)}
          <button className="account-add-card" type="button" onClick={() => setAdding(true)}>
            <b>＋</b><span>Thêm tài khoản</span>
          </button>
        </section>
      )}
      <AddAccountModal open={adding} onClose={() => setAdding(false)} reload={reload} />
      <Outlet />
    </div>
  );
}
```

- [ ] **Step 6: Tạo drawer với wrapper không vi phạm Rules of Hooks**

`AccountOperationsDrawer` luôn render frame dialog và chỉ mount component hook runtime khi account đã tồn tại:

```tsx
export function AccountOperationsDrawer() {
  const navigate = useNavigate();
  const { id } = useParams();
  const accountId = Number(id);
  const { accounts, loading, reload } = useAccounts();
  const account = Number.isInteger(accountId) && accountId > 0
    ? accounts.find((item) => item.id === accountId)
    : undefined;
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const close = () => navigate('/accounts');
  useDialogFocus({ open: true, containerRef: dialogRef, initialFocusRef: closeRef, onClose: close });

  return (
    <div className="dialog-backdrop dialog-backdrop--drawer" onMouseDown={(event) => {
      if (event.target === event.currentTarget) close();
    }}>
      <aside ref={dialogRef} className="account-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <header className="dialog-heading">
          <div><p className="eyebrow">VẬN HÀNH</p><h2 id="drawer-title">{account ? `Vận hành ${account.label}` : 'Vận hành tài khoản'}</h2></div>
          <button ref={closeRef} type="button" className="ghost" onClick={close} aria-label="Đóng">×</button>
        </header>
        {loading ? <p className="hint">đang tải…</p> : account ? (
          <LoadedOperations account={account} reload={reload} />
        ) : (
          <div className="drawer-empty"><p className="err">không có tài khoản này</p><Link to="/accounts">Về dashboard</Link></div>
        )}
      </aside>
    </div>
  );
}
```

`LoadedOperations` là component riêng và là nơi duy nhất gọi hook:

```tsx
function LoadedOperations({ account, reload }: { account: AccountWithRuntime; reload(): Promise<void> }) {
  const snapshot = useAccountRuntime(account.id, account.runtime);
  return (
    <div className="drawer-panels">
      <StatusPanel accountId={account.id} snap={snapshot} gameUser={account.gameUser} onChanged={() => void reload()} />
      <AutoFarmPanel accountId={account.id} auto={snapshot?.auto ?? { running: false, cycle: 0, lastActions: [] }} items={snapshot?.items ?? []} />
      <AssetsPanel accountId={account.id} farm={snapshot?.farm ?? null} inventory={snapshot?.inventory ?? []} trees={snapshot?.trees ?? []} animals={snapshot?.animals ?? []} />
      <LogPanel logs={snapshot?.logs ?? []} />
      <Link className="btn-link drawer-debug-link" to={`/accounts/${account.id}/debug`}>Debug chuyên sâu →</Link>
    </div>
  );
}
```

- [ ] **Step 7: Tạo Debug page với loaded child riêng**

`AccountDebugPage` xử lý loading/not-found trước. Chỉ component con `LoadedDebugPage` gọi `useAccountRuntime`, rồi render:

```tsx
<div className="app account-debug-page">
  <header>
    <Link to={`/accounts/${account.id}`}>← Về Vận hành</Link>
    <h1>Debug: {account.label}</h1>
    <StatusBadge status={snapshot?.status ?? 'idle'} />
  </header>
  <DebugPanel
    accountId={account.id}
    macro={snapshot?.macro ?? { running: false, cycle: 0 }}
    traffic={snapshot?.traffic ?? []}
  />
</div>
```

Route id không hợp lệ hoặc không có account render `không có tài khoản này` và `<Link to="/accounts">Về dashboard</Link>`.

- [ ] **Step 8: Chạy route tests; sửa cho pass trước khi xóa page cũ**

Run:

```bash
npm test -- src/accounts/accountsRoutes.test.tsx
npm run build
```

Expected: PASS. Nếu StrictMode làm expectation subscription đếm tuyệt đối không ổn định, assert lời gọi cuối và cặp cleanup/subscription thay vì giảm chất lượng implementation.

- [ ] **Step 9: Xóa page cũ và xác nhận không còn import**

Sau khi test route mới pass:

```bash
rg -n "AccountsPage|AccountDetailPage" avatar-web/web/src
```

Expected trước xóa: chỉ definition/import cũ. Xóa:

- `web/src/accounts/AccountsPage.tsx`
- `web/src/accounts/AccountDetailPage.tsx`

Chạy lại `rg`; Expected: không còn kết quả. Không xóa bất kỳ panel nào.

- [ ] **Step 10: Chạy toàn bộ web tests và build**

Run:

```bash
cd /Users/devios/learning-reverse/avatar-web/web
npm test
npm run build
```

Expected: PASS.

- [ ] **Step 11: Review checkpoint, không commit**

Run: `git diff --check && git status --short`

---

### Task 6: Responsive Styling and Final Regression Verification

**Files:**

- Modify: `avatar-web/web/src/styles.css`

**Interfaces:**

- Consumes class names from Task 3–5.
- Produces 3/2/1-column responsive dashboard, desktop/mobile drawer and accessible reduced-motion behavior.

- [ ] **Step 1: Thay CSS bảng cũ bằng dashboard/card CSS**

Xóa các block bắt đầu tại comment `/* --- bảng danh sách tài khoản --- */` và `/* --- header trang chi tiết --- */`. Thêm các rule sau, điều chỉnh màu bằng biến hiện có nhưng giữ nguyên breakpoint:

```css
.eyebrow {
  margin: 0 0 3px;
  color: var(--ok);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.dashboard-header .hint { margin-left: auto; }

.accounts-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.account-card,
.account-add-card {
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--card);
}

.account-card { overflow: hidden; }

.account-card-main {
  display: block;
  width: 100%;
  padding: 16px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--fg);
  text-align: left;
  white-space: normal;
}

.account-card-main:hover { background: rgba(110, 168, 254, 0.06); }
.account-card-main:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }

.account-card-heading,
.account-card-stats {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.account-card-heading > span:first-child,
.account-card-stats > span { display: grid; gap: 2px; }
.account-card-heading small,
.account-card-stats small { color: var(--muted); font-weight: 400; }
.account-card-stats { margin-top: 18px; }
.account-card-stats > span:last-child { text-align: right; }

.account-card-notice,
.account-card-error {
  display: block;
  margin: 12px 0 0;
  overflow-wrap: anywhere;
}

.account-card-actions,
.dialog-actions {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--line);
}

.account-card-actions .danger { color: var(--err); margin-left: auto; }
.account-card-error { padding: 0 16px 14px; }

.account-add-card {
  min-height: 190px;
  display: grid;
  place-content: center;
  gap: 6px;
  color: var(--muted);
  border-style: dashed;
  background: transparent;
}
.account-add-card b { font-size: 32px; text-align: center; }

.dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  background: rgba(3, 6, 12, 0.72);
  animation: dialog-fade 160ms ease-out;
}

.dialog-backdrop--modal { align-items: center; justify-content: center; padding: 20px; }
.dialog-backdrop--drawer { justify-content: flex-end; }

.account-modal,
.account-drawer {
  border: 1px solid var(--line);
  background: var(--bg);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
}

.account-modal { width: min(100%, 480px); border-radius: 12px; padding: 18px; }
.account-drawer { width: min(720px, 100%); height: 100%; overflow: auto; padding: 18px; animation: drawer-in 200ms ease-out; }

.dialog-heading { position: sticky; top: 0; z-index: 1; background: var(--bg); }
.dialog-heading h2 { margin: 0; color: var(--fg); text-transform: none; letter-spacing: 0; font-size: 18px; }
.dialog-heading > .ghost { margin-left: auto; }
.drawer-panels { display: grid; gap: 16px; }
.drawer-debug-link { justify-self: start; margin-bottom: 20px; }
.dashboard-empty { text-align: center; }

@keyframes dialog-fade { from { opacity: 0; } }
@keyframes drawer-in { from { transform: translateX(24px); opacity: 0; } }

@media (max-width: 1099px) {
  .accounts-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 679px) {
  .app { padding: 12px; }
  .dashboard-header { align-items: flex-start; flex-wrap: wrap; }
  .dashboard-header .hint { width: 100%; margin-left: 0; order: 3; }
  .accounts-grid { grid-template-columns: 1fr; }
  .account-drawer { width: 100%; border-width: 0; }
  .account-card-actions { flex-wrap: wrap; }
}

@media (prefers-reduced-motion: reduce) {
  .dialog-backdrop,
  .account-drawer { animation: none; }
}
```

- [ ] **Step 2: Chạy focused DOM tests sau CSS cleanup**

Run:

```bash
cd /Users/devios/learning-reverse/avatar-web/web
npm test -- src/accounts/AccountCard.test.tsx src/accounts/AddAccountModal.test.tsx src/accounts/accountsRoutes.test.tsx
```

Expected: PASS, chứng minh class/markup cleanup không làm mất hành vi.

- [ ] **Step 3: Chạy toàn bộ frontend verification**

Run:

```bash
npm test
npm run build
```

Expected: tất cả Vitest PASS và Vite production build PASS.

- [ ] **Step 4: Chạy server regression verification dù backend không đổi**

Run:

```bash
cd /Users/devios/learning-reverse/avatar-web/server
npm test
npm run typecheck
```

Expected: server tests và TypeScript PASS. Báo riêng nếu lỗi thuộc thay đổi worktree đã có, không gán nhầm cho frontend.

- [ ] **Step 5: Kiểm tra phạm vi diff và execution flows**

Run:

```bash
cd /Users/devios/learning-reverse
git diff --check
git status --short
rg -n "table\.accounts|AccountsPage|AccountDetailPage" avatar-web/web/src
```

Expected:

- `git diff --check` không có output.
- Không còn `table.accounts`, `AccountsPage`, `AccountDetailPage` trong web source.
- Không có file server mới hoặc bị sửa bởi feature này.

Sau đó chạy GitNexus `detect_changes` với scope `all`. Nếu MCP khả dụng:

```text
detect_changes({ repo: "learning-reverse", scope: "all" })
```

Expected: thay đổi chỉ nằm trong frontend Accounts/Auth route assembly và không ảnh hưởng flow server/protocol/game. Nếu có flow ngoài dự kiến, review trước khi bàn giao.

- [ ] **Step 6: Kiểm tra responsive và keyboard trên trình duyệt**

Chạy ứng dụng theo README với backend cục bộ, rồi kiểm tra lần lượt:

1. 1280 px: dashboard 3 cột; drawer tối đa 720 px.
2. 900 px: dashboard 2 cột.
3. 390 px: dashboard 1 cột; drawer full width.
4. Keyboard: Tab tới card, Enter mở drawer, Escape đóng và focus về card.
5. Modal: mở từ card `+`, focus vào Nhãn, Tab không thoát, Escape đóng và focus về card `+`.
6. Nút Ngắt/Kết nối/Xóa không mở drawer.
7. Back/Forward chuyển đúng giữa `/accounts`, `/accounts/:id`, `/accounts/:id/debug`.

Không đánh dấu bước này pass nếu chỉ có build/test mà chưa quan sát layout thật.

- [ ] **Step 7: Bàn giao, không commit**

Báo rõ:

- Các lệnh nào pass.
- Kiểm tra browser nào đã thực hiện.
- Bất kỳ coverage nào chưa xác minh.
- Danh sách file feature đã đổi.
- Worktree vẫn chưa stage/commit.

Nếu người dùng sau đó yêu cầu commit, chạy lại `detect_changes({scope: "all"})`, stage đúng file feature, kiểm tra `git diff --cached`, rồi mới commit.
