# Admin System Monitoring Dashboard — Design Spec

## Mục tiêu & Bối cảnh

Production đang chạy nhiều thành phần (Node.js API, PM2, captcha solver, fishing-ML và kết nối game server). Khi kết nối game lỗi, giao diện hiện tại chỉ cho thấy trạng thái theo từng tài khoản; chưa có màn hình tổng quan để biết nhanh thành phần nào đang hỏng, lỗi gần nhất là gì và lỗi bắt đầu từ thời điểm nào.

Mục tiêu của feature là thêm một dashboard admin read-only trong `avatar-web`, hiển thị sức khỏe hệ thống và các lỗi vận hành gần đây bằng dữ liệu mà backend đã sở hữu. Dashboard phải dùng chung phiên đăng nhập hiện tại, không làm lộ mật khẩu game, khóa mã hóa, biến môi trường hay payload nhạy cảm.

## Phạm vi

### In-scope

- Trang `/admin/monitoring` trong frontend, chỉ hiển thị cho user đã đăng nhập.
- Thẻ tổng quan:
  - trạng thái API/backend;
  - số process/session game đang online, connecting, error;
  - thời điểm snapshot gần nhất;
  - số lỗi trong khoảng thời gian đang xem.
- Thẻ dependency health cho:
  - game server TCP `27.0.14.120:19129`;
  - captcha solver local/proxy;
  - fishing-ML inference local.
- Bảng account runtime gồm account label/id đã được phép xem bởi user hiện tại, status, host/port đã chuẩn hóa, last event, last error và thời điểm cập nhật.
- Bảng lỗi gần đây, lọc severity (`error`/`warning`), nguồn (`game`/`captcha`/`inference`/`backend`) và thời gian.
- Tự refresh định kỳ và cập nhật realtime qua WebSocket hiện có; khi mất kết nối phải hiển thị trạng thái dữ liệu stale.
- Endpoint backend read-only, có authentication và rate limit nhẹ; response không chứa credentials, raw packet, password, `MASTER_KEY`, stack trace đầy đủ hoặc request payload.

### Out-of-scope

- Không có nút restart/stop process, disconnect account, retry login hoặc thay đổi cấu hình production.
- Không thêm hệ thống metrics/log storage dài hạn, Prometheus, Grafana hoặc alert email/Slack.
- Không thay đổi protocol game, cơ chế reconnect, captcha solver hay fishing-ML.
- Không tạo role/permission model mới trong feature đầu tiên; quyền admin được giới hạn ở user đã đăng nhập theo policy hiện tại và một cờ cấu hình rõ ràng.

### Inputs / Outputs / Edge cases

- Input chính là trạng thái runtime của `SessionManager`, snapshot account, event/log ring buffer và kết quả health check dependency.
- Output là DTO monitoring versioned (`schemaVersion: 1`) và UI responsive desktop/mobile.
- Nếu dependency timeout, trả trạng thái `degraded` với latency và lỗi đã sanitize, không làm endpoint tổng thể trả 500.
- Nếu chưa có session hoặc log, trả mảng rỗng và trạng thái `unknown`, không suy diễn thành `healthy`.
- Nếu WebSocket mất kết nối, giữ snapshot cuối cùng nhưng gắn `staleAt`; polling fallback không vượt quá 1 request/15 giây/tab.
- Dữ liệu account thuộc user khác không được trả về; ID không hợp lệ hoặc không có quyền phải bị lọc ở backend.

## Thiết kế kiến trúc & Giải pháp kỹ thuật

### Các files/modules liên quan

- `avatar-web/server/src/monitoring/types.ts` — DTO và union status dùng chung backend/frontend.
- `avatar-web/server/src/monitoring/collector.ts` — thu thập snapshot runtime, health dependency và sanitize lỗi.
- `avatar-web/server/src/monitoring/routes.ts` — `GET /api/monitoring/overview` và `GET /api/monitoring/events`, auth/rate-limit/read-only.
- `avatar-web/server/src/index.ts` — mount monitoring router và truyền dependency cần thiết.
- `avatar-web/server/src/ws.ts` — thêm event `monitoring` cho các user đã subscribe, không gửi raw packet.
- `avatar-web/web/src/admin/MonitoringPage.tsx` — layout dashboard, filter, refresh/stale state.
- `avatar-web/web/src/admin/monitoringApi.ts` — fetch DTO và chuẩn hóa lỗi client.
- `avatar-web/web/src/App.tsx` — route `/admin/monitoring`.
- `avatar-web/web/src/styles/components.css` hoặc stylesheet admin mới — card, table, status badge, responsive layout.

### Data contract

```ts
type HealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown';
type RuntimeStatus = 'online' | 'connecting' | 'handshaking' | 'logging-in' | 'error' | 'idle';

interface MonitoringOverviewDto {
  schemaVersion: 1;
  generatedAt: string;
  backend: { status: HealthStatus; uptimeMs: number; version?: string };
  dependencies: Array<{
    name: 'game-server' | 'captcha-solver' | 'fishing-ml';
    status: HealthStatus;
    checkedAt: string;
    latencyMs: number | null;
    errorCode?: 'timeout' | 'refused' | 'http-error' | 'unavailable';
  }>;
  accounts: Array<{
    id: number;
    label: string;
    runtimeStatus: RuntimeStatus;
    host: string;
    port: number;
    lastEventAt: string | null;
    lastError: { code: string; message: string; at: string } | null;
  }>;
  counters: { total: number; online: number; connecting: number; errors: number };
  staleAt: string | null;
}
```

### Flow

1. Authenticated browser mở `/admin/monitoring`.
2. Frontend gọi `GET /api/monitoring/overview`.
3. Backend xác thực session, lấy account thuộc user hiện tại, đọc snapshot `SessionManager`, chạy health checks có timeout ngắn và sanitize kết quả.
4. Backend trả DTO `schemaVersion: 1`; dependency lỗi riêng không làm mất phần account metrics.
5. WebSocket gửi `monitoring` khi có thay đổi runtime/error đáng kể. Client debounce render và vẫn dùng polling fallback khi socket stale.
6. UI đánh dấu `stale` nếu `generatedAt` quá ngưỡng, hiển thị thời điểm kiểm tra và giữ nguyên dữ liệu cuối cùng.

### Bảo mật và an toàn vận hành

- Bắt buộc auth hiện tại; không mở endpoint public.
- Chỉ trả host/port đã cấu hình và lỗi đã phân loại; không trả username/password game, raw packet, cookies, env hay full stack.
- Health check game chỉ thực hiện TCP connect rồi đóng socket; không gửi gói login hoặc thao tác game.
- Timeout dependency check tối đa 2 giây; giới hạn tần suất endpoint theo session/IP.
- Feature mặc định read-only; không thêm thao tác có thể làm gián đoạn production.

## Verification Plan

### Automated / build verification

- Chạy `npm run typecheck` tại `avatar-web/server` và `npm run build` tại `avatar-web/web`.
- Chạy test backend hiện có liên quan đến auth/router sau khi production code hoàn tất; không tạo test file mới nếu chưa được yêu cầu.
- Kiểm tra response contract bằng một script smoke read-only với session hợp lệ.

### Manual verification

1. Đăng nhập UI và mở `/admin/monitoring`; xác nhận các card hiển thị và không có secret trong network response.
2. Xác nhận game server healthy khi TCP mở; mô phỏng timeout dependency bằng cách giới hạn timeout và kiểm tra trạng thái `degraded` không làm crash API.
3. Gây một lỗi kết nối account đã có sẵn; xác nhận bảng lỗi hiển thị message đã sanitize và không lộ password/raw packet.
4. Ngắt WebSocket; xác nhận badge `stale` xuất hiện và polling fallback không chạy dày hơn 15 giây.
5. Kiểm tra user không xem được account của user khác và endpoint không hoạt động khi chưa đăng nhập.

## Quyết định cần duyệt

- Dashboard v1 là read-only, không có nút restart/stop.
- Quyền truy cập dùng auth hiện tại, chỉ trên các account thuộc user đang đăng nhập.
- Health check game server chỉ TCP connect, không login thật.
- Chưa thêm persistent metrics/alerting; chỉ snapshot và event runtime hiện có.
