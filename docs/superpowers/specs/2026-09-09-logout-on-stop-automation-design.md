# Đăng xuất tài khoản game khi bấm Dừng tự động (Logout on Stop Automation) Design Document

**Ngày tạo:** 2026-09-09  
**Trạng thái:** Chờ duyệt (User Review Gate)  
**Tác giả:** Claude Fable 5  

---

## 1. Mục tiêu & Bối cảnh

### Vấn đề cần giải quyết
Hiện tại, khi người dùng bấm nút **"Dừng tự động"** (trong `StatusPanel` dành cho chăm farm) hoặc các nút dừng automation khác (như Dừng câu cá trong `FishingPanel`, Dừng tìm NPC trong `FindNpcPanel`), client gửi yêu cầu `POST /api/accounts/:id/automation/stop`.
Trên backend:
- `setDesiredMode(db, id, 'off')` chuyển trạng thái dự định về `off`.
- `sessions.stopAutomation(id)` gọi `AvatarSession.stopAutomation()`.
- `AvatarSession.stopAutomation()` chuyển `switchAutomationMode({ desiredMode: 'off' })`, dừng runner hiện tại (`autoFarm`, `findNpc`, `auto_fishing`) và đặt `this.setWanted(false)`.
- **Tuy nhiên**, kết nối game (`GameClient`) vẫn được giữ online (`status: 'online'`).

Điều này dẫn đến:
1. Nhân vật game vẫn đứng treo online vô thời hạn mà không có automation điều khiển.
2. Nguy cơ bị server game Avatar ngắt kết nối do nhàn rỗi (inactivity timeout) hoặc bị phát hiện hành vi bot bất thường khi đứng yên nhiều giờ trong map.
3. Chiếm dụng tài nguyên RAM/socket của máy chủ bot không cần thiết.
4. Trái với kỳ vọng trực quan của người dùng: khi bấm "Dừng tự động", họ muốn tài khoản game đăng xuất hoàn toàn khỏi trò chơi.

### Mục tiêu
Khi dừng tự động (`POST /api/accounts/:id/automation/stop` hoặc `POST /api/accounts/:id/auto/stop`), server sẽ:
1. Dừng ngay runner automation đang chạy.
2. Ngắt kết nối tài khoản game sạch sẽ: gửi gói opcode `client.logout()` tới máy chủ Avatar, đóng TCP socket (`client.close()`), giải phóng bộ nhớ và listener của client.
3. Chuyển trạng thái phiên game về `idle`, đồng thời phát các sự kiện cập nhật giao diện (`status: 'idle'`, `desired-connected: false`, `automation: { desiredMode: 'off', activeMode: 'off', transitionState: 'stable' }`).

---

## 2. Phạm vi (Scope)

### In-scope
1. **Server — `AvatarSession.stopAutomation()`** ([avatar-web/server/src/session/avatarSession.ts](avatar-web/server/src/session/avatarSession.ts)):
   - Sau khi hoàn thành `await this.switchAutomationMode({ desiredMode: 'off', ... })`, gọi thêm `this.stop()` để thực hiện teardown phiên game.
   - `this.stop()` đảm bảo:
     - Gửi `client.logout()` (nếu socket đang online).
     - Đóng kết nối `client.close()`.
     - Hủy mọi timer retry (`cancelRetry()`), timer chu kỳ auto farm (`cancelAutoCycleTimer()`), và timer đồng bộ farm (`cancelAutoSyncKickoff()`).
     - Đặt `this.status = 'idle'`.
     - Phát event WebSocket `status: 'idle'` và log `"Đã ngắt kết nối."`.
2. **Server Test — `avatarSession.test.ts`** ([avatar-web/server/src/session/avatarSession.test.ts](avatar-web/server/src/session/avatarSession.test.ts)):
   - Cập nhật test case cũ `stopAutomation tắt desiredConnected nhưng giữ kết nối game` (vốn từng kiểm tra kết nối giữ nguyên) thành `stopAutomation tắt desiredConnected và ngắt kết nối game (logout)` để phản ánh hành vi mới: kiểm tra `status === 'idle'`, `desiredConnected === false`, và `client.closed === true`.
3. **Frontend Compatibility**:
   - Web UI hiện tại (`StatusPanel.tsx`, `AccountCard.tsx`) đã lắng nghe sự kiện WebSocket `status` và `desired-connected`. Khi server phát `status: 'idle'`, UI sẽ tự động chuyển sang nhãn "chưa kết nối" / "đang tắt" mà không cần sửa code web.

### Out-of-scope
- Không thay đổi hành vi kết nối thủ công (`POST /:id/connect`): người dùng bấm kết nối trực tiếp vẫn giữ online bình thường.
- Không thay đổi hành vi start automation: khi bấm "Bật chăm farm", nếu tài khoản chưa online thì bot vẫn tự động kết nối và đăng nhập như thiết kế hiện tại.
- Không thay đổi schema cơ sở dữ liệu SQLite.

### Input / Output & Data Contract
- **API Input**: `POST /api/accounts/:id/automation/stop` với body `{}`.
- **API Output**: Trả về `AutomationSnapshot` với `desiredMode: 'off'`, `activeMode: 'off'`, `transitionState: 'stable'`.
- **WebSocket Broadcasts**:
  - `type: 'automation'`, payload: `AutomationSnapshot` (mode `off`).
  - `type: 'status'`, payload: `'idle'`.
  - `type: 'desired-connected'`, payload: `false`.

### Edge Cases
1. **Dừng khi tài khoản đã offline / đang retry**:
   - `this.stop()` có guard an toàn: `cancelRetry()`, `cancelAutoCycleTimer()`, và trong `teardown()` có `if (!client) return;`. Không xảy ra lỗi null reference khi client chưa online.
2. **Socket bị ngắt đột ngột trong khi logout**:
   - Trong `teardown()`: lệnh `try { client.logout(); } catch {}` đã bọc try/catch bỏ qua lỗi gửi packet nếu socket đã hỏng trước đó.
3. **Gọi stop nhiều lần liên tiếp (idempotency)**:
   - `this.stop()` là hàm idempotent; gọi nhiều lần liên tiếp sẽ không phát sinh tác dụng phụ hay exception.

---

## 3. Thiết kế kiến trúc & Giải pháp kỹ thuật

### Luồng xử lý (Sequence Flow)

```
User -> StatusPanel: Click "Dừng tự động"
StatusPanel -> routes.ts: POST /api/accounts/:id/automation/stop
routes.ts -> manager.ts: setDesiredMode(db, id, 'off') & sessions.stopAutomation(id)
manager.ts -> AvatarSession: session.stopAutomation()
AvatarSession -> AvatarSession: await switchAutomationMode({ desiredMode: 'off' })
  - dừng runner (autoFarm / findNpc / fishing)
  - đặt desiredMode = 'off', activeMode = 'off'
  - setWanted(false)
AvatarSession -> AvatarSession: this.stop()
  - cancelRetry(), cancelAutoCycleTimer(), cancelAutoSyncKickoff()
  - client.logout() (gửi gói opcode logout đến server Avatar)
  - client.close() (đóng TCP socket)
  - status = 'idle'
  - pushLog('Đã ngắt kết nối.')
  - emit('status', 'idle')
  - emitAutomation()
routes.ts -> StatusPanel: 200 OK (AutomationSnapshot)
WebSocket -> UI: status = 'idle', desired-connected = false
UI: Hiển thị badge "chưa kết nối", nút "Bật chăm farm" sẵn sàng
```

### Chi tiết các file thay đổi

| File | Vai trò | Thay đổi |
|------|---------|----------|
| [avatar-web/server/src/session/avatarSession.ts](avatar-web/server/src/session/avatarSession.ts) | Quản lý vòng đời phiên chơi game và automation | Trong `stopAutomation()`, thêm lệnh `this.stop()` sau khi `await this.switchAutomationMode(...)`. |
| [avatar-web/server/src/session/avatarSession.test.ts](avatar-web/server/src/session/avatarSession.test.ts) | Kiểm thử đơn vị cho `AvatarSession` | Sửa test case dòng 279 để kiểm tra `status === 'idle'`, `desiredConnected === false` và client đóng. |

---

## 4. Kế hoạch kiểm chứng (Verification Plan)

### Automated Tests
1. Chạy suite test server:
   ```bash
   npm --prefix avatar-web/server test
   ```
   - Kỳ vọng: 274 tests đều PASS, bao gồm test case `stopAutomation tắt desiredConnected và ngắt kết nối game (logout)`.
2. Chạy suite test web:
   ```bash
   npm --prefix avatar-web/web test
   ```
   - Kỳ vọng: 75 tests đều PASS.

### GitNexus Safety Verification
1. Trước khi sửa code: Kiểm tra blast radius với `gitnexus_impact` (đã thực hiện: Risk LOW).
2. Trước khi commit: Chạy `gitnexus_detect_changes({scope: "all"})` để đảm bảo chỉ thay đổi đúng các symbol và file trong phạm vi thiết kế.
