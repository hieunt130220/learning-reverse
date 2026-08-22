# Avatar Web Mobile-first UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tối ưu toàn bộ UI avatar-web theo hướng mobile-first, bổ sung tab điều hướng drawer trên mobile và chuyển bảng dữ liệu thành card mà không làm đổi hành vi desktop.

**Architecture:** Giữ CSS thuần và tên class hiện tại, đảo CSS nền sang mobile rồi nâng cấp bằng `min-width: 680px` và `min-width: 1100px`. Drawer dùng `useMediaQuery` và các wrapper `hidden` để giữ mọi panel mounted; bảng giữ semantic `<table>` và dùng `data-label` để đổi thành card trên mobile.

**Tech Stack:** React 18, TypeScript 5.7, CSS thuần, Vite 6, Vitest/jsdom

**Spec:** `docs/superpowers/specs/2026-08-22-mobile-first-ui-design.md`

## Global Constraints

- Không thêm dependency hoặc CSS framework.
- Không đổi logic API, WebSocket, auto-farm, quest, cooking hoặc shop.
- Không đổi tên các class CSS hiện có; chỉ thêm class phục vụ drawer/tab/card.
- Style nền phải dành cho viewport ≤679px; tablet bắt đầu tại 680px; desktop bắt đầu tại 1100px.
- Mọi panel trong drawer phải tiếp tục mounted khi chuyển tab để giữ state.
- Không tạo test file mới; chỉ cập nhật test hiện có sau production code khi cần.
- Trước khi sửa mỗi symbol, chạy GitNexus impact upstream và cảnh báo nếu HIGH/CRITICAL.
- Trước mỗi commit, chạy GitNexus detect_changes và xác nhận phạm vi đúng dự kiến.

---

### Task 1: Media-query hook và mobile drawer navigation

**Files:**
- Create: `avatar-web/web/src/useMediaQuery.ts`
- Modify: `avatar-web/web/src/accounts/AccountOperationsDrawer.tsx:1-129`
- Modify: `avatar-web/web/src/test/setup.ts:1-12`
- Test: `avatar-web/web/src/accounts/accountsRoutes.test.tsx`

**Interfaces:**
- Produces: `useMediaQuery(query: string): boolean`.
- Produces: `PanelId = 'status' | 'autofarm' | 'quests' | 'cooking' | 'assets' | 'shop' | 'logs'` nội bộ drawer.
- Preserves: mọi panel hiện tại vẫn mounted và nhận nguyên props.

- [ ] **Step 1: Phân tích blast radius**

Run:
```bash
# MCP: gitnexus_impact target=AccountOperationsDrawer direction=upstream repo=learning-reverse
# MCP: gitnexus_impact target=LoadedOperations direction=upstream repo=learning-reverse
```
Expected: ghi nhận callers/processes; dừng và báo user nếu risk HIGH/CRITICAL.

- [ ] **Step 2: Tạo hook `useMediaQuery`**

```ts
import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);

  return matches;
}
```

- [ ] **Step 3: Stub `matchMedia` trong setup test**

Thêm sau stub `scrollIntoView`:

```ts
Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
```

- [ ] **Step 4: Thêm state và tab bar mobile vào drawer**

Trong `LoadedOperations`, dùng:

```tsx
const PANEL_TABS = [
  ['status', 'Trạng thái'],
  ['autofarm', 'Tự động'],
  ['quests', 'Nhiệm vụ'],
  ['cooking', 'Nấu ăn'],
  ['assets', 'Tài sản'],
  ['shop', 'Sạp'],
  ['logs', 'Log'],
] as const;
type PanelId = (typeof PANEL_TABS)[number][0];

const isMobile = useMediaQuery('(max-width: 679px)');
const [activePanel, setActivePanel] = useState<PanelId>('status');
const visible = (id: PanelId) => !isMobile || activePanel === id;
```

Render tab bar trước `.drawer-panels`:

```tsx
{isMobile && (
  <nav className="drawer-tabbar" role="tablist" aria-label="Các mục vận hành">
    {PANEL_TABS.map(([id, label]) => (
      <button
        key={id}
        type="button"
        role="tab"
        aria-selected={activePanel === id}
        className={activePanel === id ? 'active' : ''}
        onClick={() => setActivePanel(id)}
      >
        {label}
      </button>
    ))}
  </nav>
)}
```

Bọc từng panel bằng wrapper, không sửa props của 7 panel:

```tsx
<div className="drawer-panel-slot" hidden={!visible('status')}><StatusPanel ... /></div>
<div className="drawer-panel-slot" hidden={!visible('autofarm')}><AutoFarmPanel ... /></div>
<div className="drawer-panel-slot" hidden={!visible('quests')}><QuestsPanel ... /></div>
<div className="drawer-panel-slot" hidden={!visible('cooking')}><CookingPanel ... /></div>
<div className="drawer-panel-slot" hidden={!visible('assets')}><AssetsPanel ... /></div>
<div className="drawer-panel-slot" hidden={!visible('shop')}><ShopPanel ... /></div>
<div className="drawer-panel-slot" hidden={!visible('logs')}><LogPanel ... /></div>
```

Giữ link Debug bên ngoài các wrapper. Cách này xử lý đúng `AssetsPanel` trả Fragment và tránh sửa 7 API component.

- [ ] **Step 5: Cập nhật test route sau production code**

Thêm test vào `accountsRoutes.test.tsx`, override `matchMedia` thành mobile trước render và khôi phục trong `afterEach` qua setup mặc định:

```tsx
test('mobile drawer dùng tab và giữ panel mounted khi chuyển mục', async () => {
  vi.mocked(window.matchMedia).mockImplementation((query) => ({
    matches: query === '(max-width: 679px)', media: query, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
  renderRoute('/accounts/1');
  expect(await screen.findByRole('tab', { name: 'Trạng thái' })).toHaveAttribute('aria-selected', 'true');
  await userEvent.click(screen.getByRole('tab', { name: 'Tự động' }));
  expect(screen.getByRole('tab', { name: 'Tự động' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByText(/Kế hoạch cây theo ô/i)).toBeInTheDocument();
});
```

- [ ] **Step 6: Verify task**

Run:
```bash
cd avatar-web/web && npm run test -- --run src/accounts/accountsRoutes.test.tsx && npm run build
```
Expected: route tests pass; TypeScript/Vite build pass.

- [ ] **Step 7: Kiểm tra scope và commit**

Run GitNexus detect_changes với `scope: all`, expected chỉ drawer/hook/setup/route test và process account operations. Sau đó:

```bash
git add avatar-web/web/src/useMediaQuery.ts avatar-web/web/src/test/setup.ts \
  avatar-web/web/src/accounts/AccountOperationsDrawer.tsx \
  avatar-web/web/src/accounts/accountsRoutes.test.tsx
git commit -m "feat(web): add mobile drawer panel navigation"
```

---

### Task 2: Chuyển bảng Shop và Auto-sell thành card trên mobile

**Files:**
- Modify: `avatar-web/web/src/accounts/panels/ShopPanel.tsx:425-570`
- Modify: `avatar-web/web/src/accounts/AutoSellRulesEditor.tsx:178-245`
- Modify: `avatar-web/web/src/styles.css:1239-1485,1487-1712`

**Interfaces:**
- Consumes: markup bảng hiện tại.
- Produces: mỗi ô dữ liệu có `data-label` tiếng Việt; empty rows dùng class `table-empty-row` và không sinh nhãn giả.

- [ ] **Step 1: Phân tích blast radius**

Run GitNexus impact upstream lần lượt cho `ShopPanel` và `AutoSellRulesEditor`; dừng nếu HIGH/CRITICAL.

- [ ] **Step 2: Gắn `data-label` vào ba bảng Shop**

Dùng đúng mapping:

```tsx
// Sạp của tôi
<td data-label="Slot">...</td>
<td data-label="Nông sản">...</td>
<td data-label="Số lượng">...</td>
<td data-label="Giá">...</td>
<td data-label="Trạng thái">...</td>
<td data-label="Hành động">...</td>

// Danh mục chợ
<td data-label="ID">...</td>
<td data-label="Nông sản">...</td>
<td data-label="Giá server">...</td>
<td data-label="Hành động">...</td>

// Listing chợ
<td data-label="ID sạp">...</td>
<td data-label="Số lượng">...</td>
<td data-label="Giá">...</td>
<td data-label="Hành động">...</td>
```

Các dòng empty `colSpan` thêm `className="hint table-empty-row"`.

- [ ] **Step 3: Gắn `data-label` vào bảng Auto-sell**

```tsx
<td data-label="Nông sản"><strong>{itemName}</strong></td>
<td data-label="Số lượng một lô">{rule.quantity.toLocaleString()}</td>
<td data-label="Giá bán">...</td>
<td data-label="Hành động" className="auto-sell-actions-cell">...</td>
```

Empty row thêm class `table-empty-row` cùng `auto-sell-empty-text`.

- [ ] **Step 4: Viết CSS card mobile**

Thêm trước breakpoint tablet:

```css
.shop-table { min-width: 0; }

@media (max-width: 679px) {
  .shop-table-wrap,
  .auto-sell-rules-table-container { overflow: visible; border: 0; }
  .shop-table thead,
  .auto-sell-rules-table thead { display: none; }
  .shop-table,
  .shop-table tbody,
  .auto-sell-rules-table,
  .auto-sell-rules-table tbody { display: block; width: 100%; }
  .shop-table tr,
  .auto-sell-rules-table tr {
    display: grid;
    gap: 0;
    margin-bottom: 8px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: #111722;
    overflow: hidden;
  }
  .shop-table td,
  .auto-sell-rules-table td {
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 9px 10px;
    border-bottom: 1px solid var(--line);
    text-align: right;
    overflow-wrap: anywhere;
  }
  .shop-table td::before,
  .auto-sell-rules-table td::before {
    content: attr(data-label);
    flex: 0 0 auto;
    color: var(--muted);
    font-size: 11px;
    font-weight: 600;
    text-align: left;
  }
  .shop-table td:last-child,
  .auto-sell-rules-table td:last-child { border-bottom: 0; }
  .shop-table .table-empty-row,
  .auto-sell-rules-table .table-empty-row {
    display: block;
    text-align: center;
  }
  .table-empty-row::before { content: none !important; }
  .auto-sell-actions-cell { justify-content: space-between; }
}
```

- [ ] **Step 5: Verify task**

Run:
```bash
cd avatar-web/web && npm run build && npm run test
```
Expected: build và toàn bộ tests pass.

- [ ] **Step 6: Kiểm tra scope và commit**

Run GitNexus detect_changes `scope: all`; expected chỉ Shop/AutoSell/CSS và flows hiển thị/config sạp. Sau đó:

```bash
git add avatar-web/web/src/accounts/panels/ShopPanel.tsx \
  avatar-web/web/src/accounts/AutoSellRulesEditor.tsx avatar-web/web/src/styles.css
git commit -m "feat(web): render shop tables as mobile cards"
```

---

### Task 3: Refactor CSS nền sang mobile-first

**Files:**
- Modify: `avatar-web/web/src/styles.css:1-1712`
- Modify: `avatar-web/web/index.html:5`

**Interfaces:**
- Consumes: class names hiện có.
- Produces: breakpoint base/680/1100, drawer tab styles, safe-area, touch targets.

- [ ] **Step 1: Phân tích blast radius**

Run GitNexus impact upstream cho file `avatar-web/web/src/styles.css` và symbol `AccountsDashboardPage`; báo nếu HIGH/CRITICAL.

- [ ] **Step 2: Chuyển các layout chính sang base mobile**

Áp dụng chính xác:

```css
.app { max-width: 1400px; margin: 0 auto; padding: 12px; }
.cols { grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr)); }
.accounts-grid { grid-template-columns: 1fr; }
.account-card-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.tree-plan-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.action-head > button { width: 100%; min-width: 0; }
input, select, textarea { font-size: 16px; }
```

Giữ `.dashboard-header` wrapping, `.account-card-actions` wrapping, `.shop-heading` block, shop tabs cuộn ngang và shop paid action xếp dọc ở base; xóa các khai báo trùng khỏi block `@media (max-width: 679px)` cũ.

- [ ] **Step 3: Thêm tablet và desktop enhancement**

```css
@media (min-width: 680px) {
  .app { padding: 20px; }
  input, select, textarea { font-size: inherit; }
  .accounts-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .account-card-stats { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .tree-plan-grid { grid-template-columns: repeat(8, minmax(0, 1fr)); }
  .action-head > button { width: auto; min-width: 170px; }
  .shop-heading { display: flex; }
  .shop-read-actions { margin-top: 0; }
  .shop-paid-action { align-items: center; flex-direction: row; }
  .shop-table { min-width: 590px; }
}

@media (min-width: 1100px) {
  .accounts-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
```

- [ ] **Step 4: Style drawer mobile navigation và safe-area**

```css
.account-drawer {
  width: 100%;
  height: 100vh;
  height: 100dvh;
  padding: 0 12px calc(12px + env(safe-area-inset-bottom));
  border-width: 0;
}
.dialog-heading {
  top: 0;
  padding: calc(12px + env(safe-area-inset-top)) 0 10px;
}
.drawer-tabbar {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  gap: 4px;
  margin: 0 -12px 12px;
  padding: 6px 12px;
  overflow-x: auto;
  background: var(--bg);
  border-bottom: 1px solid var(--line);
  scrollbar-width: none;
}
.drawer-tabbar::-webkit-scrollbar { display: none; }
.drawer-tabbar button {
  flex: 0 0 auto;
  min-height: 40px;
  padding: 8px 10px;
  color: var(--muted);
  background: transparent;
  border: 0;
  border-bottom: 2px solid transparent;
  border-radius: 0;
}
.drawer-tabbar button.active {
  color: var(--fg);
  border-bottom-color: var(--accent);
}
.drawer-panel-slot[hidden] { display: none; }

@media (min-width: 680px) {
  .account-drawer { width: min(720px, 100%); padding: 18px; border-width: 1px; }
  .dialog-heading { padding: 0; }
}
```

- [ ] **Step 5: Touch target, typography và overflow guards**

```css
html, body, #root { min-width: 0; }
body { overflow-x: hidden; }
img, svg, video, canvas { max-width: 100%; }

@media (pointer: coarse) {
  button, .tab, .quests-tab-btn { min-height: 40px; }
  input:not([type='checkbox']):not([type='radio']), select { min-height: 40px; }
}
```

Nâng các font 9–10px trong `.tree-plan-cell-warning`, `.box-status-tag`, `.btn-box-claim`, `.tab-badge`, `.tab-pill`, `.eyebrow` lên 11px; không đổi font log 12px.

- [ ] **Step 6: Bật safe-area viewport**

Đổi dòng meta thành:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

- [ ] **Step 7: Verify task**

Run:
```bash
cd avatar-web/web && npm run build && npm run test
```
Expected: build và tất cả tests pass; không có warning CSS syntax.

- [ ] **Step 8: Kiểm tra scope và commit**

Run GitNexus detect_changes `scope: all`; expected chỉ styles/index và các flows UI gián tiếp. Sau đó:

```bash
git add avatar-web/web/src/styles.css avatar-web/web/index.html
git commit -m "refactor(web): make responsive styles mobile first"
```

---

### Task 4: Chạy app và kiểm tra responsive thực tế

**Files:**
- Modify: `docs/superpowers/plans/2026-08-22-mobile-first-ui.md` (chỉ tick checkbox)

**Interfaces:**
- Consumes: kết quả Tasks 1–3.
- Produces: xác nhận UI trên 360×800, 390×844, 768px, 1280px.

- [ ] **Step 1: Chạy full verification tự động**

```bash
cd avatar-web/web && npm run build && npm run test
```
Expected: build pass; toàn bộ test suite pass.

- [ ] **Step 2: Chạy dev server bằng skill `run`**

Run: invoke `/run` cho `avatar-web/web`; đăng nhập bằng môi trường dev hiện có nếu đã được cấu hình, không tạo credential giả.

Expected: dashboard render và mở được account drawer.

- [ ] **Step 3: Kiểm tra 4 viewport**

Checklist:
- 360×800: dashboard 1 cột; drawer full-screen; tab cuộn ngang; chỉ panel active hiển thị; bảng là card; không horizontal scroll.
- 390×844: giống 360px; input không làm layout nở ngang; touch target dễ bấm.
- 768px: dashboard 2 cột; drawer 720px; tất cả panel xếp dọc; bảng desktop; lưới cây 8 cột.
- 1280px: dashboard 3 cột; desktop layout không regression.
- Chỉnh tree plan, đổi tab rồi quay lại: state chưa lưu còn nguyên.

- [ ] **Step 4: Final GitNexus verification**

Run GitNexus detect_changes `scope: compare`, `base_ref: 326c31f`; expected chỉ các symbols/UI flows trong spec. Xác nhận mọi d=1 dependent đã được cập nhật.

- [ ] **Step 5: Cập nhật checkbox plan và commit verification metadata**

Sau khi mọi mục pass, tick toàn bộ checkbox hoàn thành và commit plan progress:

```bash
git add docs/superpowers/plans/2026-08-22-mobile-first-ui.md
git commit -m "docs: complete mobile-first UI implementation plan"
```
