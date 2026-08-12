# avatar-web — điều khiển nông trại Avatar từ trình duyệt

Client headless nói chuyện trực tiếp với server game bằng giao thức nhị phân đã
reverse (`../avatar-re/notes/protocol.md`), kèm web UI để bấm hành động và xem gói tin.

Trình duyệt không mở được TCP socket thô, nên kiến trúc là:

```
web (Vite/React) ──HTTP + WebSocket──► server (Node)  ──TCP 19129──► server game
                                        └ giữ phiên, mã hoá XOR, hàng đợi action
```

## Chạy

```bash
cd server && npm install && npm run dev     # cổng 8787
cd web    && npm install && npm run dev     # cổng 5173, đã proxy /api và /ws
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
| Web UI (action, macro, log gói tin) | ✅ |

### Bước tiếp theo: thử tài khoản thật

Với tài khoản không tồn tại, server im lặng (không trả `LOGIN_FAIL`) nên chưa kết luận
được. Chạy app rồi đăng nhập bằng tài khoản của bạn — trong nhật ký sẽ thấy
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
├── macro.ts         # chạy chuỗi action lặp theo chu kỳ
├── index.ts         # REST + WebSocket
└── tools/           # probe chạy với server thật (xem protocol.md)
```

## API

| Endpoint | Việc |
|---|---|
| `POST /api/login` | `{host, port, user, pass, device?}` |
| `POST /api/logout` | ngắt kết nối |
| `POST /api/farm` | `{name, args}` — gọi thẳng method của `FarmService` |
| `POST /api/raw` | `{cmd, fields:[{t,v}]}` — gói tự do để dò opcode |
| `POST /api/macro/start` / `stop` | chuỗi action lặp |
| `GET /api/state` | trạng thái hiện tại |
| `WS /ws` | đẩy status / log / gói tin theo thời gian thực |

## Lưu ý

Chỉ dùng với tài khoản của chính bạn. Server có kiểm tra phía nó (validate hành động,
tần suất) độc lập với `AntiCheat` phía client, nên macro để delay quá thấp dễ bị
từ chối hoặc khoá tài khoản — mặc định giữa các bước có delay là vì thế.
