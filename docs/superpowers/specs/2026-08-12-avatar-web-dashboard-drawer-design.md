# Thiết kế: Dashboard card và drawer Vận hành cho Avatar Web

Ngày: 2026-08-12  
Phạm vi: `avatar-web/web/`

## 1. Mục tiêu

Thay trang danh sách tài khoản dạng bảng bằng dashboard card responsive để người
dùng theo dõi nhiều tài khoản nhanh hơn, đồng thời đưa phần Vận hành của một tài
khoản vào drawer mở ngay trên dashboard.

Kết quả cần đạt:

1. `/accounts` hiển thị các tài khoản bằng card cân bằng, dễ quét trạng thái.
2. `/accounts/:id` hiển thị cùng dashboard và mở drawer Vận hành của tài khoản đó.
3. `/accounts/:id/debug` giữ công cụ Debug chuyên sâu dưới dạng trang riêng.
4. Card cuối cùng mở modal thêm tài khoản, thay cho form luôn hiển thị cuối trang.
5. REST, WebSocket, SQLite và các phiên game phía server giữ nguyên hợp đồng.

## 2. Phạm vi

### 2.1 Bao gồm

- Dashboard card 3/2/1 cột theo kích thước màn hình.
- Card trạng thái tài khoản với Kết nối/Ngắt, mở Vận hành và Xóa.
- Modal thêm tài khoản.
- Drawer Vận hành tái sử dụng các panel hiện có.
- Route Debug riêng.
- Tách trạng thái danh sách và trạng thái runtime thành các hook/component có
  trách nhiệm rõ ràng.
- Kiểm thử frontend bằng Vitest và React Testing Library.

### 2.2 Không bao gồm

- Sửa thông tin tài khoản game đã lưu.
- Đổi mật khẩu web hoặc quên mật khẩu qua email.
- Offline banner mới; cơ chế tự kết nối lại WebSocket hiện tại được giữ nguyên.
- Role admin, duyệt đăng ký, trial, giới hạn slot, ngày hết hạn hoặc thanh toán.
- Câu cá, tìm NPC, proxy hoặc bất kỳ opcode/chức năng game mới nào.
- Thay đổi schema, REST API, định dạng WebSocket hoặc logic session phía server.
- Sao chép mã nguồn, CSS, hình ảnh hoặc tài nguyên từ `3x.4utovip.com`.

## 3. Quyết định thiết kế

| Câu hỏi | Quyết định |
|---|---|
| Bố cục dashboard | Card cân bằng, 3 cột màn hình rộng, 2 cột màn hình vừa, 1 cột mobile |
| Nội dung drawer | Chỉ phần Vận hành; Debug ở trang riêng |
| Cách mở drawer | Click vùng nội dung card hoặc nút “Mở vận hành” |
| Điều hướng drawer | URL `/accounts/:id`, đóng về `/accounts` |
| Điều hướng Debug | URL `/accounts/:id/debug` |
| Thêm tài khoản | Card “+ Thêm tài khoản” mở modal |
| Backend | Không đổi |
| Cập nhật realtime | Giữ một WebSocket dùng chung và chỉ subscribe sự kiện nặng khi cần |

Các phương án không chọn:

- Card dày đặc: hiển thị được nhiều tài khoản nhưng giảm khả năng đọc lỗi và
  trạng thái auto.
- Hàng ngang nâng cấp: gần bảng hiện tại nhưng không tạo được phân cấp dashboard.
- Drawer chỉ dùng React state hoặc query string: không có deep link rõ ràng bằng
  `/accounts/:id` và hành vi Back/Forward kém tự nhiên hơn.

## 4. Kiến trúc frontend

### 4.1 Cây route

`main.tsx` giữ `AuthProvider` và `RequireAuth`, nhưng nhóm ba route tài khoản dưới
một provider dùng chung:

```text
/accounts
└── AccountsProvider
    ├── index       -> AccountsDashboardPage
    ├── :id         -> AccountsDashboardPage + AccountOperationsDrawer
    └── :id/debug   -> AccountDebugPage
```

`AccountsProvider` sống ở route cha, cung cấp dữ liệu qua một React context riêng
và giữ danh sách khi chuyển giữa dashboard, drawer và Debug. Không dùng Outlet
context cho dữ liệu này vì `AccountsDashboardPage` phải render một Outlet lồng
nhau cho drawer; React context tránh bị Outlet con che khuất. Vì vậy mở/đóng drawer
không gọi lại `GET /api/accounts` chỉ để khôi phục dashboard.

### 4.2 Phân chia component

```text
web/src/accounts/
├── AccountsProvider.tsx          # tải danh sách, nhận sự kiện WS nhẹ, cung cấp reload
├── AccountsDashboardPage.tsx     # header, grid card, modal, Outlet drawer
├── AccountCard.tsx               # trình bày và thao tác của một tài khoản
├── AddAccountModal.tsx           # form tạo tài khoản
├── AccountOperationsDrawer.tsx   # ghép bốn panel Vận hành
├── AccountDebugPage.tsx          # trang Debug riêng
├── accountRuntime.ts             # reducer thuần cho sự kiện runtime
├── useAccountRuntime.ts          # snapshot ban đầu + subscribe WS theo accountId
└── panels/                       # tái sử dụng các panel hiện có
```

`AccountDetailPage.tsx` hiện tại không tiếp tục sở hữu toàn bộ Vận hành và Debug.
Logic của nó được tách về drawer, trang Debug và hook runtime. Không sao chép cùng
một switch xử lý WebSocket sang hai trang.

### 4.3 Trách nhiệm và giao diện

#### `AccountsProvider`

- Gọi `GET /api/accounts` lần đầu.
- Cung cấp `accounts`, `loading`, `error` và `reload()` qua `AccountsContext`.
- Khi dashboard không mở drawer, gọi `subscribeAccounts([])` để chỉ nhận sự kiện
  nhẹ.
- Áp dụng trực tiếp `status` và `auto` vào đúng `AccountWithRuntime`.
- Khi nhận `auto-disabled`, gọi `reload()` vì ý muốn đã được server cập nhật trong
  DB.
- Không xóa danh sách cũ nếu một lần reload thất bại; chỉ cập nhật thông báo lỗi.

#### `accountRuntime.ts` và `useAccountRuntime`

- Reducer thuần nhận `SessionSnapshot` hiện tại và `WsMessage`.
- Hỗ trợ đúng các event hiện có: `snapshot`, `status`, `auto`, `macro`, `farm`,
  `inventory`, `money`, `trees`, `log`, `traffic`.
- Giữ tối đa 500 dòng log và 300 dòng traffic giống hành vi UI hiện tại.
- `useAccountRuntime(accountId, initialSnapshot)` gọi
  `subscribeAccounts([accountId])` khi mount và `subscribeAccounts([])` khi
  unmount.
- Event có `accountId` khác bị bỏ qua.

#### `AccountCard`

Card hiển thị:

- Nhãn và tài khoản game.
- Badge cho `idle`, `connecting`, `handshaking`, `logging-in`, `online`, `error`.
- Số xu, hoặc `—` nếu chưa có.
- Trạng thái auto: đang tắt hoặc số vòng đang chạy.
- `lastError` nếu có; nếu không có lỗi nhưng có `nextRetryAt`, hiển thị thời điểm
  thử lại.

Card không hiển thị “thời gian treo” vì `SessionSnapshot` hiện không có mốc bắt
đầu hoặc uptime. Phạm vi frontend-only không được tự suy diễn dữ liệu này.

Vùng nội dung chính của card là một `button` lớn mở drawer bằng
`navigate('/accounts/:id')`. Footer chứa các nút độc lập:

- `Kết nối` hoặc `Ngắt`.
- `Mở vận hành`.
- `Xóa`.

Không đặt button lồng button. Click Kết nối/Ngắt hoặc Xóa không được mở drawer.
Mỗi thao tác có trạng thái busy riêng và khóa đúng nút đang chạy để chống gửi lặp.
Lỗi thao tác hiển thị ngay trên card, không thay thế lỗi runtime từ server.

#### `AddAccountModal`

- Mở từ card cuối cùng “+ Thêm tài khoản”.
- Có ba trường hiện tại: nhãn, tài khoản game, mật khẩu game.
- Gọi `POST /api/accounts` với hợp đồng hiện có.
- Thành công: reset form, đóng modal, gọi `reload()` và card mới xuất hiện.
- Thất bại: giữ modal, giữ dữ liệu và hiển thị lỗi trong modal.
- Đóng bằng nút Hủy/×, backdrop hoặc Escape.
- Khi mở, focus trường Nhãn; khi đóng, trả focus về card “+”.
- Modal dùng `role="dialog"`, `aria-modal="true"`, tiêu đề được nối bằng
  `aria-labelledby`, khóa scroll nền và không cho tab ra khỏi modal.

#### `AccountOperationsDrawer`

- Lấy `id` từ route và tìm account trong `AccountsProvider`.
- Dùng `useAccountRuntime` với snapshot hiện có của account.
- Ghép lại `StatusPanel`, `AutoFarmPanel`, `AssetsPanel`, `LogPanel` theo thứ tự.
- Link “Debug chuyên sâu” tới `/accounts/:id/debug`.
- Đóng bằng nút ×, backdrop, Escape hoặc nút Back của trình duyệt; đích đóng là
  `/accounts`.
- Drawer dùng cùng yêu cầu focus/ARIA như modal và trả focus về card đã mở nó khi
  đóng trong cùng phiên dashboard.
- Khi route `id` không phải số nguyên dương hoặc không thuộc danh sách, hiển thị
  trạng thái “không có tài khoản này” trong drawer cùng nút về dashboard.
- Background dashboard không nhận thao tác khi drawer mở.

#### `AccountDebugPage`

- Dùng cùng `AccountsProvider` và `useAccountRuntime`, không sao chép reducer.
- Hiển thị header tài khoản, badge trạng thái, link về Vận hành và `DebugPanel`.
- Route sai hoặc account không tồn tại hiển thị lỗi cùng link về `/accounts`.
- Vì Debug cần traffic nặng, hook vẫn subscribe đúng một `accountId` trong suốt
  thời gian trang mở.

## 5. Luồng dữ liệu

### 5.1 Tải dashboard

```text
AccountsProvider mount
  -> GET /api/accounts
  -> lưu AccountWithRuntime[]
  -> render AccountCard[]
  -> WS status/auto cập nhật đúng card, không reload toàn trang
```

### 5.2 Mở Vận hành

```text
Click card hoặc “Mở vận hành”
  -> navigate /accounts/:id
  -> dashboard giữ nguyên trong AccountsProvider
  -> drawer dùng runtime ban đầu từ account
  -> subscribeAccounts([id])
  -> snapshot/event nặng cập nhật các panel
```

Khi đóng drawer, route về `/accounts`, hook unmount và gửi
`subscribeAccounts([])`. WebSocket không bị đóng và không tạo kết nối mới.

### 5.3 Thêm tài khoản

```text
Click card “+”
  -> mở modal
  -> POST /api/accounts
  -> reload danh sách
  -> đóng modal
```

Chỉ đóng modal sau khi POST thành công. Nếu POST thành công nhưng reload sau đó
thất bại, modal vẫn đóng vì tài khoản đã được tạo; dashboard giữ danh sách cũ và
hiển thị lỗi reload để người dùng thử lại, tránh gửi POST lần hai gây trùng.

## 6. Trạng thái lỗi và cạnh tranh thao tác

- Tải lần đầu thất bại và chưa có dữ liệu: hiển thị empty error có nút “Thử lại”.
- Reload thất bại khi đã có dữ liệu: giữ nguyên card và hiển thị lỗi không chặn.
- Kết nối/Ngắt thất bại: mở lại nút và hiển thị lỗi trên card.
- Xóa cần `confirm`; chỉ loại card khỏi UI sau khi DELETE thành công và reload.
- Khi một card đang connect/disconnect/delete, các thao tác xung đột trên chính
  card đó bị khóa; card khác vẫn hoạt động.
- Snapshot WebSocket mới được phép thay runtime đang hiển thị. Event lẻ chỉ cập
  nhật trường tương ứng, không xóa các trường khác.
- Route chuyển nhanh giữa hai account phải cleanup subscription cũ trước khi dùng
  subscription mới.
- Cơ chế reconnect WebSocket 3 giây trong `web/src/ws.ts` giữ nguyên.

## 7. Trình bày responsive

- Màn hình rộng từ 1100 px: 3 cột.
- Từ 680 px đến 1099 px: 2 cột.
- Dưới 680 px: 1 cột.
- Card có chiều cao nội dung ổn định nhưng không cắt lỗi dài; lỗi được wrap.
- Drawer rộng tối đa 720 px trên desktop, chiếm toàn bộ chiều rộng dưới 680 px.
- Drawer và modal có backdrop; `prefers-reduced-motion: reduce` tắt animation
  trượt/fade không cần thiết.
- Farm grid bên trong drawer tiếp tục dùng `auto-fill`; không ép số cột cố định.

Giao diện tiếp tục dùng theme tối và biến CSS hiện tại. Chỉ lấy ý tưởng phân cấp
thông tin từ trang tham chiếu, không sao chép nhận diện hoặc tài nguyên.

## 8. Kiểm thử

Frontend bổ sung:

- Vitest chạy trong `jsdom`.
- React Testing Library và `@testing-library/user-event` cho hành vi người dùng.
- `@testing-library/jest-dom` cho assertion accessibility/DOM.

Các nhóm test bắt buộc:

1. `accountRuntime`:
   - snapshot thay toàn bộ runtime;
   - từng event chỉ thay trường đúng;
   - bỏ event account khác;
   - log/traffic tuân giới hạn ring buffer.
2. `AccountCard`:
   - render đúng trạng thái, xu, auto, lỗi/retry;
   - click vùng card mở đúng route;
   - Kết nối/Ngắt và Xóa không mở drawer;
   - busy khóa thao tác xung đột.
3. `AddAccountModal`:
   - mở/đóng bằng nút, backdrop và Escape;
   - lỗi API giữ form;
   - thành công reset, đóng và reload đúng một lần;
   - focus vào/ra modal đúng vị trí.
4. Dashboard và route drawer:
   - `/accounts` không có drawer;
   - `/accounts/:id` có dashboard phía sau và drawer đúng account;
   - Back/Escape đóng về `/accounts`;
   - id không tồn tại hiển thị lỗi an toàn.
5. `useAccountRuntime`:
   - subscribe đúng id khi mount;
   - cleanup về mảng rỗng khi unmount/đổi id.
6. Route Debug:
   - `/accounts/:id/debug` render `DebugPanel` và link về Vận hành.

Xác minh cuối cùng:

```bash
cd avatar-web/web && npm test
cd avatar-web/web && npm run build
cd avatar-web/server && npm test
cd avatar-web/server && npm run typecheck
git diff --check
```

Test web chứng minh hành vi component/route; `npm run build` chứng minh TypeScript
và bundle production. Server test/typecheck là kiểm tra hồi quy hợp đồng vì phạm
vi này không sửa backend.

## 9. Tiêu chí hoàn thành

- Trang `/accounts` không còn bảng hoặc form thêm tài khoản luôn hiển thị.
- Dashboard đúng 3/2/1 cột tại các breakpoint đã định.
- Mọi dữ liệu đang có trên bảng cũ vẫn xuất hiện trên card hoặc drawer; không bịa
  thêm uptime chưa có từ server.
- Drawer Vận hành mở theo `/accounts/:id`, đóng về `/accounts` và Back/Forward hoạt
  động đúng.
- Debug hoạt động tại `/accounts/:id/debug`.
- Không có button lồng button; keyboard và focus hoạt động với card, modal, drawer.
- Chỉ một kết nối WebSocket dùng chung; chỉ account đang mở Vận hành/Debug nhận
  event nặng.
- Thêm, kết nối/ngắt và xóa tài khoản tiếp tục dùng các API hiện có.
- Không có thay đổi trong `avatar-web/server/`.
- Toàn bộ lệnh xác minh ở mục 8 pass.
