# Design System Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract hệ visual của `avatar-web/web` thành design system portable dưới `./opendesign/design-systems/avatar-web/`.

**Architecture:** Đọc `styles.css` (24 vars) + drift inline trong 13 file `.tsx`, trích nguyên văn token ra `tokens/colors_and_type.css`, tài liệu hóa components vào `SKILL.md`, dựng gallery `preview.html` dùng đúng token, rebuild `manifest.json` bằng full scan.

**Tech Stack:** HTML/CSS single-file gallery, CSS custom properties, React 18 source (read-only), opendesign skills (`setup-opendesign`, `create-design-system`, `run-opendesign`).

**Spec:** `docs/superpowers/specs/2026-09-14-design-system-extraction-design.md`

## Global Constraints
- Chỉ TẠO file mới dưới `./opendesign/` — TUYỆT ĐỐI không sửa `avatar-web/web/src/*`.
- Hex fidelity 100%: 24 vars `:root` copy nguyên văn từ `styles.css:1-24`.
- Dark-only: giữ `color-scheme: dark`, không suy diễn light palette, không font mới (giữ system-ui + ui-monospace).
- `preview.html`: close mọi non-void tag, double-quote mọi attribute, 1 file duy nhất.
- `manifest.json`: rebuild từ full scan (không append), đúng schema trong skill `opendesign`.
- Trước mỗi commit chạy `detect_changes({scope:"all"})`; miễn `impact` vì không sửa symbol hiện hữu.
- Không tạo test files (project: no-TDD).

### Task 1: Dựng shell opendesign

**Files:**
- Create: `opendesign/index.html` (via skill, không viết tay)
- Modify: none
- Test: none

**Interfaces:**
- Consumes: none
- Produces: shell `opendesign/index.html` cho Task 3 trỏ gallery vào

- [ ] **Step 1: Kiểm tra shell đã tồn tại chưa**
Run: `ls ./opendesign/index.html 2>&1 || echo MISSING`
Expected: `MISSING` → sang Step 2; file tồn tại → tick hết Task 1, sang Task 2.

- [ ] **Step 2: Invoke setup-opendesign**
Gọi Skill tool với `skill: "opendesign:setup-opendesign"`, args rỗng. Để subagent của skill tạo `index.html`. Không viết tay, không sửa output của skill.

- [ ] **Step 3: Commit**
Run: `git status --short` (Expected: chỉ thấy `opendesign/index.html` untracked)
`git add opendesign/index.html && git commit -m "chore(opendesign): setup preview shell"`

### Task 2: Extract tokens + SKILL.md

**Files:**
- Create: `opendesign/design-systems/avatar-web/tokens/colors_and_type.css`
- Create: `opendesign/design-systems/avatar-web/SKILL.md`
- Modify: none
- Test: none

**Interfaces:**
- Consumes: shell từ Task 1 (để biết gallery sẽ nhúng vào đâu)
- Produces: `tokens/colors_and_type.css` + `SKILL.md` cho Task 3 dựng gallery

- [ ] **Step 1: Invoke create-design-system (import from codebase)**
Gọi Skill tool với `skill: "opendesign:create-design-system"`, args mô tả: `Import from avatar-web/web/src/styles.css (24 :root vars, dark cool theme) + 13 tsx drift files; target dir opendesign/design-systems/avatar-web; faithful+tidy; tidy adds --gold #ffd700, --tab-active #21262d, --log-op #d2a8ff, --skip #ffbc76`. Để skill sinh tokens + SKILL.md.

- [ ] **Step 2: Verify tokens khớp nguồn 100%**
Run: `diff <(sed -n '1,24p' avatar-web/web/src/styles.css) <(sed -n '1,24p' opendesign/design-systems/avatar-web/tokens/colors_and_type.css) && echo TOKENS_OK`
Expected: `TOKENS_OK` (24 dòng `:root` gốc giữ nguyên thứ tự/giá trị; 4 tidy vars + radius nằm sau dòng 24).
Run thêm: `grep -c '^  --' opendesign/design-systems/avatar-web/tokens/colors_and_type.css`
Expected: số ≥ 28 (24 gốc + 4 tidy trở lên).

- [ ] **Step 3: Verify SKILL.md đủ sections**
Run: `grep -E '^## ' opendesign/design-systems/avatar-web/SKILL.md`
Expected: thấy tối thiểu `Tokens`, `Type`, `Components`, `Responsive`, `Known drifts` (tên heading có thể khác chữ hoa/thường nhưng đủ 5 nhóm nội dung).

- [ ] **Step 4: Commit**
Run: `git status --short` (Expected: chỉ 2 file mới dưới `opendesign/design-systems/avatar-web/`)
`git add opendesign/design-systems/avatar-web && git commit -m "feat(design-system): extract avatar-web tokens and SKILL.md"`

### Task 3: Gallery preview + manifest + verify

**Files:**
- Create: `opendesign/design-systems/avatar-web/preview.html`
- Create/Modify: `opendesign/manifest.json` (rebuild full scan)
- Modify: none khác
- Test: none (verify bằng lệnh shell ở Step 3)

**Interfaces:**
- Consumes: tokens + SKILL.md từ Task 2, shell từ Task 1
- Produces: gallery link qua `run-opendesign`, manifest hợp lệ

- [ ] **Step 1: Viết preview.html (1 file, sections toggle)**
Viết gallery duy nhất tại `opendesign/design-systems/avatar-web/preview.html`, `<link>` tới `tokens/colors_and_type.css`, các sections: Buttons / Tabs / Badges / Status banners / Mode chips / Card + Dialog / Table→card / Tree-plan grid / Quests mission + daily meter / Log viewer. Mỗi swatch dùng `var(--*)`, không hardcode hex ngoài legend text. Mở đầu file có `<title>Avatar Web Design System</title>`.

- [ ] **Step 2: Rebuild manifest.json bằng full scan**
Run: `ls ./opendesign/mockups/*/ 2>/dev/null; ls ./opendesign/design-systems/*/ 2>/dev/null` rồi viết lại `./opendesign/manifest.json` từ kết quả scan thật theo schema `{generated, sections:[{id:"mockups"|"design-systems", label, groups:[{slug, files:[{label, path}]}]}]}`, bỏ group rỗng. Không append manifest cũ.

- [ ] **Step 3: Verify**
Run: `python3 -c "import json; json.load(open('./opendesign/manifest.json'))" && echo MANIFEST_OK`
Expected: `MANIFEST_OK`.
Run: `grep -c "var(--" opendesign/design-systems/avatar-web/preview.html`
Expected: số > 20.
Run: `detect_changes({scope:"all"})` (MCP hoặc CLI fallback `node .gitnexus/run.cjs detect-changes --scope all --repo .`)
Expected: chỉ liệt kê file mới dưới `opendesign/`, không có sửa đổi `avatar-web/`.

- [ ] **Step 4: Invoke run-opendesign lấy preview link**
Gọi Skill tool với `skill: "opendesign:run-opendesign"`. Lấy link server preview gallery, mở kiểm tra 5 nhóm (button, badge, banner, card, table-mobile) khớp màu web thật.

- [ ] **Step 5: Commit**
`git add opendesign && git commit -m "feat(design-system): add avatar-web gallery preview and manifest"`
