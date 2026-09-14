# Avatar Web Design Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tách `styles.css` 2186 dòng thành 3 file, dọn 128 inline về token/class, gom drawer 8 → 5 tabs, polish nút + AccountCard.

**Architecture:** Hướng A — static import 3 file CSS theo thứ tự tokens → base → components (Vite gộp lại như cũ). Inline map thẳng về `var(--*)` hoặc class prefix theo panel. Tabs thành `PANEL_GROUPS` 5 nhóm, giữ state/aria/dirty-guard hiện tại.

**Tech Stack:** React 18.3.1, Vite 6, Vitest, CSS custom properties, jsdom + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-14-avatar-web-design-refactor-design.md`

## Global Constraints
- Hex giữ nguyên 100% khi tách CSS — chỉ di chuyển, không chỉnh giá trị nào.
- TUYỆT ĐỐI không đổi tên class hiện hữu; class mới dùng tiền tố theo panel (`fishing-*`, `cooking-*`, `review-*`, `quest-filter-*`).
- Không tạo test files mới; chỉ sửa test hiện hữu nếu assertion vỡ vì thay đổi hợp lệ (lưu ý project no-TDD).
- Mỗi Task kết thúc bằng verify build + commit riêng; `detect_changes({scope:"all"})` trước mỗi commit.
- `find_npc` giữ ẩn — không đưa vào PANEL_GROUPS.
- Giá trị động (progress width %) được phép giữ `style={{ width }}` đơn lẻ.

---

### Task 1: Tách styles.css thành 3 file

**Files:**
- Create: `avatar-web/web/src/styles/tokens.css`
- Create: `avatar-web/web/src/styles/base.css`
- Create: `avatar-web/web/src/styles/components.css`
- Modify: `avatar-web/web/src/main.tsx` (dòng 6: 1 import → 3 import)
- Delete: `avatar-web/web/src/styles.css`

**Interfaces:**
- Consumes: none (task đầu tiên)
- Produces: 3 file CSS + import order cho mọi task sau; class names giữ nguyên 100%

Ranh giới cắt (theo số dòng `styles.css` hiện tại):
- `tokens.css` = dòng 1–24 (`:root` 24 vars) + tidy adds (`--gold: #ffd700; --gold-deep: #ff9f1c; --tab-active: #21262d; --log-op: #d2a8ff; --skip: #ffbc76; --radius-sm/md/lg/xl/pill`) + `color-scheme: dark`.
- `base.css` = dòng 26–89 (`*`, `html/body/#root`, `body`, `img/svg/video/canvas`, `.app`, `header`, `h1`, `h2`, `.cols`, `.col`) + 4 media blocks cuối (dòng 2042–2139: 679px / 680px / 1100px / pointer:coarse) + prefers-reduced-motion (dòng 982–985).
- `components.css` = phần còn lại (dòng 91–2040 + 2141–2186): `.card`, `label`, `input/select/textarea`, `button`, `.tabs`, `.badge`, `.log`, `.grid/.cell`, `.status-banner`, `.mode-chip`, auth, dashboard, dialog/drawer, tree-plan, fishing-ticket, quests, shop, auto-sell, keyframes dialog-fade/drawer-in/pulse-glow, settings-tabs.
- Thứ tự import trong `main.tsx`:
```tsx
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
```

- [ ] **Step 1: Tạo tokens.css**
Viết `avatar-web/web/src/styles/tokens.css` với nội dung: copy nguyên văn block `:root` dòng 1–24, sau dòng `--err-line` thêm 5 tidy vars + 5 radius vars, đóng `}`; thêm dòng `color-scheme: dark;` trong `:root`; thêm header comment `/* Tokens — tách từ styles.css dòng 1-24, hex giữ nguyên */`.

- [ ] **Step 2: Tạo base.css**
Viết `avatar-web/web/src/styles/base.css`: copy nguyên văn dòng 26–89; copy nguyên văn 4 media blocks dòng 2042–2139 và prefers-reduced-motion dòng 982–985. Thêm header comment `/* Base — reset/element/breakpoints, tách từ styles.css */`. KHÔNG sửa giá trị nào.

- [ ] **Step 3: Tạo components.css**
Viết `avatar-web/web/src/styles/components.css`: copy nguyên văn toàn bộ phần còn lại (dòng 91–2040 và 2141–2186, gồm keyframes `@keyframes dialog-fade`, `@keyframes drawer-in`, `@keyframes pulse-glow`). Thêm header comment `/* Components — tách từ styles.css, class names giữ nguyên */`. KHÔNG sửa giá trị nào.

- [ ] **Step 4: Đổi import trong main.tsx**
Sửa `avatar-web/web/src/main.tsx` dòng 6 `import './styles.css';` thành 3 dòng import theo thứ tự tokens → base → components (code ở trên). Xóa file `avatar-web/web/src/styles.css` (`git rm`).

- [ ] **Step 5: Verify**
Run: `npm run build --prefix avatar-web/web`
Expected: build pass, không lỗi resolve CSS.
Run: `grep -rn "styles.css'" avatar-web/web/src --include="*.tsx" --include="*.ts" | grep -v "styles/" ; echo GREP_DONE`
Expected: `GREP_DONE` (không còn import nào trỏ file cũ).
Run: `detect_changes({scope:"all", repo:"learning-reverse"})`
Expected: risk low, chỉ file CSS + main.tsx đổi.

- [ ] **Step 6: Commit**
`git add avatar-web/web/src/styles avatar-web/web/src/main.tsx && git rm -q avatar-web/web/src/styles.css 2>/dev/null; git commit -m "refactor(web): split styles.css into tokens/base/components"`

---

### Task 2: Dọn 48 inline trong FishingPanel

**Files:**
- Modify: `avatar-web/web/src/accounts/panels/FishingPanel.tsx` (48 khối)
- Modify: `avatar-web/web/src/styles/components.css` (append block `.fishing-*`)

**Interfaces:**
- Consumes: 3 file CSS từ Task 1 (append class mới vào components.css)
- Produces: class `.fishing-*` tái dùng cho Task 5 (Settings/FishingSettings dùng chung naming)

Bảng map (tên class mới → nội dung, copy giá trị từ inline, thay hex bằng var):

```css
/* --- fishing panel (tách từ inline FishingPanel.tsx) --- */
.fishing-root { display: flex; flex-direction: column; gap: 1rem; padding: 0.5rem 0; }
.fishing-head { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: var(--card-muted); border-radius: var(--radius-md); border: 1px solid var(--line); }
.fishing-head h3 { margin: 0; font-size: 1.05rem; font-weight: 600; }
.fishing-card { padding: 0.85rem 1rem; background: var(--bg-deep); border-radius: var(--radius-md); border: 1px solid var(--line); display: flex; flex-direction: column; gap: 0.65rem; }
.fishing-card-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.fishing-card-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.fishing-card-title h4 { margin: 0; font-size: 0.95rem; font-weight: 600; }
.fishing-count-pill { font-size: 0.75rem; padding: 2px 8px; border-radius: 10px; }
.fishing-count-pill--done { background: var(--ok-dim); color: var(--ok); border: 1px solid var(--ok-line); }
.fishing-count-pill--pending { background: var(--accent-dim); color: var(--accent); border: 1px solid var(--accent); }
.fishing-cond { padding: 0.5rem 0.75rem; border-radius: var(--radius-sm); display: flex; flex-direction: column; gap: 0.35rem; }
.fishing-cond--done { background: var(--ok-dim); border: 1px solid var(--ok-line); }
.fishing-cond--pending { background: var(--card-muted); border: 1px solid var(--line); }
.fishing-cond-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 0.85rem; }
.fishing-cond-name { font-weight: 500; color: var(--fg); }
.fishing-done-banner { padding: 0.5rem 0.75rem; background: var(--ok-dim); border-radius: var(--radius-sm); border: 1px solid var(--ok-line); font-size: 0.85rem; color: var(--ok); display: flex; align-items: center; gap: 6px; }
.fishing-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.75rem; }
.fishing-metric { padding: 0.75rem; background: var(--bg-deep); border-radius: var(--radius-sm); border: 1px solid var(--line); }
.fishing-metric-value { font-weight: 700; }
.fishing-metric-value--lg { font-size: 1.4rem; color: var(--ok); margin-top: 0.2rem; }
.fishing-metric-value--fish { font-size: 1.15rem; color: var(--log-op); margin-top: 0.3rem; }
.fishing-metric-value--map { font-size: 1.1rem; font-weight: 600; color: var(--fg); margin-top: 0.4rem; }
.fishing-metric-value--rate { font-size: 1.4rem; color: var(--accent); margin-top: 0.2rem; }
.fishing-list { margin: 0; padding: 0; list-style: none; display: grid; gap: 0.45rem; }
.fishing-list-row { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.fishing-refresh-btn { font-size: 0.8rem; padding: 4px 10px; }
.fishing-foot { font-size: 0.85rem; color: var(--muted); }
.fishing-stack { display: flex; flex-direction: column; gap: 0.5rem; }
.fishing-between { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
```

Giữ lại `style` đơn lẻ cho width động: `FishingPanel.tsx:381` (`mission-mini-bar-fill`), các dòng 257/358/549/621 kiểu `style={{ width: ... }}` của QuestsPanel KHÔNG thuộc task này.

- [ ] **Step 1: Append block fishing vào components.css**
Thêm toàn bộ block CSS trên vào cuối `components.css`.

- [ ] **Step 2: Thay inline dòng 212–232 (root + header)**
Thay `<div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>` → `<div className="fishing-root">`; div header style 7 thuộc tính (dòng 214–224) → `className="fishing-head"`; `h3` inline → bỏ style (class `.fishing-head h3` lo); `p className="hint" style={{ margin: '0.2rem 0 0 0' }}` → giữ class hint, bỏ style (hint mặc định đã có margin 4px — chấp nhận chênh 0.2rem theo spec polish-tolerant, KHÔNG thêm rule mới).

- [ ] **Step 3: Thay inline quest card (dòng 242–415)**
Div card (dòng 242–252) → `fishing-card`; head (253–260) → `fishing-card-head`; title wrap (261) + icon `🎣` span `fontSize 1.1rem` (giữ inline 1 dòng font-size — emoji size, không phải màu) + `h4` → class qua `.fishing-card-title h4`; count pill (270–283, rgba theo isDone) → `fishing-count-pill fishing-count-pill--done|pending`; refresh button (296–303, fontSize/padding/flex/cursor) → `ghost fishing-refresh-btn`, bỏ cursor động (disabled đã có cursor); done banner (311–323) → `fishing-done-banner`; cond card (341–354) → `fishing-cond fishing-cond--done|pending`; cond row (355–363) → `fishing-cond-row`; name span (364) → `fishing-cond-name`; empty-row (390–397) → `fishing-between`.

- [ ] **Step 4: Thay inline metrics + daily list (dòng 418–520)**
Grid metrics (419–425) → `fishing-metrics`; 4 metric card (426/433/440/447) → `fishing-metric`; 4 value div (428/435/442/449) → `fishing-metric-value--lg|--fish|--map|--rate`; section daily (462) → giữ `aria-labelledby`, thay style bằng `fishing-card`; list (475) → `fishing-list`; row (477) → `fishing-list-row`; foot text (505) → `fishing-foot`; nút "Sang tab Cài đặt" (508–514) → giữ `ghost`, bỏ inline fontSize/whiteSpace (base đã có white-space: nowrap).

- [ ] **Step 5: Verify**
Run: `npm run build --prefix avatar-web/web` (Expected: pass)
Run: `npm test --prefix avatar-web/web` (Expected: toàn suite pass)
Run: `grep -c "style={{" avatar-web/web/src/accounts/panels/FishingPanel.tsx` (Expected: ≤ 6 — chỉ còn width động mission-mini-bar + emoji font-size)
Run: `grep -n "#58a6ff\|#3fb950\|#12161d\|#1d2430\|#d2a8ff\|#f0f6fc" avatar-web/web/src/accounts/panels/FishingPanel.tsx; echo HEX_DONE` (Expected: `HEX_DONE`, không còn hex)

- [ ] **Step 6: Commit**
`git add avatar-web/web/src/accounts/panels/FishingPanel.tsx avatar-web/web/src/styles/components.css && git commit -m "refactor(web): replace FishingPanel inline styles with classes"`

---

### Task 3: Dọn 30 inline FishingSettingsPanel + 21 inline CookingPanel

**Files:**
- Modify: `avatar-web/web/src/accounts/panels/FishingSettingsPanel.tsx` (30 khối)
- Modify: `avatar-web/web/src/accounts/panels/CookingPanel.tsx` (21 khối)
- Modify: `avatar-web/web/src/styles/components.css` (append 2 block)

**Interfaces:**
- Consumes: naming `.fishing-*` từ Task 2 (FishingSettings dùng chung prefix)
- Produces: `.fishing-form-*` + `.cooking-*` hoàn chỉnh cho Task 5 đối chiếu

Block CSS mới (append components.css):

```css
/* --- fishing settings form (tách từ inline FishingSettingsPanel.tsx) --- */
.fishing-form { display: flex; flex-direction: column; gap: 1rem; }
.fishing-form-section h3 { margin: 0 0 8px; font-size: 14px; color: var(--accent); }
.fishing-form-stack { display: flex; flex-direction: column; gap: 0.75rem; }
.fishing-form-field { display: flex; flex-direction: column; gap: 0.3rem; }
.fishing-form-label { font-size: 0.85rem; color: var(--muted); }
.fishing-form-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
.fishing-form-checkrow { display: flex; align-items: center; gap: 8px; }
.fishing-form-save { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
.fishing-form-saved { color: var(--ok); font-size: 0.85rem; font-weight: 500; }
.fishing-form-warn { color: var(--warn); margin: 0; }

/* --- cooking panel (tách từ inline CookingPanel.tsx) --- */
.cooking-head { display: flex; justify-content: space-between; align-items: center; }
.cooking-slots { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 0.5rem; margin: 0.75rem 0; }
.cooking-slot-name { font-weight: bold; font-size: 0.85rem; }
.cooking-slot-empty { color: var(--muted); margin: 0.35rem 0; }
.cooking-slot-dish { font-size: 0.9rem; margin: 0.2rem 0; font-weight: 500; }
.cooking-slot-state { font-size: 0.8rem; }
.cooking-slot-state--done { color: var(--ok); }
.cooking-slot-state--pending { color: var(--muted); }
.cooking-section { margin-top: 1rem; border-top: 1px solid var(--line); padding-top: 0.75rem; }
.cooking-recipe-list { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.5rem; }
.cooking-recipe-head { display: flex; justify-content: space-between; align-items: center; font-weight: 500; }
.cooking-recipe-chef { display: flex; align-items: center; gap: 0.5rem; }
.cooking-recipe-img { width: 28px; height: 28px; object-fit: contain; }
.cooking-recipe-mats { margin-top: 0.25rem; display: flex; gap: 0.5rem; flex-wrap: wrap; }
.cooking-materials-head { display: flex; justify-content: space-between; align-items: center; }
.cooking-material-row { display: flex; justify-content: space-between; font-size: 0.85rem; }
.cooking-unlock-tag { color: var(--ok); font-weight: bold; }
```

Lưu ý map đặc biệt:
- `FishingSettingsPanel.tsx:165` `section.card + style flex column gap` → giữ `card`, thêm `fishing-form`.
- Dòng 173/242 `h3 margin/color accent` → `.fishing-form-section h3` (bọc section bằng `fishing-form-section`).
- Dòng 349 `tree-plan-save-row + inline flex` → giữ class cũ, bỏ inline (class đã có flex).
- `CookingPanel.tsx:141` `var(--color-muted, #888)` → `var(--muted)`; dòng 147 `isDone ? 'green' : var(--color-muted,#666)` → class `--done|--pending`; dòng 159/221 `var(--color-border, #eee)` → `var(--line)`; dòng 224 `'green'` → class `cooking-unlock-tag`; dòng 230 `m.isDone ? 'green' : 'inherit'` → giữ inline KHÔNG đổi (logic 2-state trong map, tách class tốn 2 class mới mà chỉ dùng 1 lần — ngoại lệ YAGNI có ghi chú).
- `CookingPanel.tsx:185` img `width/height/objectFit` → class `cooking-recipe-img`.

- [ ] **Step 1: Append 2 block CSS + thay FishingSettingsPanel**
Thêm block fishing-form vào components.css; thay 30 inline theo map: label/div stack → class tương ứng; select/input inline width/padding → bỏ (base đã có); checkrow → `fishing-form-checkrow`; save row → `fishing-form-save`; saved msg (361) → `fishing-form-saved`; warn (371, `#e3b341`) → `fishing-form-warn`.

- [ ] **Step 2: Thay CookingPanel**
Thêm block cooking vào components.css; thay 21 inline theo map (ngoại lệ dòng 230 giữ nguyên + comment `{/* giữ inline: 2-state 1 lần dùng, tách class không đáng */}`).

- [ ] **Step 3: Verify**
Run: `npm run build --prefix avatar-web/web` (Expected: pass)
Run: `npm test --prefix avatar-web/web` (Expected: pass)
Run: `grep -c "style={{" avatar-web/web/src/accounts/panels/FishingSettingsPanel.tsx avatar-web/web/src/accounts/panels/CookingPanel.tsx` (Expected: FishingSettings ≤ 2, Cooking ≤ 2 — chỉ còn width động + ngoại lệ dòng 230)
Run: `grep -n "color-muted\|color-border\|#888\|#666\|#eee\|'green'" avatar-web/web/src/accounts/panels/CookingPanel.tsx; echo COOK_HEX` (Expected: chỉ còn dòng 230 `'green'` + comment)

- [ ] **Step 4: Commit**
`git add avatar-web/web/src/accounts/panels/FishingSettingsPanel.tsx avatar-web/web/src/accounts/panels/CookingPanel.tsx avatar-web/web/src/styles/components.css && git commit -m "refactor(web): replace FishingSettings and Cooking inline styles"`

---

### Task 4: Dọn inline còn lại (10 file, ~29 khối)

**Files:**
- Modify: `avatar-web/web/src/styles/components.css` (append block `.misc-*` + `.review-*`)
- Modify (mỗi file 1–7 khối): `panels/LiveReviewCaptureCard.tsx` (7), `panels/CaptchaPanel.tsx` (7), `panels/QuestsPanel.tsx` (4 width động — CHỈ kiểm tra, giữ nguyên), `panels/StatusPanel.tsx` (3), `auth/useAuth.tsx` (1), `panels/SettingsPanel.tsx` (1), `accounts/KitchenPlanEditor.tsx` (1), `accounts/AutoSellRulesEditor.tsx` (1), `accounts/AnimalPlanEditor.tsx` (1), `accounts/AccountDebugPage.tsx` (1)

**Interfaces:**
- Consumes: 3 file CSS từ Task 1, naming từ Task 2–3
- Produces: codebase tsx hết hex hardcode (trừ width động + ngoại lệ Task 3)

Block CSS:

```css
/* --- misc one-off (tách từ inline lẻ) --- */
.misc-loading { padding: 24px; }
.misc-nomargin { margin: 0; }
.misc-status-row { margin-top: 0.25rem; }
.misc-check-label { font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 0.4rem; }
.misc-check-input { width: auto; margin: 0; }
.misc-settings-stack { display: flex; flex-direction: column; gap: 12px; }
.misc-captcha-row { display: flex; gap: 8px; margin-bottom: 8px; }
.misc-captcha-file { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px solid var(--line); }
.misc-captcha-img { max-width: 100%; border: 1px solid var(--line); image-rendering: pixelated; }
.misc-th-action { width: 90px; text-align: center; }
.misc-palette-keepgap { margin-top: 10px; }
/* --- live review card --- */
.review-card { padding: 0.85rem 1rem; background: var(--bg-deep); border: 1px solid var(--line); border-radius: var(--radius-md); display: grid; gap: 0.65rem; }
.review-head { display: flex; justify-content: space-between; gap: 12px; align-items: center; flex-wrap: wrap; }
.review-progress-row { display: flex; justify-content: space-between; font-size: 0.85rem; }
.review-progress { width: 100%; }
.review-actions { display: flex; gap: 8px; flex-wrap: wrap; }
```

Map từng file:
- `LiveReviewCaptureCard.tsx:47` section → `review-card` (bỏ `#12161d` → `var(--bg-deep)`); 48 → `review-head`; 52 progress row → `review-progress-row`, `progress style width 100%` → `review-progress`; 55 → `review-actions`; hint/err margin 0 → `misc-nomargin`.
- `CaptchaPanel.tsx:58` flash marginBottom → bỏ (flash đã có margin); 65 → `misc-captcha-row`; 76 log maxHeight/overflow → bỏ (class `.log` đã có); 78 file row `#eee` → `misc-captcha-file`; 84 link marginRight → bỏ, dùng gap cha; 97 `marginTop 12` → giữ inline? KHÔNG — thêm `style` thành class `.log` cha đã có margin-top 8px, chênh 4px chấp nhận; 102 img `#ccc` → `misc-captcha-img`.
- `QuestsPanel.tsx` 4 khối toàn `style={{ width: % }}` → GIỮ NGUYÊN, không đụng (đúng Global Constraints).
- `StatusPanel.tsx:251` row → `row misc-status-row`; 254 label → `misc-check-label`; 267 input → `misc-check-input`.
- `useAuth.tsx:69` + `AccountDebugPage.tsx:17` loading → `hint misc-loading`.
- `SettingsPanel.tsx:35` → `misc-settings-stack`.
- `KitchenPlanEditor.tsx:115` + `AnimalPlanEditor.tsx:117` palette marginTop → `misc-palette-keepgap` (giữ class tree-plan-palette gốc).
- `AutoSellRulesEditor.tsx:149` th → `misc-th-action`.

- [ ] **Step 1: Append block + thay 10 file**
Thêm block CSS trên vào components.css; thay từng file theo map.

- [ ] **Step 2: Verify**
Run: `npm run build --prefix avatar-web/web` (Expected: pass)
Run: `npm test --prefix avatar-web/web` (Expected: pass)
Run: `grep -rn "style={{" avatar-web/web/src --include="*.tsx" | grep -v "width:" | grep -v "CookingPanel.*230"; echo INLINE_DONE`
Expected: `INLINE_DONE` (không còn inline ngoài width động + ngoại lệ)
Run: `grep -rn "#58a6ff\|#3fb950\|#12161d\|#1d2430\|#d2a8ff\|#f0f6fc\|#eee\|#ccc\|#888\|#666\|'green'" avatar-web/web/src --include="*.tsx"; echo HEX_DONE`
Expected: `HEX_DONE` (sạch hex trong tsx)

- [ ] **Step 3: Commit**
`git add avatar-web/web/src avatar-web/web/src/styles/components.css && git commit -m "refactor(web): remove remaining inline styles and tsx hex codes"`

---

### Task 5: Gom drawer 8 tabs → 5 nhóm

**Files:**
- Modify: `avatar-web/web/src/accounts/AccountOperationsDrawer.tsx` (dòng 20–37, 164–200 + slot fishing/settings cross-link)
- Modify: `avatar-web/web/src/accounts/accountsRoutes.test.tsx` (dòng 192–200: assertion tab mới)
- Test: dùng test hiện hữu `accountsRoutes.test.tsx` (không tạo file mới)

**Interfaces:**
- Consumes: panel components hiện tại (props giữ nguyên, chỉ đổi cách nhóm tabbar)
- Produces: `PANEL_GROUPS` export cho test import; drawer 5 tabs cho Task 6 verify mắt thường

Code mới thay dòng 20–37:

```tsx
const PANEL_TABS = [
  ['status', 'Trạng thái'],
  ['settings', 'Cài đặt'],
  ['fishing', '🎣 Câu cá'],
  ['find_npc', 'Tìm NPC'],
  ['quests', 'Nhiệm vụ'],
  ['cooking', 'Nấu ăn'],
  ['assets', 'Tài sản'],
  ['shop', 'Sạp'],
  ['logs', 'Log'],
] as const;
type PanelId = (typeof PANEL_TABS)[number][0];

export interface PanelGroup {
  id: string;
  label: string;
  panels: PanelId[];
}

export const PANEL_GROUPS: PanelGroup[] = [
  { id: 'operations', label: 'Vận hành', panels: ['status', 'settings'] },
  { id: 'farm', label: 'Nông trại', panels: ['quests', 'cooking'] },
  { id: 'fishing', label: '🎣 Câu cá', panels: ['fishing'] },
  { id: 'assets', label: 'Tài sản', panels: ['assets', 'shop'] },
  { id: 'logs', label: 'Log', panels: ['logs'] },
];

const PANEL_TO_GROUP = new Map<PanelId, string>(
  PANEL_GROUPS.flatMap((g) => g.panels.map((p): [PanelId, string] => [p, g.id])),
);

const FIND_NPC_TAB_HIDDEN = true;

const VISIBLE_TABS = PANEL_TABS.filter(
  ([id]) => !(id === 'find_npc' && FIND_NPC_TAB_HIDDEN),
) as Array<(typeof PANEL_TABS)[number]>;
```

Logic chọn/hiện theo nhóm (thay dòng 124 + 164–200):

```tsx
const activeGroup = PANEL_TO_GROUP.get(activePanel) ?? 'operations';
const groupPanels = (groupId: string): PanelId[] =>
  PANEL_GROUPS.find((g) => g.id === groupId)?.panels ?? [];
const visible = (id: PanelId) =>
  !isMobile || (PANEL_TO_GROUP.get(id) ?? '') === activeGroup;
const selectGroup = (groupId: string) => {
  const first = groupPanels(groupId)[0];
  if (first) selectPanel(first);
};
```

Tabbar mobile render `PANEL_GROUPS` thay vì `VISIBLE_TABS`:

```tsx
{PANEL_GROUPS.map((group, index) => (
  <button
    key={group.id}
    ref={(element) => { tabRefs.current[index] = element; }}
    id={`drawer-tab-${group.id}`}
    type="button"
    role="tab"
    aria-controls={group.panels.map((p) => `drawer-panel-${p}`).join(' ')}
    aria-selected={activeGroup === group.id}
    tabIndex={activeGroup === group.id ? 0 : -1}
    className={activeGroup === group.id ? 'active' : ''}
    onClick={() => selectGroup(group.id)}
    onKeyDown={(event) => handleTabKeyDown(event, index)}
  >
    {group.label}
  </button>
))}
```

Arrow-key handler dùng `PANEL_GROUPS.length` thay vì `VISIBLE_TABS.length`, `selectGroup(PANEL_GROUPS[nextIndex].id)`.
`tabRefs` giữ `Array<HTMLButtonElement | null>` — độ dài đổi 8 → 5, type không đổi.
Slot `id="drawer-panel-*"` + `aria-labelledby="drawer-tab-*"` giữ nguyên id panel (không đổi thành group) — test cũ query panel vẫn đúng.
`onSelectSettingsTab={() => selectPanel('settings')}` (dòng ~241) giữ nguyên — panel settings cùng nhóm operations, sau khi nhảy vẫn visible trên mobile vì activeGroup = operations. Không cần sửa FishingPanel.
Desktop: `visible()` trả true khi `!isMobile` — mọi slot hiện như cũ, không đổi DOM.

- [ ] **Step 1: Thay PANEL_TABS → PANEL_GROUPS + logic nhóm**
Sửa `AccountOperationsDrawer.tsx` theo code trên: thêm `PanelGroup` + `PANEL_GROUPS` export + `PANEL_TO_GROUP`; thay `visible`, thêm `selectGroup`; tabbar render groups; arrow-key theo groups.

- [ ] **Step 2: Sửa test accountsRoutes dòng 192–200**
Đọc test hiện tại (tab 'Cài đặt' → `aria-selected true`, tab /Nông trại/…): cập nhật selector sang tab nhóm mới — click `getByRole('tab', { name: 'Vận hành' })` thay vì 'Cài đặt' cho panel settings; click `getByRole('tab', { name: '🎣 Câu cá' })` (giữ nguyên vì group fishing giữ label); thêm assert nhóm 'Nông trại' hiện QuestsPanel. KHÔNG tạo test mới. Nếu test dòng 194 assert `/Nông trại/i` đã tồn tại — giữ, chỉ đổi phần click tab cho khớp nhóm.

- [ ] **Step 3: Verify**
Run: `npm test --prefix avatar-web/web -- accountsRoutes` (Expected: pass)
Run: `npm run build --prefix avatar-web/web` (Expected: pass)
Run: `npm test --prefix avatar-web/web` (Expected: toàn suite pass)

- [ ] **Step 4: Commit**
`git add avatar-web/web/src/accounts/AccountOperationsDrawer.tsx avatar-web/web/src/accounts/accountsRoutes.test.tsx && git commit -m "refactor(web): group drawer tabs 8 into 5"`

---

### Task 6: Polish nút + xóa pulse-glow + AccountCard metric

**Files:**
- Modify: `avatar-web/web/src/styles/components.css` (button padding, xóa pulse-glow, AccountCard metric)
- Modify: `avatar-web/web/src/accounts/AccountCard.tsx` (dòng 73–87: thêm class primary cho metric Xu)

**Interfaces:**
- Consumes: components.css từ Task 1, AccountCard hiện tại
- Produces: visual cuối cho verify mắt thường

CSS (sửa trong components.css):
1. `button { padding: 7px 14px; ... }` → `padding: 9px 14px;` (36px height).
2. Xóa block `.btn-box-claim` animation `pulse-glow` (dòng ~1221): giữ `background: linear-gradient(135deg, #ffd700, #ff9f1c); color: #0d1117;` — xóa dòng `animation: pulse-glow 1.5s infinite alternate;`. Xóa `@keyframes pulse-glow { from... to... }` (dòng ~1224–1227).
3. Thêm sau block `.account-card-stats`:
```css
.account-card-stat--primary b { font-size: 20px; font-weight: 700; }
.account-card-stats > span:not(.account-card-stat--primary) b { font-size: 13px; font-weight: 600; }
```

JSX (`AccountCard.tsx` dòng 73–87): metric Xu đầu tiên `<span>` → `<span className="account-card-stat--primary">`, 3 span còn lại giữ nguyên.

- [ ] **Step 1: Sửa button + xóa pulse-glow**
Trong components.css: padding button 7px → 9px; xóa dòng animation pulse-glow trong `.btn-box-claim`; xóa block `@keyframes pulse-glow`.

- [ ] **Step 2: AccountCard metric chính**
Thêm 2 rules CSS trên; sửa span Xu trong AccountCard.tsx thêm class.

- [ ] **Step 3: Verify**
Run: `npm run build --prefix avatar-web/web` (Expected: pass)
Run: `npm test --prefix avatar-web/web -- AccountCard` (Expected: pass — test query text số liệu, không vỡ vì chỉ thêm class)
Run: `grep -n "pulse-glow" avatar-web/web/src/styles/components.css; echo PULSE_DONE` (Expected: `PULSE_DONE`, không còn match)

- [ ] **Step 4: Commit**
`git add avatar-web/web/src/styles/components.css avatar-web/web/src/accounts/AccountCard.tsx && git commit -m "refactor(web): polish button size, remove pulse, highlight primary metric"`

---

### Task 7: Verify tổng + đồng bộ design system

**Files:**
- Modify: `opendesign/design-systems/avatar-web/tokens/colors_and_type.css` (chỉ khi Task 1–6 sinh token mới — dự kiến KHÔNG đổi; bỏ qua nếu không có)
- Modify: `opendesign/manifest.json` (chỉ khi có file gallery mới — dự kiến KHÔNG đổi)
- Test: không tạo file mới; chạy suite + checklist mắt thường

**Interfaces:**
- Consumes: toàn bộ thay đổi Task 1–6
- Produces: refactor hoàn tất, design system khớp code

- [ ] **Step 1: Verify automated tổng**
Run: `npm run build --prefix avatar-web/web` (Expected: pass)
Run: `npm test --prefix avatar-web/web` (Expected: toàn suite pass)
Run: `grep -rn "style={{" avatar-web/web/src --include="*.tsx" | grep -vc "width:"` (Expected: số nhỏ ≤ 3 — chỉ còn ngoại lệ CookingPanel:230 + emoji font-size)
Run: `detect_changes({scope:"all", repo:"learning-reverse"})` (Expected: risk ≤ medium, không có affected process lạ)

- [ ] **Step 2: Checklist mắt thường 3 màn**
Mở `npm run dev --prefix avatar-web/web`: (1) dashboard — Xu nổi bật, hover card như cũ; (2) drawer mobile (<680px devtools) — 5 nút nhóm, chuyển nhóm giữ state, dirty confirm khi rời nhóm có thay đổi; (3) shop/fishing/cooking — hình dáng khớp trước refactor. Nút claim daily còn gold gradient, không nhấp nháy.

- [ ] **Step 3: Commit cuối (nếu có thay đổi design system)**
Nếu tokens/gallery cần đồng bộ: `git add opendesign && git commit -m "docs(design-system): sync avatar-web tokens after refactor"`. Nếu không có gì đổi — bỏ qua step, không commit rỗng.

---

## Self-Review

**1. Spec coverage:** Mục 2 In-Scope 5 điểm → Task 1 (tách CSS), Task 2–4 (inline), Task 5 (tabs), Task 6 (polish), Task 7 (verify). Out-of-Scope tôn trọng: không CSS Modules, không đổi tên class cũ, không đụng server, không đổi route. Edge pulse/inline động/test-snapshot có task xử lý. Đủ.

**2. Placeholder scan:** Không TODO/TBD; mọi step có code hoặc lệnh + Expected cụ thể; số dòng file tham chiếu thật (FishingPanel:212–520, drawer:20–200, styles.css:1–2186). Ngoại lệ CookingPanel:230 ghi rõ lý do YAGNI + comment. Không "tương tự Task N" — mỗi map viết đầy đủ.

**3. Type consistency:** `PanelGroup`/`PANEL_GROUPS`/`PANEL_TO_GROUP` định nghĩa Task 5 dùng nhất quán trong task; `activePanel: PanelId` giữ nguyên type; `tabRefs` type không đổi; class `.fishing-*`/`.cooking-*`/`.review-*`/`.misc-*` định nghĩa 1 lần, dùng đúng tên ở step thay JSX. `visible()` desktop-branch giữ nguyên semantics.
