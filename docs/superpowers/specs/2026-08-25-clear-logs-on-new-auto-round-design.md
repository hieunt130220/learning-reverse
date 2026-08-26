# Spec: Xoá log cũ khi chạy round auto mới

## 1. Mục tiêu & Bối cảnh

- Log của phiên (buffer RAM tối đa 500 dòng trong `AvatarSession.logs`) và log tích luỹ ở web UI (qua WS event `log`) **tồn tại xuyên suốt các round auto**.
- Khi một round auto mới bắt đầu, log cũ còn nằm lại khiến người dùng khó theo dõi round hiện tại.
- **Mục tiêu**: khi round auto mới khởi động, xoá sạch log cũ ở cả server buffer lẫn web UI, chỉ giữ log phát sinh từ round mới.

## 2. Phạm vi (Scope)

### In-scope
- Xoá `AvatarSession.logs` (server RAM) tại thời điểm bắt đầu round auto mới.
- Phát event mới `'logs-clear'` qua WS để web UI xoá phần log đã tích luỹ.
- Web reducer (`reduceAccountRuntime`) xử lý event `'logs-clear'` → đặt `logs: []`.

### Out-of-scope
- Không đổi cơ chế ring-buffer 500 dòng (`pushLog`).
- Không đụng tới `traffic`, `lastActions` của AutoFarm, hay log pm2/stdout.
- Không thêm nút xoá log thủ công trên UI.
- Không đổi logic lịch vòng auto (`scheduleAutoCycle` / `scheduleOnlineAutoCycle`).

### Điểm trigger "round mới" — tất cả đường start round đều được phủ
| Đường vào | Vị trí gọi `auto.start()` | Ghi chú |
|---|---|---|
| Start thủ công (`POST /auto/start`, resume sau login) | `startDesiredAutomation()` — avatarSession.ts:1171 | Round đầu tiên cũng tính là round mới |
| Vòng hẹn giờ sau cycle-complete (logout → đăng nhập lại) | `scheduleAutoCycle()` → `start()` → `startDesiredAutomation()` | Phủ bởi `startDesiredAutomation` |
| Vòng hẹn giờ stay-online | `scheduleOnlineAutoCycle()` → `tryStartAuto()` — avatarSession.ts:1192 | |

→ Chèn lời gọi xoá log ngay **trước mỗi lệnh `this.auto!.start(...)`** tại 2 điểm duy nhất: `tryStartAuto()` và `startDesiredAutomation()`. Cả 3 đường trên đều đi qua ít nhất 1 trong 2 điểm này.

### Edge cases
- `tryStartAuto()` lỗi (ví dụ sạp đang bận): xoá log trước rồi mới `pushLog` thông báo lỗi → panel sạch nhưng vẫn thấy lỗi vừa xảy ra.
- Event `'logs-clear'` là event nặng (không thuộc `LIGHT_EVENTS`) → chỉ client đang mở trang chi tiết tài khoản nhận, đúng hành vi hiện có của `log`.
- Client mở trang giữa chừng round: nhận snapshot mới qua `'snapshot'` → không bị ảnh hưởng.

## 3. Thiết kế & Giải pháp kỹ thuật

### Files liên quan
| File | Vai trò | Thay đổi |
|---|---|---|
| `avatar-web/server/src/session/avatarSession.ts` | Nơi giữ buffer log + mọi điểm start round | Thêm method `clearLogs()`; gọi trước `auto.start()` ở `tryStartAuto()` (:1188) và `startDesiredAutomation()` (:1159) |
| `avatar-web/web/src/accounts/accountRuntime.ts` | Reducer WS chung cho web | Thêm case `'logs-clear'` → `{ ...current, logs: [] }` |

### Interfaces / Data contracts
- Event WS mới (server → client):
  ```ts
  { type: 'logs-clear', accountId, payload: null }
  ```
  - Không payload; reducer chỉ cần biết loại event.
- Method mới trong `AvatarSession` (private):
  ```ts
  private clearLogs(): void {
    this.logs = [];
    this.emit('logs-clear', null);
  }
  ```

### Flow
```
cycle-complete → hẹn giờ intervalMs
  → scheduleAutoCycle()   → start() ─┐
  → scheduleOnlineAutoCycle() ────────┤
startDesiredAutomation() / tryStartAuto()
  → clearLogs()            // logs=[] + emit 'logs-clear'
  → this.auto!.start(cfg)  // round mới, log viết từ đầu
web: reduceAccountRuntime('logs-clear') → logs: []
```

## 4. Verification Plan

1. **Typecheck**: `npm run typecheck` ở `avatar-web/server` và `avatar-web/web`.
2. **Test hiện có**: `npm run test` ở server (đảm bảo test ring-buffer 500 dòng ở `avatarSession.test.ts:479` vẫn pass).
3. **Thủ công**: bật auto farm → xem panel log đầy dần sau round 1 → chờ cycle-complete + đăng nhập lại → panel log phải trống rồi chỉ chứa log của round 2. Lặp lại với chế độ stay-online (`logoutAfterCycle: false`).
4. **Trường hợp lỗi**: bật auto khi sạp đang bận → panel sạch, chỉ còn dòng "không bật được tự động: …".
