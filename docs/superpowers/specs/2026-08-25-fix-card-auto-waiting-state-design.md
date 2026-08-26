# Fix: Card tài khoản hiển thị "đang chờ" dù đã tắt auto — Spec thiết kế

Ngày: 2026-08-25

## 1. Mục tiêu & Bối cảnh

### Hiện tượng
- Người dùng bấm **"Dừng tự động"**. Panel Vận hành hiển thị đúng: `desired=off · active=off · chăm farm đang tắt`.
- Nhưng card tài khoản ở dashboard vẫn hiển thị **Tự động: "đang chờ"** thay vì "đang tắt".

### Nguyên nhân gốc (đã trace code)
Hai nơi đọc **hai cờ trạng thái khác nhau**:

1. **Panel Vận hành** dùng automation snapshot: `desiredMode` / `activeMode` — được cập nhật đúng về `off` khi stop.
2. **Card dashboard** (`avatar-web/web/src/accounts/AccountCard.tsx:24,67`) dùng cờ legacy:
   ```ts
   const autoWanted = runtime?.desiredConnected ?? account.autoEnabled;
   // autoWanted ? 'đang chờ' : 'đang tắt'
   ```
   `desiredConnected` chính là `this.wanted` trong `AvatarSession` (server).

Lỗi nằm ở server: `this.wanted` được bật `true` khi bắt đầu automation (`beginAutomationConnection` → `setWanted(true)`, `avatar-web/server/src/session/avatarSession.ts:938`) nhưng **không bao giờ bị tắt** khi dừng automation:

- `POST /:id/automation/stop` → `stopAutomation()` → `switchAutomationMode({ desiredMode: 'off' })` (`avatarSession.ts:330-336`)
- Nhánh `off` trong `switchAutomationMode` (`avatarSession.ts:365-370`) chỉ set `desiredMode='off'`, `activeMode='off'`, `transitionState='stable'` rồi return — **không gọi `setWanted(false)`**, cũng không ngắt kết nối game.

Hệ quả: `snapshot().desiredConnected` vẫn `true` mãi → card hiển thị "đang chờ" vĩnh viễn sau khi đã tắt auto.

Lỗi thứ hai (phòng thủ phía web): card dùng cờ legacy thay vì automation snapshot — không nhất quán với `autoActive` của StatusPanel (`StatusPanel.tsx:36-40`).

## 2. Phạm vi (Scope)

### In-scope
1. **Server** — `AvatarSession.switchAutomationMode` (`avatar-web/server/src/session/avatarSession.ts`):
   - Nhánh dừng chủ động (`intent.desiredMode === 'off'`, dòng 366-370): gọi thêm `this.setWanted(false)` để `desiredConnected` phản ánh đúng "không còn ý muốn giữ phiên tự động".
   - Nhánh lỗi khởi tạo (`catch` → `start-failed`, dòng 413-417, nơi `this.desiredMode = 'off'`): cũng gọi `this.setWanted(false)` vì automation đã bị gỡ (tránh cùng một trạng thái lệch "desired=off nhưng desiredConnected=true").
2. **Web** — `AccountCard.tsx`:
   - Đổi logic `autoWanted` sang ưu tiên automation snapshot, cùng công thức `autoActive` của StatusPanel:
     - Nếu `runtime.automation` tồn tại: `desiredMode !== 'off' || activeMode !== 'off' || transitionState === 'switching'`.
     - Nếu `runtime` tồn tại nhưng không có `automation` (rolling deploy / backend cũ): fallback `runtime.desiredConnected` (hành vi legacy giữ nguyên).
     - Nếu `runtime === null` (không có phiên): fallback `account.autoEnabled` như cũ.

### Out-of-scope
- **Không đổi hành vi kết nối**: bấm "Dừng tự động" vẫn **giữ nguyên kết nối game đang online** (người dùng có thể vận hành thủ công). Chỉ đồng bộ cờ trạng thái.
- Không đổi `stopAuto()` legacy (`stopAutomation()` + `stop()` — `stop()` đã tự `setWanted(false)`).
- Không đổi UI/label nào ngoài giá trị "đang chờ"/"đang tắt" trên card.
- Không đổi DB schema, không đổi API contract.

### Input / Output
- Input: trạng thái hiện tại của `AvatarSession` (desiredMode, activeMode, wanted) tại thời điểm gọi `switchAutomationMode`.
- Output:
  - `snapshot().desiredConnected === false` ngay sau khi stop automation thành công.
  - Card hiển thị "đang tắt" sau khi stop; "đang chờ" chỉ khi `desiredMode/activeMode !== 'off'` hoặc đang `switching`.

### Edge cases
- Stop khi chưa từng kết nối (`wanted` đã là `false`): `setWanted(false)` là no-op (guard `if (this.wanted === wanted) return`), không phát event thừa.
- Stop khi client đang online: kết nối giữ nguyên, badge card vẫn "đang online", chỉ nhãn "Tự động" đổi thành "đang tắt".
- Stop khi đang có retry/reconnect chờ xử lý: `wanted=false` khiến các vòng retry/schedule tự huỷ tại các guard `!this.wanted` sẵn có (`avatarSession.ts:661,690,939,1315,1337`).
- Race giữa start/stop: các transition đã được tuần tự hoá qua `enqueueAutomationTransition`, không có interleaving.
- Event `desired-connected` (false) phát ra: frontend đã xử lý sẵn tại `accountRuntime.ts:31` và `AccountsProvider.tsx:68` → `runtime.desiredConnected` trên danh sách card tự cập nhật qua WS.
- Backend cũ không có field `automation` trong snapshot: card fallback về `desiredConnected` như hiện tại.

## 3. Thiết kế kiến trúc & Giải pháp kỹ thuật

### 3.1. Files liên quan

| File | Vai trò | Thay đổi |
|------|---------|----------|
| `avatar-web/server/src/session/avatarSession.ts` | Nguồn sự thật trạng thái phiên | Set `wanted=false` ở 2 nhánh `off` của `switchAutomationMode` |
| `avatar-web/web/src/accounts/AccountCard.tsx` | Card dashboard | `autoWanted` dùng automation snapshot, fallback legacy |
| `avatar-web/server/src/session/avatarSession.test.ts` | Test server | Bổ sung assert `desiredConnected === false` sau stop (nếu có harness phù hợp) |
| `avatar-web/web/src/accounts/AccountCard.test.tsx` | Test web | Test case: `automation` off → "đang tắt"; `automation` đang chạy → "đang chờ" |

### 3.2. Server — `switchAutomationMode`

Nhánh dừng chủ động (hiện tại dòng 365-370):

```ts
if (!(await this.stopActiveAutomation(generation))) return 'connect-pending';
if (intent.desiredMode === 'off') {
  this.setWanted(false);          // ← THÊM: đồng bộ cờ legacy desiredConnected
  this.transitionState = 'stable';
  this.emitAutomation();
  return 'active';
}
```

Nhánh `start-failed` trong `catch` (hiện tại dòng 413-417):

```ts
if (!(await this.stopActiveAutomation(generation))) return 'connect-pending';
this.setWanted(false);            // ← THÊM
this.desiredMode = 'off';
this.transitionState = 'stable';
this.emitAutomation();
return 'start-failed';
```

`setWanted(false)` tự phát event WS `desired-connected: false` → mọi client đang mở dashboard cập nhật `runtime.desiredConnected` ngay lập tức.

### 3.3. Web — `AccountCard.tsx`

Thay dòng 24:

```ts
const automation = runtime?.automation;
const autoActive = automation
  ? automation.desiredMode !== 'off'
    || automation.activeMode !== 'off'
    || automation.transitionState === 'switching'
  : runtime
    ? runtime.desiredConnected
    : account.autoEnabled;
```

Thay dòng 67 (đổi tên biến cho khớp ngữ nghĩa):

```tsx
<span><small>Tự động</small><b>{runtime?.auto.running ? `vòng ${runtime.auto.cycle}` : autoActive ? 'đang chờ' : 'đang tắt'}</b></span>
```

Công thức trùng khớp `autoActive` tại `StatusPanel.tsx:36-40` → hai nơi luôn nhất quán.

### 3.4. Flow sau sửa

```
User bấm "Dừng tự động"
  → POST /automation/stop → setDesiredMode(db,'off') + sessions.stopAutomation()
  → switchAutomationMode({desiredMode:'off'})
      → stopActiveAutomation()          (auto/findNpc dừng)
      → setWanted(false)                (MỚI — desiredConnected=false + WS event)
      → transitionState='stable'
  → snapshot: desiredMode=off, activeMode=off, desiredConnected=false
  → Card: autoActive=false → "đang tắt"   ✓
  → Panel: "chăm farm đang tắt"           ✓ (không đổi)
```

## 4. Verification Plan

### Tự động
1. **Server test** (`avatar-web/server`): chạy bộ test hiện tại — không test nào được fail. Bổ sung/tuỳ chỉnh assert trong `avatarSession.test.ts`: sau `stopAuto()`/stop automation, `session.snapshot().desiredConnected === false` (case có kết nối online).
2. **Web test** (`avatar-web/web`):
   - `AccountCard.test.tsx`: thêm case — `runtime.automation = { desiredMode:'off', activeMode:'off', transitionState:'stable', ... }` → card hiển thị "đang tắt" (kể cả `desiredConnected: true`).
   - Case `automation.desiredMode='auto_farm'` chưa chạy vòng → vẫn "đang chờ".
   - Case không có `automation` + `desiredConnected: true` → vẫn "đang chờ" (legacy không đổi).
3. **Lint/typecheck** cả `server` và `web`.

### Thủ công
1. Chạy app, bật auto cho 1 tài khoản → card "đang chờ"/"vòng N".
2. Bấm "Dừng tự động" → panel `desired=off · active=off`, card chuyển "đang tắt" (không cần refresh).
3. Bật lại auto → card về "đang chờ"/"vòng 1".
4. Restart server với tài khoản `autoEnabled` (desired còn lưu DB) → card vẫn "đang chờ" cho tới khi vào panel tắt.
