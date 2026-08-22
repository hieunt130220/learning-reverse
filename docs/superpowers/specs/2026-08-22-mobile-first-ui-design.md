# Tối ưu UI avatar-web theo hướng Mobile-first — Design Document

- **Ngày**: 2026-08-22
- **Phạm vi**: `avatar-web/web` (React 18 + Vite, CSS thuần 1 file)
- **Loại**: Architectural (refactor CSS toàn app + UX điều hướng mobile)

## 1. Mục tiêu & Bối cảnh

UI hiện tại được viết desktop-first: style mặc định cho màn hình lớn, rồi "vá" cho
màn nhỏ qua 2 media query `max-width` (1099px, 679px). Trên điện thoại thực tế gặp:

- Drawer vận hành xếp chồng 8 panel dọc → phải cuộn rất sâu để tìm panel.
- Bảng Sạp bán / Quy tắc tự bán có `min-width: 590px` → buộc cuộn ngang.
- `.cols` dùng `minmax(420px, …)` → vỡ layout dưới 420px.
- Touch target nhỏ (font 10–12px, padding mỏng), input font <16px khiến iOS tự zoom.
- Không có safe-area cho iPhone tai thỏ; chiều cao drawer dùng `vh` nên bị thanh
  địa chỉ động che khuất.

Mục tiêu: viết lại CSS theo hướng **mobile-first** và cải thiện UX mobile
(điều hướng panel bằng tab sticky, bảng chuyển thành thẻ) mà **không đổi hành vi
desktop**, không đổi tên class, không thêm dependency.

## 2. Phạm vi

### In-scope

1. Refactor tại chỗ `avatar-web/web/src/styles.css` sang mobile-first:
   - Style base = mobile (≤679px), media query `min-width: 680px` và `min-width: 1100px`.
   - Dashboard grid: 1 cột (base) → 2 cột ≥680px → 3 cột ≥1100px.
   - Lưới cây (`tree-plan-grid`): 4 cột (base) → 8 cột ≥680px.
   - `.cols`: `minmax(min(100%, 420px), 1fr)` để hết vỡ dưới 420px.
2. Drawer vận hành trên mobile: thanh tab sticky ngang cuộn được để nhảy tới từng
   panel (Trạng thái / Tự động / Nhiệm vụ / Nấu ăn / Tài sản / Sạp / Log).
   - **Tất cả panel vẫn mount**, chỉ ẩn/hiện bằng thuộc tính `hidden` → không mất
     state nội bộ khi chuyển tab (kế hoạch cây chưa lưu, dữ liệu runtime).
   - Desktop giữ nguyên bố cục cuộn dọc như hiện tại.
   - Header drawer sticky kèm `safe-area-inset-top`; chiều cao drawer `100dvh`
     với fallback `100vh`.
3. Bảng dữ liệu thành thẻ trên mobile (Sạp bán + Auto-sell):
   - Giữ markup `<table>`, thêm `data-label` cho từng `<td>` có nhãn tiếng Việt.
   - Mobile: `tr` thành khối card, `td::before { content: attr(data-label) }`,
     bỏ `min-width: 590px`, hết cuộn ngang.
4. Chi tiết responsive:
   - Input/select/textarea font-size 16px trên mobile (chống iOS zoom).
   - Touch target ≥40px trên `pointer: coarse` cho nút, tab.
   - Nút `.action-head > button` full-width xếp tầng trên mobile, bỏ min-width 170px.
   - Font nhỏ nhất ≥11px.
   - `index.html` thêm `viewport-fit=cover`; safe-area-inset cho header/tab bar.
5. File mới `src/useMediaQuery.ts` + stub `matchMedia` trong `test/setup.ts`.

### Out-of-scope

- Không đổi logic nghiệp vụ của bất kỳ panel nào (fetch, WS, plan editor...).
- Không đổi tên class CSS hiện có, không tách file CSS, không thêm framework.
- Không đổi AccountDebugPage (trang debug chuyên sâu, ít dùng trên mobile).
- Không viết test mới ngoài stub matchMedia cần thiết để suite chạy đúng.

## 3. Thiết kế kỹ thuật

### 3.1 Breakpoints (đảo chiều max→min)

| Khoảng | Media query | Ghi chú |
|---|---|---|
| Base (mobile) | (không query) | ≤679px |
| Tablet | `@media (min-width: 680px)` | nâng cấp từ mobile |
| Desktop | `@media (min-width: 1100px)` | nâng cấp từ tablet |

### 3.2 Hook useMediaQuery

```ts
export function useMediaQuery(query: string): boolean {
  // useState(false) + useEffect subscribe matchMedia;
  // nếu !window.matchMedia → trả false luôn (an toàn jsdom/old browser)
}
```

Chỉ dùng ở một nơi duy nhất: `AccountOperationsDrawer` quyết định `isMobile =
useMediaQuery('(max-width: 679px)')`. Panel con không biết gì về mobile/desktop —
chúng nhận prop `hidden` từ drawer.

### 3.3 Drawer với tab điều hướng

Cấu trúc mới của `LoadedOperations`:

Danh sách panel định nghĩa bằng hằng số mảng `PANEL_TABS` (mỗi phần tử `{ id, label }`),
map 1-1 với thứ tự panel trong drawer:

```tsx
const PANEL_TABS = [
  { id: 'status',   label: 'Trạng thái' },
  { id: 'autofarm', label: 'Tự động' },
  { id: 'quests',   label: 'Nhiệm vụ' },
  { id: 'cooking',  label: 'Nấu ăn' },
  { id: 'assets',   label: 'Tài sản' },
  { id: 'shop',     label: 'Sạp' },
  { id: 'logs',     label: 'Log' },
] as const;
```

Drawer giữ state `activePanel: string | null`; `null` = chế độ desktop/cuộn dọc
(không tab, tất cả panel hiển thị):

```tsx
{isMobile && (
  <nav className="drawer-tabbar" role="tablist">…</nav>
)}
<div className="drawer-panels">
  <StatusPanel hidden={activePanel !== null && activePanel !== 'status'} … />
</div>
```

- Chuyển tab = set `hidden` cho panel khác + scroll drawer lên đỉnh panel đang mở.
- `role="tablist"`/`aria-selected` cho a11y; tab active có underline accent.
- Tab bar sticky dưới header; cuộn ngang khi tràn (`overflow-x: auto`).

### 3.4 Bảng → thẻ qua data-label

Markup giữ nguyên dạng bảng, ví dụ ShopPanel:

```tsx
<td data-label="Giá bán">{price}</td>
```

CSS mobile:

```css
@media (max-width: 679px) {
  .shop-table thead { display: none; }
  .shop-table tr { display: block; margin-bottom: 8px; border: ...; }
  .shop-table td { display: flex; justify-content: space-between; gap: 8px; }
  .shop-table td::before { content: attr(data-label); color: var(--muted); }
}
```

Ngoại lệ có chủ ý so với nguyên tắc min-width: khối bảng→thẻ này dùng
`@media (max-width: 679px)` vì bảng là "trạng thái nâng cao" của desktop, mobile
cần đặc biệt hóa riêng. Mọi phần khác vẫn tuân thủ base-mobile + min-width.

### 3.5 Chi tiết responsive khác

- `.cols`: `repeat(auto-fit, minmax(min(100%, 420px), 1fr))`.
- `body`/drawer dùng `dvh` với fallback `vh` trước đó (hai dòng khai báo).
- `@media (pointer: coarse)`: nút, `.tab`, `.quests-tab-btn`, tab drawer min-height
  ~40px; input height tối thiểu 40px.
- Input/select/textarea: `font-size: 16px` trong base (mobile) — desktop giữ 14px
  qua media min-width 680px (iOS chỉ zoom khi focus input font <16px).
- Safe-area: `env(safe-area-inset-top/bottom)` padding cho drawer header + tab bar.

### 3.6 Files liên quan & vai trò

| File | Vai trò |
|---|---|
| `web/src/styles.css` | Refactor chính: đảo breakpoint, thẻ bảng, touch target, safe-area, dvh |
| `web/src/accounts/AccountOperationsDrawer.tsx` | Thêm tab bar mobile + truyền `hidden` xuống panel |
| `web/src/useMediaQuery.ts` (mới) | Hook matchMedia an toàn SSR/jsdom |
| `web/src/accounts/panels/*.tsx` | Nhận thêm prop `hidden?: boolean`; wrapper `<section>` gắn `hidden={…}` |
| `web/src/accounts/panels/ShopPanel.tsx` | Thêm `data-label` cho các td |
| `web/src/accounts/AutoSellRulesEditor.tsx` | Thêm `data-label` cho các td |
| `web/index.html` | `viewport-fit=cover` |
| `web/src/test/setup.ts` | Stub matchMedia cho vitest (matchMedia không có trong jsdom) |

## 4. Rủi ro & xử lý

- **Test hiện tại render panel trực tiếp** (không qua drawer) → prop `hidden` là
  optional, mặc định undefined = hiển thị bình thường → test cũ không vỡ.
- **State panel khi ẩn**: vì panel vẫn mount, runtime hook vẫn chạy → dữ liệu tiếp
  tục cập nhật nền. Đúng ý đồ.
- **Bảng có nút bấm trong td** (sửa/xóa): dạng thẻ phải đảm bảo nút vẫn bấm được,
  td flex row giữa nhãn và giá trị/nút.
- **Index stale**: sau commit, chạy `npx gitnexus analyze` (hook đã tự động).

## 5. Verification Plan

1. `cd avatar-web/web && npm run build` — TypeScript pass.
2. `npm run test` — toàn bộ suite hiện tại pass (stub matchMedia đã thêm).
3. Thủ công qua dev server (`npm run dev`) với DevTools responsive:
   - 360×800 (mobile nhỏ), 390×844 (iPhone), 768px (tablet), 1280px (desktop):
     - Dashboard tài khoản: 1/2/3 cột đúng breakpoint.
     - Mở drawer: mobile thấy tab bar, chuyển tab đổi panel, không mất state kế
       hoạch cây khi chuyển tab (sửa plan → đổi tab → quay lại vẫn còn).
     - Sạp bán: mobile dạng thẻ, không cuộn ngang; desktop vẫn bảng.
     - Focus vào input trên iOS thật hoặc DevTools "iPad/iPhone": không auto-zoom.
     - Không có cuộn ngang trang ở mọi viewport thử nghiệm.
