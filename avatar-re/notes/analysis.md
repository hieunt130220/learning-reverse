# Phân tích logic game — com.TeaM.Avatar (Avatar HD)

> Nguồn: `il2cpp_out/dump.cs` (Assembly-CSharp). Bodies chỉ có chữ ký + RVA;
> logic thật nằm trong `libil2cpp.so` tại các RVA ghi kèm. Hook động bằng
> frida-il2cpp-bridge theo **tên class/method** (không cần RVA).

## Kiến trúc tổng thể
Đây là game mobile kiểu **TeaMobi** (giống Ninja School/Avatar/SAO cũ) port sang Unity/IL2CPP.
Không phải HTTP REST — dùng **TCP socket + giao thức nhị phân tự chế**.

- `Session_ME : ISession` — phiên TCP (TcpClient + NetworkStream + BinaryReader/Writer), đa luồng
  (initThread/collectorThread/sendThread).
- `Message` — 1 gói tin: `sbyte command` + `myReader dis` / `myWriter dos` (body nhị phân).
- `Cmd_Message` — bảng **opcode** (hàng trăm hằng sbyte).
- `*MsgHandler` — bộ xử lý theo tính năng: `AvatarMsgHandler`, `ClanMsgHandler`, `FarmMsgHandler`,
  `HomeMsgHandler`, `MarketMsgHandler`, `MiniGameMsgHandler`, `CasinoMsgHandler`, `AincradMsgHandler`…

## 1) Mã hóa giao thức (XOR cuộn key kiểu TeaMobi)
Class `Session_ME`, các field/method chốt:

| Thành phần | RVA (libil2cpp.so arm64) | Vai trò |
|---|---|---|
| `sbyte[] key` (0x88) | field | Khóa nhận từ server khi kết nối |
| `sbyte curR` (0x90), `sbyte curW` (0x91) | field | Chỉ số cuộn key khi đọc/ghi |
| `bool getKeyComplete` (0x80) | field | Đã nhận key xong chưa |
| `readKey(sbyte b)` | `0x679F04` | Giải mã 1 byte đọc vào |
| `writeKey(sbyte b)` | `0x679E98` | Mã hóa 1 byte gửi đi |
| `Session_ME.MessageCollector.getKey(Message)` | `0x7FF624` | Nhận & set `key` từ gói đầu tiên |
| `doSendMessage(Message m)` | `0x6798E0` | Đóng gói + mã hóa gói gửi |
| `MessageCollector.readMessage()` | `0x7FF008` | Đọc + giải mã gói nhận |

**Thuật toán** (đặc trưng TeaMobi, cần xác nhận tại RVA hoặc hook): mỗi byte `b` được XOR với
`key[cur]` rồi `cur = (cur+1) % key.length`. Đọc dùng `curR`, ghi dùng `curW`. Trước khi
`getKeyComplete=true` thì gói gửi/nhận ở dạng thô (thường gói `getKey` truyền plaintext).

→ **Cách đọc traffic rõ ràng**: hook `writeKey`/`readKey` in cặp (byte gốc ↔ byte mã hóa), hoặc
hook `Message.reader()/writer()` để dump body đã giải mã. Xem `frida_scripts/agent.ts`.

## 2) Luồng đăng nhập
Class `LoginScr : MyScreen` — field `TField tfUser` (0x38), `TField tfPass` (0x40), `passRemem` (0xD0).

| Method | Ý nghĩa |
|---|---|
| `doLogin()` | Nút Login → gom user/pass |
| `login()` | Gửi gói đăng nhập |
| `onLoginNewGame(name, pass)` / `onLoginNewGame(imei)` | Đăng nhập tài khoản mới / theo IMEI |
| `onRegisterByEmail(name, pass)` | Đăng ký |
| `doForgetPass(user)` / `saveLogin()` / `loadLogin()` | Quên mật khẩu / lưu-nạp thông tin đăng nhập |

Opcode liên quan (trong `Cmd_Message`): `LOGIN_ACC = -33`, `LOGIN_IMEI = -32`, `LOGIN_NEW_GAME = -42`,
`LOGIN_SUCESS = -34`, `LOGIN_FAIL = -35`, `VERSION = -37`, `REQUEST_REGISTER = -30`, `REGISTER_BY_EMAIL = -91`.

→ **Bắt credential**: hook `LoginScr.doLogin` / `onLoginNewGame` để đọc user/pass, hoặc bắt trực tiếp
ở tầng `writeKey` khi command = `LOGIN_ACC`.

## 3) Anti-cheat (client-side → bypass dễ)
Class `AntiCheat : MonoBehaviour`. Hoàn toàn phía client, chỉ 3 loại:
`SPEED_HACK=0`, `TELEPORT_HACK=1`, `SPAM_CHAT_HACK=2`.

| Method | RVA | Ghi chú |
|---|---|---|
| `detectHackSpeed()` | `0xA40D44` | So `timeDiff` giữa các frame |
| `detectHackTeleport()` | `0xA41010` | Kiểm tra dịch chuyển bất thường |
| `HackDetected(int type)` | `0xA40F90` | Xử lý khi phát hiện (đặt `detected=true`, báo server) |
| `detected` (static, 0x10) | field | Cờ đã phát hiện |

→ **Bypass**: cho `HackDetected` thành no-op và/hoặc ép `detected=false`, hoặc override
`detectHackSpeed/Teleport` rỗng. Lưu ý: server vẫn có thể có kiểm tra riêng (movement validation).

## 4) Hạ tầng mạng / endpoint cứng
- Danh sách server (IP:port) nạp động từ text:
  - `http://27.0.14.120/svrip/avahd_android.txt`
  - `http://27.0.14.120/svrip/avahd_android2.txt`
- Nạp/IAP: `http://27.0.14.107/inappav3/gg/index.php`, `pay.teamobi.com`
- Publisher: `my.teamobi.com`, `m.me/avt.teamobi`
- Class hỗ trợ: `ServerListScr`, `ServerOptionScr` (chọn server), `Net`/`NetRes` (HTTP phụ trợ).

## 5) Điểm đáng chú ý khác
- `AesCryptoServiceProvider`, `RSAManaged`, `PKCS1/7/8`, `ARC4Managed` xuất hiện — phần lớn là thư viện
  mono chuẩn (dùng cho TLS/IAP receipt), **không phải** crypto của giao thức game (giao thức dùng XOR key).
- IAP: `GooglePurchaseData`, `ReceiptData`, `PurchasingManager` — kiểm tra receipt Google Play.
- `MsgDlg`, `Canvas` (game canvas, không phải HTML) là khung UI game engine tự chế.

## Packet parser (đã viết sẵn)
`frida_scripts/parser.ts` (+ `opcodes.ts` sinh từ Cmd_Message: **289 opcode / 214 value**).
Hook ở **tầng Message** nên tự động thấy dữ liệu đã giải mã:
- TX: `Session_ME.sendMessage(Message)` — gói trước khi mã hóa (`writeKey`).
- RX: `Session_ME.onRecieveMsg(Message)` — gói đã giải mã (`readKey`).
Với mỗi gói in: `cmd` (số) + tên opcode (tra `cmdName`) + `len` + **hex + ascii + decode** của `getData()`.

**Smart decode (writeUTF)**: đi dọc body, tại mỗi offset thử đọc `writeUTF` = short 2-byte BE (độ dài)
+ khối UTF-8. Nếu khối hợp lệ (≥2 ký tự, tỉ lệ đọc được ≥0.85, và length khớp phần còn lại) thì in
`str[len]="..."`; ngược lại in `i8=<byte>` (kèm giá trị có dấu). Hỗ trợ UTF-8 tiếng Việt.
Kiểm tra hợp lý của length giúp không nhầm dữ liệu số thành chuỗi. Ví dụ output:
```
[TX] cmd=-33 (LOGIN_ACC)  len=21
      decode: @0 str[5]="admin"  @7 str[9]="secret123"  @18 i8=1 ...
```
**Số nhiều byte (writeInt/Short/Long)**: các "run" byte không phải chuỗi được gộp greedy —
ăn `~i32` khi còn ≥4 byte, `~i16` khi còn 2, `~i8` cho phần lẻ; run đúng 8 byte in cả
`~i64` lẫn `~i32×2` (vì nhập nhằng long vs 2 int). Dấu `~` = suy đoán (không có thông tin kiểu
trong stream). Ví dụ: `@0 ~i32=1000000  @4 ~i16=300  @6 str[2]="hi"`.

**Schema chính xác (khuyến nghị)**: khai báo layout thật của opcode trong `SCHEMAS` (parser.ts) để
decode đúng 100% kèm tên field, không còn suy đoán:
```ts
const SCHEMAS = {
  LOGIN_ACC:  [{t:"utf",name:"user"}, {t:"utf",name:"pass"}, {t:"i8",name:"type"}],
  LOGIN_IMEI: [{t:"utf",name:"imei"}],
  // t ∈ i8|u8|bool|i16|u16|i32|i64|utf|bytes
};
```
→ `[schema LOGIN_ACC] user:utf="admin"  pass:utf="secret"  type:i8=1`.
Khi gói còn dư byte ngoài schema, phần đuôi tự auto-decode. Điền dần SCHEMAS bằng cách đọc thứ tự
`read*/write*` trong handler tương ứng ở dump.cs.

Giới hạn: auto vẫn là heuristic (chuỗi 1 ký tự, hoặc byte-flags trông giống int). Dòng `hex`/`ascii`
gốc luôn giữ để chia lại thủ công; muốn chắc chắn thì dùng SCHEMAS.

```bash
cd frida_scripts && npm run build:parser        # -> _parser.js
frida -U -f com.TeaM.Avatar -l _parser.js
```
Lưu ý: nhiều value sbyte bị **dùng lại** ở nhiều ngữ cảnh (vd `127` = 12 tên, `-107` = 2 tên) nên
parser in tất cả tên ứng viên ngăn cách bằng `|`. Muốn phân giải chính xác phải xét theo màn hình/
handler đang hoạt động. Giải nghĩa **field bên trong body** là việc theo từng opcode (đọc handler
tương ứng trong dump.cs, vd `AvatarMsgHandler`, `ShopScr`…).

## Reference theo tính năng
- **Nông trại**: `notes/farm.md` — bảng opcode farm, TX schema (FarmService), cấu trúc RX (CellFarm/FarmData).
- **Đăng nhập**: `notes/login.md` — GlobalService (TX: login/register), GlobalMessageHandler (RX: LOGIN_SUCESS/FAIL).

## Việc nên làm tiếp
1. Mở `libil2cpp.so` trong IDA/Ghidra, apply `script.json` + `il2cpp.h`, tới RVA `0x679E98`/`0x679F04`
   xác nhận công thức XOR key chính xác.
2. Hook động bằng `frida_scripts/agent.ts` để dump traffic đã giải mã và bắt login.
3. (Tùy mục tiêu) viết parser gói tin theo `Cmd_Message` để log/replay.
