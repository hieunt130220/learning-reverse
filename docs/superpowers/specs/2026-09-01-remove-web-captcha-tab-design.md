# Bỏ Tab Captcha Trên Web — Design Document

> **Spec:** `docs/superpowers/specs/2026-09-01-remove-web-captcha-tab-design.md`
> **Feature:** Remove Captcha tab from the account operations web drawer
> **Date:** 2026-09-01

## 1. Mục tiêu & Bối cảnh

### Bối cảnh

Tab **Captcha** đang hiển thị trong drawer vận hành tài khoản của web UI. Tab này render `CaptchaPanel`, component kết nối `/api/captcha/list` và WebSocket để xem, tải và preview ảnh CAPTCHA. User yêu cầu bỏ tab này trên web.

### Mục tiêu

Loại bỏ tab CAPTCHA và nội dung `CaptchaPanel` khỏi UI vận hành tài khoản, đồng thời giữ nguyên backend thu thập CAPTCHA và API hiện có.

## 2. Phạm vi (Scope)

### In-scope

- Xóa `['captcha', 'Captcha']` khỏi `PANEL_TABS` trong `AccountOperationsDrawer`.
- Xóa import `CaptchaPanel`.
- Xóa block render `drawer-panel-captcha` cùng `CaptchaPanel`.
- Giữ thứ tự tab còn lại: **Trạng thái → Tự động → Nhiệm vụ → Nấu ăn → Tài sản → Sạp → Log**.
- Đảm bảo navigation bằng chuột và arrow keys không truy cập được tab CAPTCHA.

### Out-of-scope

- Không xóa hoặc sửa `avatar-web/web/src/accounts/panels/CaptchaPanel.tsx`.
- Không thay đổi `/api/captcha/list`, `/api/captcha/dataset/:fileName`, solver proxy hoặc WebSocket event `captcha`.
- Không thay đổi `captchaPassiveSaver`, `captchaRoute`, `captchaSolverProxy`, `captchaProtocol`.
- Không làm gián đoạn việc server tự động lưu CAPTCHA vào dataset.
- Không tạo test file mới vì user không yêu cầu viết test.

### Input / Output

| Loại | Nội dung |
|---|---|
| Input UI | `PANEL_TABS`, `VISIBLE_TABS`, danh sách panel trong `LoadedOperations` |
| Output UI | Tab CAPTCHA biến mất khỏi drawer và không còn invoke API/WS từ panel |
| Input backend | Không đổi |
| Output backend | Không đổi |

### Edge cases

- **Mobile:** `VISIBLE_TABS` không chứa `captcha`, tab không xuất hiện trong tabbar; chuyển tab bằng arrow keys bỏ qua CAPTCHA.
- **Desktop:** block `CaptchaPanel` không render; các panel còn lại giữ vị trí hiện tại.
- **Keyboard:** `handleTabKeyDown` hoạt động trên `VISIBLE_TABS` mới, không có index trỏ tới panel đã xóa.
- **WebSocket:** event `captcha` vẫn được server phát, nhưng web không còn đăng ký subscriber từ `CaptchaPanel`.
- **API trực tiếp:** người dùng vẫn có thể truy cập các CAPTCHA API nếu đã có quyền; hành vi này nằm ngoài phạm vi UI.

## 3. Thiết kế kiến trúc & Giải pháp kỹ thuật

### Files/modules liên quan

| File/module | Vai trò hiện tại | Thay đổi |
|---|---|---|
| `avatar-web/web/src/accounts/AccountOperationsDrawer.tsx` | Khai báo tab, điều hướng keyboard, render các panel vận hành | Remove import/tab declaration/render block |
| `avatar-web/web/src/accounts/panels/CaptchaPanel.tsx` | Component UI CAPTCHA | Không thay đổi, tạm giữ để thuận tiện bật lại |
| `avatar-web/server/src/game/captchaRoute.ts` | REST API dataset CAPTCHA | Không thay đổi |
| `avatar-web/server/src/game/captchaPassiveSaver.ts` | Lưu CAPTCHA từ session/game | Không thay đổi |

### UI flow sau thay đổi

```text
AccountOperationsDrawer
  → PANEL_TABS (không còn captcha)
    → VISIBLE_TABS
      → mobile tabbar: Status, Autofarm, Quests, Cooking, Assets, Shop, Logs
      → keyboard navigation: cùng danh sách trên
  → drawer-panels
    → render StatusPanel, AutoFarmPanel, QuestsPanel, CookingPanel, AssetsPanel, ShopPanel, LogPanel
    → không render CaptchaPanel
```

### Giải pháp kỹ thuật

1. Xóa dòng `import { CaptchaPanel } from './panels/CaptchaPanel.js';`.
2. Xóa dòng `['captcha', 'Captcha'],` trong `PANEL_TABS`.
3. Xóa block:

```tsx
<div id="drawer-panel-captcha" className="drawer-panel-slot" role={isMobile ? 'tabpanel' : undefined} aria-labelledby={isMobile ? 'drawer-tab-captcha' : undefined} hidden={!visible('captcha')}>
  <CaptchaPanel accountId={account.id} />
</div>
```

Giải pháp này giữ `CaptchaPanel` và backend ở trạng thái nguyên vẹn. Nếu sau này cần hiển thị lại, chỉ cần thêm lại khai báo tab, import và render block.

## 4. Phân tích ảnh hưởng (GitNexus)

Kết quả GitNexus impact trước khi thiết kế thay đổi:

| Target | Risk | Ảnh hưởng chính |
|---|---|---|
| `AccountOperationsDrawer` | **LOW** | Upstream: `App`, sau đó `main.tsx`; module `Accounts` |
| `CaptchaPanel` | **LOW** | Direct caller: `LoadedOperations`; không ảnh hưởng process backend |

Kết luận: thay đổi UI-only có blast radius thấp và không làm mất đường thu thập CAPTCHA phía server.

## 5. Verification Plan

### Automated

Run từ `avatar-web/web`:

```bash
pnpm build
```

Expected: TypeScript compile và Vite build thành công, không còn reference `drawer-tab-captcha`, `drawer-panel-captcha` hay `CaptchaPanel` trong bundle drawer.

Run từ `avatar-web/web`:

```bash
pnpm test -- --run
```

Expected: test suite web hiện tại vẫn pass; không cần thêm test mới.

### Manual

1. Mở drawer vận hành một tài khoản.
2. Kiểm tra danh sách tab trên mobile: không có **Captcha**.
3. Nhấn `ArrowLeft`/`ArrowRight`: focus chuyển tuần tự qua các tab còn lại, không dừng ở CAPTCHA.
4. Chọn **Log**: nội dung Log hiển thị đúng; không có panel CAPTCHA.
5. Nếu server phát CAPTCHA, kiểm tra `server/captcha-dataset/` vẫn lưu file bình thường.

## 6. Review Gate

Spec này cần được user duyệt trước khi tạo implementation plan và trước khi sửa production code.
