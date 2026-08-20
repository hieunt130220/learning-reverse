# avatar-web — điều khiển nông trại Avatar từ trình duyệt

Client headless nói chuyện trực tiếp với server game bằng giao thức nhị phân đã
reverse (`../avatar-re/notes/protocol.md`), kèm web UI có tài khoản người dùng để
quản lý nhiều tài khoản game và chạy auto-farm 24/7 trên server.

Trình duyệt không mở được TCP socket thô, nên kiến trúc là:

```
trình duyệt ──HTTPS──► reverse proxy ──HTTP──► server Node ──TCP 19129──► server game
                                                    │
                                                    ├── SQLite (users, phiên web, tài khoản avatar)
                                                    └── SessionManager: Map<accountId, AvatarSession>
```

Một process Node giữ toàn bộ: REST, WebSocket, và mọi phiên TCP tới server game.

## Chạy

```bash
cd server && npm install
npm run gen-key          # in ra MASTER_KEY, dán vào .env
cp .env.example .env     # rồi điền MASTER_KEY và INVITE_CODE
npm run dev              # cổng 8787

cd web && npm install && npm run dev     # cổng 5173, đã proxy /api và /ws
```

Server **từ chối khởi động** nếu thiếu `MASTER_KEY` hoặc `INVITE_CODE`.

| Biến | Ý nghĩa |
|---|---|
| `MASTER_KEY` | 32 byte base64, khoá mã hoá mật khẩu game. Bắt buộc. |
| `INVITE_CODE` | mã mời để đăng ký. Bắt buộc. |
| `PORT` | mặc định 8787 |
| `MAX_SESSIONS` | trần số phiên game cùng lúc, mặc định 20 |
| `DB_PATH` | mặc định `server/data/avatar-web.db` |
| `NODE_ENV` | `production` bật cookie `Secure` |
| `SHOP_READ_ENABLED` | bật đọc và browse dữ liệu sạp; mặc định tắt |
| `SHOP_WRITE_ENABLED` | master gate cho đăng bán, rút hàng và các shop write; mặc định tắt |
| `SHOP_PURCHASE_ENABLED` | gate bổ sung cho mua listing; chỉ có hiệu lực khi write đã bật |
| `SHOP_SLOT_UNLOCK_ENABLED` | gate riêng cho mở slot; mặc định tắt |
| `SHOP_MARKET_REFRESH_ENABLED` | gate riêng cho refresh chợ trả phí; mặc định tắt |
| `SHOP_LIVE_ACCOUNT_ALLOWLIST` | các `avatar_accounts.id` nội bộ, phân tách bằng dấu phẩy; ID là số `:id` trong `/accounts/:id` hoặc `/api/accounts/:id`; dùng `*` cho mọi account và không trộn hai dạng |
| `SHOP_PROTOCOL_DEBUG_ENABLED` | debug protocol chỉ ở non-production; mặc định tắt |

`SHOP_LIVE_ACCOUNT_ALLOWLIST=*` là quyền live-write toàn cục cho cả tài khoản thêm
mới. Chỉ dùng cùng các capability đã chủ động phê duyệt; wildcard không tự bật bất
kỳ capability nào.

Mở `http://localhost:5173`, đăng ký bằng mã mời, rồi thêm tài khoản game ở trang
danh sách.

```bash
cd server && npm test        # 125 test (node:test qua tsx)
cd server && npm run typecheck
cd web    && npm run build
```

## Trạng thái

| Phần | Trạng thái |
|---|---|
| Khung gói `[cmd][len:2 BE][body]` | ✅ khớp server thật |
| XOR cuộn khóa, `curR`/`curW` riêng | ✅ kiểm chứng đầu-cuối với server thật |
| Trao khóa (gửi `-27` rỗng → nhận khóa) | ✅ |
| Gửi/nhận gói đã mã hoá | ✅ `getServerLoginInfo` trả 1499 byte text đọc sạch |
| Schema TX của toàn bộ `FarmService` | ✅ trích từ native, không đoán |
| Đăng nhập | ⏳ chưa thử được bằng tài khoản thật |
| Web UI nhiều tài khoản (đăng nhập, danh sách, chi tiết, Debug) | ✅ |
| Auto-farm 24/7 trên server | ✅ bật lại sau restart theo `auto_enabled` |

### Bước tiếp theo: thử tài khoản thật

Với tài khoản không tồn tại, server im lặng (không trả `LOGIN_FAIL`) nên chưa kết luận
được. Thêm tài khoản qua UI rồi bấm Kết nối — trong nhật ký sẽ thấy
*"server phản hồi getServerLoginInfo — giải mã hai chiều OK"* trước khi gửi login;
nếu sau đó có `LOGIN_SUCESS (-34)` là xong, có `-35` là sai mật khẩu, còn im lặng thì
body `LOGIN_ACC` vẫn thiếu gì đó.

Hoặc chạy nhanh không cần UI:

```bash
cd server && npx tsx src/tools/login-test.ts <user> <pass>
```

## Cấu trúc

```
server/src/
├── proto/           # tầng giao thức thuần, không dính game logic
│   ├── writer.ts    #   myWriter — big-endian, writeUTF = [u16 len][utf8]
│   ├── reader.ts    #   myReader
│   ├── message.ts   #   Message = sbyte command + body
│   └── session.ts   #   TCP + khung gói + XOR cuộn khóa
├── game/
│   ├── opcodes.ts   #   bảng 289 opcode sinh từ Cmd_Message
│   ├── farmService.ts #  port FarmService, width lấy từ native
│   └── client.ts    #   handshake + login + trạng thái
├── db/              # mở SQLite + schema.sql, migration chạy lúc khởi động
├── crypto/secretBox.ts  # AES-256-GCM encrypt/decrypt
├── auth/            # argon2id, phiên web, rate limit, middleware, /api/auth/*
├── accounts/        # CRUD avatar_accounts (mã hoá nằm trong repo) + /api/accounts
├── session/
│   ├── avatarSession.ts # GameClient + AutoFarm + MacroRunner + ring buffer + backoff
│   ├── manager.ts       # Map<accountId, AvatarSession>, bootstrap giãn cách
│   └── routes.ts        # /api/accounts/:id/* điều khiển phiên
├── autoFarm.ts      # vòng tự động chăm sóc nông trại
├── macro.ts         # chạy chuỗi action lặp theo chu kỳ
├── ws.ts            # WebSocket có xác thực, định tuyến theo accountId
├── index.ts         # chỉ lắp ráp
└── tools/           # probe chạy với server thật (xem protocol.md)

web/src/
├── main.tsx                 # react-router-dom, 4 route
├── api.ts                   # fetch wrapper, credentials: 'include', 401 -> /login
├── ws.ts                    # một kết nối WS dùng chung, subscribe theo accountId
├── types.ts
├── auth/{LoginPage,RegisterPage,useAuth}.tsx
└── accounts/
    ├── AccountsPage.tsx     # danh sách + form thêm
    ├── AccountDetailPage.tsx# header + tab Vận hành / Debug
    └── panels/{StatusPanel,AutoFarmPanel,AssetsPanel,LogPanel,DebugPanel}.tsx
```

## API

Mọi endpoint đều cần đăng nhập, và mọi thao tác trên `:id` đều xác nhận
`avatar_accounts.user_id === req.user.id`.

| Endpoint | Việc |
|---|---|
| `POST /api/auth/register` | `{email, password, inviteCode}` |
| `POST /api/auth/login` · `/logout` | phiên web qua cookie `sid` |
| `GET /api/auth/me` | `{id, email}` |
| `GET /api/accounts` | danh sách + trạng thái runtime (status, auto, xu, lỗi gần nhất) |
| `POST /api/accounts` | `{label, gameUser, gamePass, host?, port?}` |
| `PATCH /api/accounts/:id` | sửa; `gamePass` bỏ trống là giữ nguyên |
| `DELETE /api/accounts/:id` | dừng phiên rồi mới xoá |
| `POST /api/accounts/:id/connect` · `/disconnect` | mở/đóng phiên game |
| `POST /api/accounts/:id/auto/start` · `/auto/stop` | ghi DB trước, rồi mới áp vào phiên |
| `POST /api/accounts/:id/farm` | `{name, args}` — gọi method của `FarmService` |
| `POST /api/accounts/:id/raw` | `{cmd, fields:[{t,v}]}` — gói tự do để dò opcode |
| `POST /api/accounts/:id/enter-farm` | xin handler farm |
| `POST /api/accounts/:id/macro/start` · `/macro/stop` | chuỗi action lặp |
| `GET /api/accounts/:id/state` · `/traffic` · `/packet/:cmd` | trạng thái, log gói tin |
| `WS /ws` | `{type, accountId, payload}` — xác thực bằng chính cookie `sid` |

Response **không bao giờ chứa mật khẩu game**, kể cả dạng đã mã hoá — chỉ có cờ
`hasPassword`.

## Mật khẩu game được lưu thế nào

Mã hoá AES-256-GCM, khoá đọc từ `MASTER_KEY` trong môi trường của service, AAD buộc
theo id bản ghi nên không chép bản mã từ tài khoản này sang tài khoản khác được.

Auto chạy 24/7 buộc server phải tự đọc lại được mật khẩu khi khởi động lại mà không
cần người dùng có mặt — nên khoá phải nằm trong env chứ không dẫn xuất được từ mật
khẩu đăng nhập. Ai chiếm được VPS thì có cả khoá lẫn DB. Đó là giới hạn cố hữu của
yêu cầu 24/7, không phải sơ suất.

Mất `MASTER_KEY` = mất toàn bộ mật khẩu game đã lưu, phải nhập lại từng tài khoản.

## Auto 24/7 và xử lý đứt kết nối

Cột `auto_enabled` trong DB là *ý muốn* của người dùng; trạng thái socket chỉ là hiện
thực đang đuổi theo ý muốn đó.

- Rớt TCP hoặc bị server game đá ra khi `auto_enabled = 1` → thử lại với backoff luỹ
  thừa có jitter: 5s, 10s, 20s, 40s… trần 5 phút.
- Đăng nhập sai mật khẩu (nhận `-35`) → **dừng hẳn**, đặt `auto_enabled = 0`, ghi lỗi,
  chờ người dùng sửa. Không thử lại — vòng lặp đăng nhập sai liên tục là đường ngắn
  nhất tới việc bị khoá tài khoản.
- Lúc server khởi động, mọi tài khoản `auto_enabled = 1` được bật lại, giãn cách 5 giây
  một lần để không mở một loạt phiên cùng lúc từ cùng một IP.

Nhật ký hoạt động **không vào DB**: mỗi phiên giữ ring buffer 500 dòng log và 100 gói
trong RAM. Restart server thì mất log — đánh đổi có chủ ý để schema gọn.

## Lưu ý

Chỉ dùng với tài khoản của chính bạn. Server có kiểm tra phía nó (validate hành động,
tần suất) độc lập với `AntiCheat` phía client, nên macro để delay quá thấp dễ bị
từ chối hoặc khoá tài khoản — mặc định giữa các bước có delay là vì thế.
