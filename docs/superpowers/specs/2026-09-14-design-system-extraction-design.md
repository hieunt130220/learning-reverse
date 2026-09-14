# Design System Extraction — avatar-web — Design Spec

## Mục tiêu & Bối cảnh

**Vấn đề:** `avatar-web/web` (React 18 + Vite, 57 files trong `src/`) có visual language nhất quán nhưng chưa được tài liệu hóa. Toàn bộ token nằm rải rác trong 1 file `src/styles.css` (~2187 dòng, 24 CSS vars), cộng ~128 khối `style={{...}}` inline trong 13 file `.tsx` và các mã màu hardcode (`#ffd700`, `#21262d`, `#d2a8ff`, …). Agent/dev mới không có nguồn tham chiếu duy nhất → dễ tạo màu/component lệch.

**Mục tiêu:** Extract faithful + tidy hệ visual hiện tại thành design system portable dưới `./opendesign/design-systems/avatar-web/` gồm tokens CSS + `SKILL.md` + gallery preview, để dev team/agents tái sử dụng nhất quán. Không redesign, chỉ hợp nhất outliers nhỏ vào token.

**Nguồn đã scan (2026-09-14):**
- `avatar-web/web/src/styles.css` — 24 vars `:root`, dark theme duy nhất, cool temperature
- `avatar-web/web/src/**/*.tsx` — các panel: Quests, Shop, AutoSell, TreePlan, Settings, Status, Fishing, Assets, AccountCard/Dashboard/Drawer, Auth
- Hardcode đáng chú ý: `#ffd700` (quest gold), `#21262d` (tab active), `#d2a8ff` (opname log), `#ffbc76` (skip cell), `#58a6ff/#3fb950` (debug/fishing inline)

## Phạm vi (Scope)

### In-Scope
1. **Tokens:** colors (bg/card/line/fg/accent/ok/warn/err + dim/line variants), type scale (12–20px, system-ui + mono), spacing/radius (6/8/10/12px, pill 999px), shadow, breakpoints (680px, 1100px), motion (160–300ms, reduced-motion).
2. **Components (mid-fidelity):** button (+ghost/active/disabled), tabs, badge (5 states), status-banner (4), mode-chip, card, dialog modal/drawer, table→card responsive, tree-plan grid, quests mission card + daily meter, shop transaction, log viewer.
3. **Artifacts:** `tokens/colors_and_type.css`, `SKILL.md`, `preview.html` gallery, `manifest.json` rebuild, `index.html` (qua `setup-opendesign`).
4. **Tidy tối thiểu:** map outliers về token (`--gold: #ffd700`, `--tab-active: #21262d`, `--log-op: #d2a8ff`, `--skip: #ffbc76`); ghi nhận chứ không xóa code nguồn.

### Out-of-Scope
- Không sửa `styles.css` hay `.tsx` nguồn (extraction chỉ đọc).
- Không light theme, không font mới (giữ system-ui = brand hiện tại).
- Không sprite/game-canvas art trong APK/jar (chỉ web UI).
- Không đưa `.venv`/pip rich themes vào system.

### Input / Output
- Input: `avatar-web/web/src/styles.css`, `avatar-web/web/src/**/*.tsx`, `package.json` (React 18.3.1, Vite 6).
- Output: `./opendesign/design-systems/avatar-web/{SKILL.md, tokens/colors_and_type.css, preview.html}` + `./opendesign/index.html` + `./opendesign/manifest.json`.

### Edge Cases
- Inline styles mâu thuẫn với CSS var → ưu tiên CSS var, liệt kê conflict vào SKILL.md "Known drifts".
- Dark-only: không suy diễn light palette; ghi rõ `color-scheme: dark`.
- `dist/` build CSS bỏ qua (artifact biên dịch).
- Nếu `setup-opendesign` chưa chạy (chưa có `index.html`) → chạy trước khi build gallery.

## Thiết kế kiến trúc & Giải pháp kỹ thuật

### Files / Modules liên quan

| File | Vai trò |
|---|---|
| `avatar-web/web/src/styles.css:1-24` | Nguồn token `:root` (24 vars) → trích nguyên văn |
| `avatar-web/web/src/styles.css:91-96,136-167` | Card + button/ghost → component spec |
| `avatar-web/web/src/styles.css:210-296,427-509` | Tabs, badge, status-banner, mode-chip |
| `avatar-web/web/src/styles.css:654-739,1563-1804` | Dialog modal/drawer, shop panel/table |
| `avatar-web/web/src/styles.css:991-1375,1809-2094` | QuestsPanel, auto-sell editor, tree-plan grid |
| `avatar-web/web/src/styles.css:2042-2139` | Responsive (680/1100px, pointer:coarse 40px) + reduced-motion |
| `avatar-web/web/src/**/*.tsx` (13 files, 128 inline) | Đối chiếu drift, không sửa |
| `./opendesign/design-systems/avatar-web/` | **(Mới)** output system |
| `./opendesign/index.html` + `manifest.json` | **(Mới)** shell preview + index |

### Interfaces & Data Contracts

Tokens chuẩn (trích nguyên văn + 4 tidy additions):

```css
:root {
  --bg: #10131a; --bg-raised: #0d1017; --bg-deep: #0a0d12;
  --card: #171b24; --card-muted: #161b22; --card-inset: #111722;
  --line: #262c38; --line-soft: #1e2430;
  --fg: #e5e9f0; --muted: #8b93a7;
  --accent: #6ea8fe; --accent-dim: rgba(110,168,254,.1);
  --ok: #4ec9a0; --ok-dim: rgba(78,201,160,.12); --ok-line: #347d68;
  --warn: #e3b341; --warn-ink: #e4bb61; --warn-dim: rgba(227,179,65,.08); --warn-line: #665122;
  --err: #ff7b72; --err-dim: rgba(255,123,114,.08); --err-line: #8f4745;
  /* tidy additions (hiện hardcode): */
  --gold: #ffd700; --tab-active: #21262d; --log-op: #d2a8ff; --skip: #ffbc76;
  --radius-sm: 6px; --radius-md: 8px; --radius-lg: 10px; --radius-xl: 12px;
  color-scheme: dark;
}
```

Type: base `14px/1.5 system-ui`; h1 20px/700; h2 14px uppercase ls .06em muted; label 13px; mono `ui-monospace` cho log/hex/chip. Touch target ≥40px (`pointer:coarse`).

`SKILL.md` contract: sections Tokens / Type / Components (mỗi component: class nguồn + anatomy + states + dos/donts) / Responsive / Known drifts. Gallery `preview.html`: 1 file, toggle sections, close mọi tag, quote kép.

### Flow xử lý

```
Scan styles.css + tsx drift
  → setup-opendesign (nếu thiếu index.html)
  → create-design-system (import from codebase, faithful+tidy)
  → tokens/colors_and_type.css + SKILL.md + preview.html
  → rebuild manifest.json (full scan mockups + design-systems)
  → run-opendesign preview link
  → verifier subagent check vs spec
```

Diagram: source (`styles.css` vars + panel classes) → extractor → `avatar-web/` system → consumer (agents/dev via SKILL.md).

## Verification Plan

1. **Manual:** mở preview link từ `run-opendesign`; đối chiếu 5 nhóm (button, badge, banner, card, table-mobile) với web thật ở `npm run dev --prefix avatar-web/web`; màu hex khớp 100% với `:root`.
2. **Automated:** `ls ./opendesign/design-systems/avatar-web/{SKILL.md,tokens/colors_and_type.css}` tồn tại; `python3 -c "import json; json.load(open('./opendesign/manifest.json'))"` pass; `grep -c "var(--" preview.html` > 20 (dùng token, không hardcode tràn lan).
3. **GitNexus:** extraction chỉ thêm file mới dưới `./opendesign/` + `docs/` → không sửa symbol hiện hữu nên miễn `impact`; trước commit chạy `detect_changes({scope:"all"})`.
4. **Gate:** Không placebo — verifier mở gallery ở context sạch, fail nếu thiếu token nào trong 24 vars gốc.
