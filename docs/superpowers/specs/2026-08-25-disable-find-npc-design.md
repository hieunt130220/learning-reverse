# Tạm đóng chức năng Auto Tìm NPC — Design

## 1. Mục tiêu & Bối cảnh

Chức năng **Tìm NPC** (`find_npc`) cần tạm ngưng hoạt động ở mọi điểm vào (API, bootstrap sau restart, UI) mà không xóa code hay dữ liệu đã làm. Mục tiêu:

- Không ai start được mode `find_npc` mới (API trả lỗi rõ ràng "tạm đóng").
- Sau khi restart server, tài khoản đang `desired_mode='find_npc'` **không** được tự resume.
- Web không hiển thị tab/panel "Tìm NPC".
- **Dễ bật lại**: chỉ cần flip 1 hằng số kill-switch mỗi app (server/web), không phải revert code.

## 2. Phạm vi (Scope)

### In-scope
- Chặn `POST /api/accounts/:id/automation/start` với `mode='find_npc'` → HTTP **503**, code `find-npc-disabled`.
- Bỏ qua entry `find_npc` trong `SessionManager.bootstrap()`, log cảnh báo danh sách account bị bỏ qua.
- ẩn tab + panel "Tìm NPC" trên drawer web (desktop sidebar & mobile tabbar).
- Thêm error code `'find-npc-disabled'` vào `AutomationApiErrorCode`.

### Out-of-scope
- **Không** đổi schema/DB, **không** reset `desired_mode` về `off` — giữ nguyên intent để khi bật lại + restart, account tự resume như cũ.
- **Không** force-stop session `find_npc` đang chạy live: chúng chạy đến khi user bấm Stop hoặc server restart. Endpoint `/automation/stop` giữ nguyên hoạt động.
- **Không** chặn `PUT /automation/find-npc-config/config`: lưu cấu hình vô hại (không chạy gì), UI đã không còn đường vào.
- Không sửa `autoFindNpc.ts`, catalog, probe tools — toàn bộ runner đứng yên phía sau kill-switch.
- Không viết test mới (theo quy định AGENTS.md); chỉ chạy suite hiện có để đảm bảo không vỡ.

## 3. Thiết kế kỹ thuật

### Kill-switch
Mỗi app có một hằng số module-level, đặt tên rõ để tìm lại dễ:

```ts
// avatar-web/server/src/session/featureFlags.ts (file mới)
/** Bật lại Find NPC: đổi thành false rồi deploy/restart. */
export const FIND_NPC_DISABLED = true;
```

Web dùng hằng số local trong chính file drawer (một consumer duy nhất):

```ts
const FIND_NPC_TAB_HIDDEN = true;
```

### 3.1 Server — chặn API start
**File:** `avatar-web/server/src/session/routes.ts`

Trong `POST /:id/automation/start`, ngay sau validate body và **trước** `serializeAutomation` (chưa đụng DB nên không cần serialize):

```ts
if (mode === 'find_npc' && FIND_NPC_DISABLED) {
  automationError(res, 503, 'find-npc-disabled', 'Tính năng Tìm NPC đang tạm đóng');
  return;
}
```

**File:** `avatar-web/server/src/session/automationTypes.ts` — thêm vào union:

```ts
export type AutomationApiErrorCode =
  ...
  | 'find-npc-disabled';
```

503 Service Unavailable thể hiện đúng ngữ nghĩa "tạm thời không khả dụng", phân biệt với 400 (payload sai) và 409 (xung đột trạng thái).

### 3.2 Server — bỏ qua bootstrap
**File:** `avatar-web/server/src/session/manager.ts` (`bootstrap()`)

Filter tại call-site (không đổi `listDesiredAutomation` — repo giữ semantics gốc):

```ts
const entries = listDesiredAutomation(this.deps.db)
  .filter((entry) => !(FIND_NPC_DISABLED && entry.intent.desiredMode === 'find_npc'));
if (entries.length === 0) return;

if (FIND_NPC_DISABLED) {
  const skipped = listDesiredAutomation(this.deps.db).filter((e) => e.intent.desiredMode === 'find_npc');
  if (skipped.length > 0) {
    console.warn(`bootstrap bỏ qua find_npc (tạm đóng): #${skipped.map((e) => e.accountId).join(', #')}`);
  }
}
```

(Gộp 2 lần gọi list thành 1 lần đọc rồi tách mảng khi implement thực tế.)

Hệ quả chấp nhận được: `desired_mode` các account này vẫn `find_npc` trong DB → snapshot GET /automation hiển thị desired `find_npc` nhưng không bao giờ active; panel web đã ẩn nên user không thấy trạng thái gây hiểu lầm.

### 3.3 Web — ẩn tab & panel
**File:** `avatar-web/web/src/accounts/AccountOperationsDrawer.tsx`

- Giữ nguyên `PANEL_TABS` (type `PanelId` còn dùng cho logic khác), filter lúc render tabbar:

```ts
const VISIBLE_TABS = PANEL_TABS.filter(([id]) => !(id === 'find_npc' && FIND_NPC_TAB_HIDDEN));
```

Tabbar map qua `VISIBLE_TABS`; keyboard arrow-nav cũng dùng `VISIBLE_TABS` để index khớp.

- Panel slot `drawer-panel-find_npc` bọc điều kiện `{!FIND_NPC_TAB_HIDDEN && (...)}` → `FindNpcPanel` không mount, không fetch config, không set dirty.
- Wiring `dirtySources.findNpc` / `onFindNpcDirtyChange` giữ nguyên (panel không mount thì cờ không bao giờ true) — diff tối thiểu, bật lại chỉ cần flip flag.
- `FindNpcPanel.tsx` không sửa.

### 3.4 Files/modules liên quan

| File | Vai trò |
|---|---|
| `avatar-web/server/src/session/featureFlags.ts` (mới) | Kill-switch server |
| `avatar-web/server/src/session/routes.ts` | Chặn start find_npc |
| `avatar-web/server/src/session/automationTypes.ts` | Thêm error code |
| `avatar-web/server/src/session/manager.ts` | Bootstrap skip find_npc |
| `avatar-web/web/src/accounts/AccountOperationsDrawer.tsx` | ẩn tab + panel |

## 4. Verification Plan

Sau khi implement (server):

```bash
cd avatar-web/server && npm run typecheck && npm test
cd avatar-web/web && npx tsc -b --noEmit && npm test
```

Thủ công:
1. `curl -X POST .../automation/start -d '{"mode":"find_npc"}'` → 503 `{code:'find-npc-disabled'}`; DB `desired_mode` không đổi.
2. `{"mode":"auto_farm"}` vẫn hoạt động bình thường.
3. Đặt `desired_mode='find_npc'` cho 1 account → restart server → account **không** connect, log warn xuất hiện, auto_farm khác vẫn bootstrap.
4. Web: tab "Tìm NPC" biến mất khỏi drawer; tab khác vẫn chuyển bình thường (cả mobile tabbar).
5. Account đang chạy find_npc live: bấm Stop vẫn thành công.
