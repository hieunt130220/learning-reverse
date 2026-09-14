# Refactor Thiết kế Web avatar-web — Design Spec

## 1. Mục tiêu & Bối cảnh

**Bối cảnh:** Web UI `avatar-web/web` (React 18 + Vite, dark-only) có token 24 vars nhất quán nhưng:
1. Toàn bộ CSS nằm trong 1 file global `src/styles.css` 2186 dòng — sửa 1 panel dễ vỡ panel khác do dùng chung namespace.
2. 128 khối `style={{...}}` inline rải trong 13 file `.tsx`, hotspot: FishingPanel (48), FishingSettingsPanel (30), CookingPanel (21) — hardcode `#58a6ff`, `#3fb950`, `#ffd700`… lệch khỏi token.
3. Drawer vận hành nhồi 8 tabs phẳng (Trạng thái, Cài đặt, Câu cá, Nhiệm vụ, Nấu ăn, Tài sản, Sạp, Log) — quá tải nhận thức.
4. Visual nhỏ: nút base 7px 14px thấp hơn chuẩn chạm, `pulse-glow` vô hạn gây xao nhãng, AccountCard dàn 4 metric đều nhau — mắt không có điểm tựa.

**Mục tiêu:** Tách CSS 3 file, dọn inline về token/class, gom tabs 8 → 5 nhóm, polish nhẹ. Không đổi màu, không đổi hình dáng ngoài 4 điểm polish nêu rõ.

**Đã duyệt (chat 2026-09-14):** Hướng A (3 file static import); phạm vi cả 3 việc trong 1 spec; 5 nhóm tabs Vận hành/Farm/Câu cá/Tài sản/Log; 3 fix + polish nhẹ.

## 2. Phạm vi (Scope)

### In-Scope
1. **Tách CSS:** `src/styles.css` → `src/styles/tokens.css`, `src/styles/base.css`, `src/styles/components.css`. Hex giữ nguyên 100%, chỉ di chuyển. Xóa file cũ.
2. **Dọn inline:** 128 khối `style={{}}` → class trong components.css hoặc `var(--*)`. Hình dáng không đổi.
3. **Gom tabs:** `PANEL_TABS` 8 mục phẳng → 5 nhóm. Mobile tabbar 5 nút; desktop tất cả panel hiện như cũ. Cơ chế hidden/aria/dirty-guard giữ nguyên.
4. **Polish:** nút base `7px 14px` → `9px 14px`; xóa `pulse-glow` + `@keyframes` (dòng 1221–1227 styles.css); AccountCard metric Xu nổi bật 20px/700, 3 metric còn lại 13px.
5. **Verify:** build + test + GitNexus detect_changes + mắt thường 3 màn.

### Out-of-Scope
- Không CSS Modules, không đổi tên class hiện hữu (tránh vỡ test/grep).
- Không đổi màu/hex mới, không light theme, không font mới.
- Không đụng logic server (`avatar-web/server`).
- Không đổi route/IA (drawer vẫn là `/accounts/:id`).

### Edge Cases
- `pulse-glow` bị xóa: nút claim vẫn có màu gold gradient, chỉ mất hiệu ứng nhấp nháy — chấp nhận.
- Desktop (≥680px) hiện tại mọi panel cùng lúc (`hidden` slot): giữ nguyên — chỉ tabbar mobile đổi từ 8 → 5 nút.
- Inline style có giá trị động (width %, màu theo state): thay bằng CSS var cục bộ `style={{ '--x': value }}` hoặc class state, không nhét lại chuỗi hex.
- Test snapshot nếu có raw `style` assertion → sửa test theo output mới, không khôi phục inline.

## 3. Thiết kế Kiến trúc & Giải pháp Kỹ thuật

### 3.1 Files & vai trò

| File | Thay đổi |
|---|---|
| `avatar-web/web/src/styles/tokens.css` | **(Mới)** `:root` 24 vars + tidy adds + radii + `color-scheme: dark` |
| `avatar-web/web/src/styles/base.css` | **(Mới)** reset, body, h1/h2, input/select/textarea, breakpoints 680/1100, reduced-motion |
| `avatar-web/web/src/styles/components.css` | **(Mới)** mọi class component theo block comment sẵn có + class mới cho inline cũ |
| `avatar-web/web/src/styles.css` | **Xóa** |
| `avatar-web/web/src/main.tsx:6` | `import './styles.css'` → 3 import theo thứ tự tokens → base → components |
| `avatar-web/web/src/accounts/AccountOperationsDrawer.tsx:20-37,178-200` | `PANEL_TABS` → `PANEL_GROUPS`; tabbar mobile render 5 nhóm; logic visible/slot theo nhóm |
| `avatar-web/web/src/accounts/panels/FishingPanel.tsx` | 48 inline → class/var |
| `avatar-web/web/src/accounts/panels/FishingSettingsPanel.tsx` | 30 inline → class/var |
| `avatar-web/web/src/accounts/panels/CookingPanel.tsx` | 21 inline → class/var |
| 10 file inline còn lại (1–7 khối/file) | Dọn tương tự |
| `avatar-web/web/src/accounts/AccountCard.tsx:73-87` | Metric Xu class riêng `account-card-stat--primary` |
| `avatar-web/web/src/styles/components.css` (AccountCard block) | `.account-card-stat--primary b { font-size: 20px; font-weight: 700; }`, 3 metric còn lại 13px; nút base padding 9px 14px; xóa pulse-glow |

### 3.2 Cấu trúc 5 nhóm tabs

```
PANEL_GROUPS = [
  { id: 'operations', label: 'Vận hành', panels: ['status', 'settings'] },
  { id: 'farm',       label: 'Nông trại', panels: ['quests', 'cooking'] },
  { id: 'fishing',    label: 'Câu cá',   panels: ['fishing'] },
  { id: 'assets',     label: 'Tài sản',  panels: ['assets', 'shop'] },
  { id: 'logs',       label: 'Log',      panels: ['logs'] },
]
```

- State `activePanel: PanelId` giữ nguyên; chọn nhóm = active panel đầu tiên của nhóm.
- Mobile: tabbar render 5 nút nhóm, `aria-selected` theo nhóm active.
- Desktop ≥680px: tất cả slot hiện như cũ (`visible()` trả true khi !isMobile), không nhóm hóa DOM.
- Dirty-guard: khi rời nhóm có panel dirty (farm/findNpc/fishing) → confirm như cũ. Nguồn dirty map theo panel id, không đổi.
- `find_npc` vẫn ẩn (FIND_NPC_TAB_HIDDEN) — không đưa vào nhóm nào hiện hành.

### 3.3 Phân loại inline → đích

| Loại inline | Đích |
|---|---|
| Màu hardcode (#58a6ff, #3fb950, #ffd700…) | `var(--accent)`, `var(--ok)`, `var(--gold)`… |
| Kích thước/spacing lặp lại → class mới trong components.css, tiền tố theo panel (`fishing-status-*`, `cooking-*`) |
| Giá trị động (progress %, màu theo state) | CSS var cục bộ qua `style={{ ['--progress' as string]: pct }}` + class |
| `rgba(255,0,0,.08)` debug | `var(--err-dim)` |

### 3.4 Flow

```
[Task 1] tách CSS → main.tsx import 3 file → build pass → commit
[Task 2] dọn inline theo hotspot giảm dần (Fishing → FishingSettings → Cooking → còn lại)
         → mỗi panel: build + test → commit theo cụm
[Task 3] PANEL_GROUPS + tabbar 5 nút + dirty-guard theo nhóm → build + test → commit
[Task 4] polish nút/pulse/AccountCard → build + test → commit
[Task 5] verify tổng: build, test, detect_changes, mắt thường 3 màn
```

Mỗi task chạy `gitnexus_impact` trên symbol sửa trước khi edit, `detect_changes` trước commit.

## 4. Verification Plan

### 4.1 Automated
- `npm run build --prefix avatar-web/web` — TS + Vite pass, không lỗi import CSS.
- `npm test --prefix avatar-web/web` — toàn bộ suite pass (57 file src, test hiện hữu giữ nguyên trừ assertion style bị ảnh hưởng).
- `gitnexus detect_changes scope=all` trước mỗi commit — chỉ thấy thay đổi dự kiến.
- Grep kiểm chứng: `grep -rc "style={{" web/src` giảm từ 128 về ~0 (trừ CSS var cục bộ hợp lệ); `grep "#58a6ff\|#3fb950\|#ffd700" web/src` về 0 trong tsx.

### 4.2 Manual
1. Dashboard: card tài khoản — Xu nổi bật hơn 3 metric còn lại; hover/focus card như cũ.
2. Drawer mobile (<680px): 5 nút nhóm, chuyển nhóm giữ state, cảnh báo dirty khi rời nhóm có thay đổi.
3. Drawer desktop: mọi panel hiện như cũ.
4. Shop/Fishing/Cooking panel: hình dáng khớp trước/sau (mắt thường, so screenshot).
5. Nút claim daily: còn gold gradient, không nhấp nháy.

### 4.3 GitNexus
- `impact` upstream trên `PANEL_GROUPS`, `AccountCard`, các panel sửa inline trước khi edit; báo risk nếu HIGH/CRITICAL.
- `detect_changes({scope:"all"})` trước mỗi commit.
