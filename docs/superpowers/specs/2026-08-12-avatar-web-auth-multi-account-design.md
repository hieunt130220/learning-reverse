# Thiết kế: xác thực người dùng và quản lý nhiều tài khoản avatar

Ngày: 2026-08-12
Phạm vi: `avatar-web/`

## 1. Mục tiêu

Biến `avatar-web` từ công cụ một-phiên thành ứng dụng web có tài khoản người dùng,
quản lý được nhiều tài khoản game avatar, mỗi tài khoản chạy auto-farm liên tục
trên server.

Ba việc mới:

1. Đăng ký / đăng nhập bằng email và mật khẩu.
2. Trang quản lý danh sách tài khoản avatar, thêm được nhiều tài khoản.
3. Mỗi tài khoản avatar có một trang chi tiết để theo dõi và điều khiển.

## 2. Bối cảnh

Mã hiện tại là công cụ cá nhân một-phiên:

- `server/src/index.ts` tạo **một** `GameClient` toàn cục, kèm một `MacroRunner`
  và một `AutoFarm` bám vào nó.
- Tài khoản game đọc từ `avatar-web/account`, một dòng `user/pass` dạng rõ.
- Không có khái niệm người dùng, không có cơ sở dữ liệu, `/ws` mở cho mọi kết nối.
- `web/src/App.tsx` là một component 715 dòng cho đúng một phiên.

Tầng giao thức (`server/src/proto/`) và tầng game (`server/src/game/`) đã được viết
theo hướng instance, không phụ thuộc trạng thái toàn cục — đây là lý do lớp
multi-session làm được mà không phải viết lại chúng.

## 3. Quyết định nền

| Câu hỏi | Quyết định |
|---|---|
| Triển khai ở đâu | VPS, một người dùng, sau reverse proxy lo TLS |
| Vòng đời auto | 24/7 trên server, độc lập trình duyệt |
| Mật khẩu game lưu thế nào | AES-256-GCM, khoá từ `MASTER_KEY` trong env |
| Đăng ký | Mở theo mã mời (`INVITE_CODE`) |
| Trang chi tiết | Giao diện vận hành + tab Debug ẩn |
| Kiến trúc phiên | `SessionManager` trong cùng process Node |

Đánh đổi đã cân nhắc: auto 24/7 buộc server phải tự đọc được mật khẩu game khi
khởi động lại mà không cần người dùng có mặt. Vì vậy khoá phải nằm trong môi
trường của service, không thể dẫn xuất từ mật khẩu đăng nhập. Ai chiếm được VPS
thì có cả khoá lẫn DB — đây là giới hạn cố hữu của yêu cầu 24/7, không phải sơ suất.

## 4. Kiến trúc

```
trình duyệt ──HTTPS──► reverse proxy ──HTTP──► server Node ──TCP 19129──► server game
                                                    │
                                                    ├── SQLite (users, phiên web, tài khoản avatar)
                                                    └── SessionManager: Map<accountId, AvatarSession>
```

Một process Node giữ toàn bộ: REST, WebSocket, và mọi phiên TCP tới server game.

### 4.1 Bố cục module — server

```
server/src/
├── db/
│   ├── index.ts            # mở SQLite, chạy migration lúc khởi động
│   └── schema.sql
├── crypto/secretBox.ts     # AES-256-GCM encrypt/decrypt
├── auth/
│   ├── password.ts         # hash/verify argon2id
│   ├── sessions.ts         # tạo/tra/gia hạn/xoá phiên web
│   ├── middleware.ts       # requireAuth
│   └── routes.ts           # /api/auth/*
├── accounts/
│   ├── repo.ts             # CRUD avatar_accounts, mã hoá nằm trong đây
│   └── routes.ts           # /api/accounts (danh sách, tạo, sửa, xoá)
├── session/
│   ├── avatarSession.ts    # GameClient + AutoFarm + MacroRunner + ring buffer
│   ├── manager.ts          # Map<accountId, AvatarSession>, bootstrap, supervisor
│   └── routes.ts           # /api/accounts/:id/* (điều khiển phiên)
├── ws.ts                   # WebSocket có xác thực, định tuyến theo accountId
└── index.ts                # chỉ lắp ráp
```

`proto/`, `game/`, `autoFarm.ts`, `macro.ts` **không đổi logic**.

`account.ts` và khối auto-login đọc file trong `index.ts` bị gỡ bỏ. File
`avatar-web/account` xoá khỏi đĩa sau khi người dùng nhập lại tài khoản qua UI.

### 4.2 Bố cục module — web

```
web/src/
├── main.tsx                    # + react-router-dom
├── api.ts                      # fetch wrapper, credentials: 'include', 401 -> /login
├── ws.ts                       # một kết nối WS dùng chung, subscribe theo accountId
├── auth/{LoginPage,RegisterPage,useAuth}.tsx
├── accounts/
│   ├── AccountsPage.tsx        # danh sách + form thêm
│   ├── AccountDetailPage.tsx   # header + tab Vận hành / Debug
│   └── panels/
│       ├── StatusPanel.tsx
│       ├── AutoFarmPanel.tsx
│       ├── AssetsPanel.tsx
│       ├── LogPanel.tsx
│       └── DebugPanel.tsx      # bảng action, gói raw, log gói tin
└── actions.ts                  # giữ nguyên
```

`App.tsx` (715 dòng) tách thành các panel trên. Đây là điều kiện cần, không phải
refactor thừa: trang chi tiết dựng từ chính file này và phải chia được thành tab.

## 5. Mô hình dữ liệu

SQLite qua `better-sqlite3`, file `server/data/avatar-web.db`. Migration là file SQL
chạy lúc khởi động.

```sql
CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,   -- đã lowercase + trim
  password_hash TEXT NOT NULL,          -- argon2id
  created_at    INTEGER NOT NULL
);

CREATE TABLE web_sessions (
  id_hash    TEXT PRIMARY KEY,          -- SHA-256 của session id, không lưu id gốc
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE avatar_accounts (
  id               INTEGER PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label            TEXT NOT NULL,
  game_user        TEXT NOT NULL,
  game_pass_enc    TEXT NOT NULL,       -- v1:<iv>:<tag>:<ciphertext>
  host             TEXT NOT NULL,
  port             INTEGER NOT NULL,
  device_json      TEXT,                -- DeviceProfile, NULL = sinh mặc định
  auto_enabled     INTEGER NOT NULL DEFAULT 0,
  auto_config_json TEXT,                -- AutoFarmConfig
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL
);
CREATE INDEX idx_avatar_accounts_user ON avatar_accounts(user_id);
```

Nhật ký hoạt động **không vào DB**: mỗi `AvatarSession` giữ ring buffer khoảng 500
dòng trong RAM. Restart server thì mất log — đánh đổi có chủ ý để schema gọn.

### 5.1 Mã hoá mật khẩu game

`secretBox` dùng AES-256-GCM:

- Khoá: 32 byte, đọc từ `MASTER_KEY` (base64) trong env.
- IV: 12 byte ngẫu nhiên mỗi lần mã hoá.
- **AAD = id của bản ghi `avatar_accounts`.** Kẻ có quyền ghi DB không thể chép bản
  mã của tài khoản này sang tài khoản khác rồi đọc ra qua ứng dụng.
- Định dạng lưu: `v1:<iv_b64>:<tag_b64>:<ct_b64>`. Tiền tố phiên bản để sau này
  xoay khoá được.

Vì AAD là id nên bản ghi phải được tạo trước, rồi cập nhật `game_pass_enc` ngay sau
đó trong cùng một transaction.

## 6. Xác thực

| Endpoint | Việc |
|---|---|
| `POST /api/auth/register` | `{email, password, inviteCode}` |
| `POST /api/auth/login` | `{email, password}` |
| `POST /api/auth/logout` | xoá phiên, xoá cookie |
| `GET /api/auth/me` | `{id, email}` |

- **Mật khẩu:** argon2id (gói `argon2`). Tối thiểu 10 ký tự, không đặt luật ký tự
  đặc biệt.
- **Mã mời:** so `inviteCode` với `INVITE_CODE` bằng `crypto.timingSafeEqual`.
- **Chống dò email:** email không tồn tại vẫn chạy một `argon2.verify` giả trên hash
  cố định, để thời gian phản hồi không tiết lộ email nào có thật. Thông báo lỗi luôn
  là "email hoặc mật khẩu không đúng".
- **Phiên:** id 32 byte ngẫu nhiên base64url, gửi qua cookie `sid` với `httpOnly`,
  `SameSite=Lax`, `Secure` khi `NODE_ENV=production`, hạn 30 ngày. DB chỉ lưu
  SHA-256 của id. Tự gia hạn khi thời gian còn lại dưới một nửa.
- **Rate limit:** in-memory, đếm theo IP và theo email — 10 lần đăng nhập sai trong
  15 phút thì trả 429. App bật `trust proxy` để lấy IP thật sau reverse proxy.
- **WebSocket:** xác thực bằng chính cookie đó trong `wss.on('connection')`; không
  hợp lệ thì đóng ngay.

**Cố ý không làm:** xác thực email, quên mật khẩu, đổi mật khẩu, 2FA. Một người
dùng tự deploy; thêm vào chỉ là code chết. Bổ sung sau không ảnh hưởng thiết kế.

## 7. Lớp phiên

### 7.1 `AvatarSession`

Một đối tượng cho mỗi tài khoản avatar, bọc:

- `GameClient` (kết nối, handshake, đăng nhập, trạng thái game)
- `AutoFarm` và `MacroRunner` gắn với client đó
- Ring buffer log (~500 dòng) và traffic (~100 gói)
- Trạng thái supervisor: số lần thử lại, thời điểm thử tiếp theo

Giao diện: `start()`, `stop()`, `callFarm(name, args)`, `sendRaw(cmd, fields)`,
`setAutoConfig(cfg)`, `snapshot()`.

### 7.2 `SessionManager`

Giữ `Map<accountId, AvatarSession>`. Trách nhiệm:

- Tạo phiên khi cần, huỷ khi tài khoản bị xoá.
- Chặn ở `MAX_SESSIONS` (mặc định 20) để không vô tình mở hàng trăm socket TCP.
- **Bootstrap:** lúc server khởi động, đọc mọi tài khoản có `auto_enabled = 1` và
  bật lại, **giãn cách vài giây giữa các lần đăng nhập** để không mở một loạt phiên
  cùng lúc từ cùng một IP.

### 7.3 Nguồn sự thật và xử lý đứt kết nối

Cột `auto_enabled` trong DB là *ý muốn* của người dùng; trạng thái socket chỉ là hiện
thực đang đuổi theo ý muốn đó. Đây là thứ khiến "24/7 độc lập trình duyệt" thành thật.

- Rớt TCP hoặc bị server game đá ra, mà `auto_enabled = 1` → thử lại với backoff luỹ
  thừa có jitter: 5s, 10s, 20s, 40s… **trần 5 phút**.
- **Đăng nhập sai mật khẩu (nhận `-35`) → dừng hẳn**, đặt `auto_enabled = 0`, ghi lỗi,
  chờ người dùng sửa. Không thử lại.

Phân biệt lỗi tạm thời với lỗi vĩnh viễn là bắt buộc: server game có kiểm tra tần
suất độc lập với client, nên vòng lặp đăng nhập sai liên tục là đường ngắn nhất tới
khoá tài khoản.

### 7.4 Cách ly lỗi

Cái giá của việc dùng chung một process, phải trả đủ:

- Mọi handler sự kiện bọc `try/catch`.
- Mỗi `GameClient` gắn listener `'error'` — `EventEmitter` không có listener `error`
  sẽ ném và giết cả process, kéo theo mọi phiên khác.
- `process.on('unhandledRejection')` ghi log thay vì để process chết.

### 7.5 WebSocket

Khung tin: `{type, accountId, payload}`.

- Sự kiện nhẹ (`status`, `auto`) đẩy tới mọi client đã xác thực **của chính người sở
  hữu tài khoản đó**, để trang danh sách cập nhật trực tiếp.
- Sự kiện nặng (`traffic`, `log`, `farm`, `inventory`, `trees`, `money`) chỉ đẩy tới
  client của người sở hữu **và** đã `subscribe` accountId đó — tức trang chi tiết
  đang mở.
- Client gửi `{op: 'subscribe', accountIds: [...]}` khi vào/rời trang chi tiết.

## 8. API

Mọi endpoint đều qua `requireAuth`, và **mọi thao tác trên `:id` phải xác nhận
`avatar_accounts.user_id === req.user.id`** — kiểm ở REST lẫn WS subscribe, không
dựa vào việc giao diện không hiển thị id lạ.

| Endpoint | Việc |
|---|---|
| `GET /api/accounts` | danh sách + trạng thái runtime (status, auto, xu, lỗi gần nhất) |
| `POST /api/accounts` | `{label, gameUser, gamePass, host?, port?}` |
| `PATCH /api/accounts/:id` | sửa; `gamePass` chỉ đổi khi gửi lên, bỏ trống là giữ nguyên |
| `DELETE /api/accounts/:id` | dừng phiên rồi mới xoá |
| `POST /api/accounts/:id/connect` · `/disconnect` | thay `/api/login` · `/api/logout` |
| `POST /api/accounts/:id/auto/start` · `/auto/stop` | ghi DB trước, rồi mới áp dụng vào phiên |
| `POST /api/accounts/:id/farm` | `{name, args}` — gọi method của `FarmService` |
| `POST /api/accounts/:id/raw` | `{cmd, fields}` |
| `POST /api/accounts/:id/macro/start` · `/macro/stop` | như cũ |
| `GET /api/accounts/:id/state` · `/traffic` · `/packet/:cmd` | như cũ |

Bất biến: **response không bao giờ chứa mật khẩu game**, kể cả dạng đã mã hoá — chỉ
có cờ `hasPassword`. Mật khẩu đi một chiều vào server và chỉ ra ngoài qua socket game.

`auto/start` ghi `auto_enabled` và `auto_config_json` vào DB **trước** khi tác động
vào phiên, vì DB là nguồn sự thật cho bootstrap; làm ngược lại thì restart giữa chừng
là mất ý muốn của người dùng.

## 9. Giao diện

| Route | Nội dung |
|---|---|
| `/login` | form email + mật khẩu |
| `/register` | thêm ô mã mời |
| `/accounts` | bảng: nhãn, tài khoản game, badge trạng thái (offline / đang kết nối / online / lỗi), công tắc auto, số xu, nút vào chi tiết và xoá; kèm form "Thêm tài khoản". Cập nhật trực tiếp qua WS. |
| `/accounts/:id` | header (nhãn, trạng thái, nút Kết nối/Ngắt) + hai tab |

Tab của trang chi tiết:

- **Vận hành** — `AutoFarmPanel` (cấu hình + bật/tắt), `AssetsPanel` (xu, kho, cây,
  vật nuôi), `LogPanel` (nhật ký hoạt động).
- **Debug** — bảng action `FarmService` từ `actions.ts`, gói raw, log gói tin. Nguyên
  phần công cụ reverse hiện có, để dò tiếp opcode khi cần.

Chưa đăng nhập thì mọi route đá về `/login`. Lớp `api.ts` gặp 401 cũng tự điều hướng
về `/login`, xử lý trường hợp phiên hết hạn khi tab đang mở.

## 10. Kiểm thử

Dùng `node:test` sẵn có (`tsx --test`), không thêm framework. Viết test trước cho các
phần có logic thật:

- `secretBox` — khứ hồi; đổi AAD (gán bản mã sang account khác) phải thất bại; sai
  khoá phải thất bại.
- `auth/sessions` — tạo/tra/hết hạn/gia hạn; khẳng định DB chỉ chứa hash chứ không
  chứa id gốc.
- `accounts/repo` — CRUD; cách ly theo `user_id`: user A không đọc/sửa được tài khoản
  của user B.
- routes auth — đăng ký sai mã mời bị chặn; 10 lần đăng nhập sai ra 429; gọi
  `/api/accounts` không cookie ra 401.
- `SessionManager` với `GameClient` giả — rớt kết nối thì backoff tăng dần; gặp `-35`
  thì dừng hẳn và đặt `auto_enabled = 0`; bootstrap có giãn cách.

**Không** viết test tự động cho `proto/` và `game/`: chúng chỉ có nghĩa khi nói chuyện
với server game thật, và bắn gói vào server thật trong test là ý tồi. Phần đó kiểm thủ
công bằng tài khoản thật, như hiện tại.

## 11. Cấu hình và chuyển đổi

Biến môi trường mới:

| Biến | Ý nghĩa |
|---|---|
| `MASTER_KEY` | 32 byte base64, khoá mã hoá mật khẩu game. Bắt buộc. |
| `INVITE_CODE` | mã mời để đăng ký. Bắt buộc. |
| `PORT` | mặc định 8787 |
| `MAX_SESSIONS` | mặc định 20 |
| `NODE_ENV` | `production` bật cookie `Secure` |

Kèm `npm run gen-key` sinh `MASTER_KEY` ngẫu nhiên. **Server từ chối khởi động nếu
thiếu `MASTER_KEY` hoặc `INVITE_CODE`** — dừng ngay còn hơn lặng lẽ chạy bằng khoá
mặc định.

Chuyển đổi: file `avatar-web/account` không tự nhập vào DB. Người dùng thêm tài khoản
qua UI một lần rồi xoá file. Viết code import dùng-một-lần cho một bản ghi là thừa.

## 12. Ngoài phạm vi

- Xác thực email, quên mật khẩu, đổi mật khẩu, 2FA.
- Lịch chạy theo khung giờ cho auto-farm.
- Nhiều người dùng đăng ký tự do và hạn mức tài nguyên theo người dùng.
- Nhật ký hoạt động lâu dài trong DB.
- Sửa đổi logic `proto/` và `game/`.
