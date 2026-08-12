# Giao thức mạng — com.TeaM.Avatar 3.4.4

> Mọi mục đánh ✅ đọc trực tiếp từ disassembly `libil2cpp.so` (arm64) hoặc kiểm chứng
> bằng thực nghiệm với server thật, **không phải suy đoán**. Mục ⚠ là chưa chốt.

## Endpoint

`http://27.0.14.120/svrip/avahd_android.txt` → `27.0.14.67 19129 27.0.14.120 19129`
(cặp `ip port`). Port 19129 xác nhận đang mở trên cả 2 IP; các port khác timeout.

## ✅ Khung gói tin

```
[cmd:1][len:2 BE][body:len]
```
- `doSendMessage` @0x6798E0 — TX **luôn** dùng độ dài 2 byte, kể cả các cmd mà RX
  dùng 4 byte. Khi `data == null` vẫn ghi 2 byte 0.
- `readMessage` @0x7FF008 — RX dùng 2 byte, **trừ** `cmd ∈ {-69, -51, -44, 79}` thì
  đọc 4 byte (rẽ sang `readMessage2` @0x7FF870, gói ảnh/resource lớn có progress bar).
- Big-endian ở cả nhánh chưa có khóa (kiểm chứng: server trả lời gói BE, im lặng với LE).

## ✅ Mã hoá — XOR cuộn khóa

`writeKey` @0x679E98 / `readKey` @0x679F04, hai con trỏ độc lập `curW` (0x91), `curR` (0x90):

```
out = key[cur] ^ b
cur = (cur + 1) % key.length
```

Trước khi `getKeyComplete` (0x80) bật thì cả 2 chiều là plaintext.

## ✅ Trao khóa

`MessageCollector.run` @0x7FEC6C: gói nào có `command == -27` thì đưa vào `getKey`,
còn lại vào `onRecieveMsg`.

`getKey` @0x7FF624:
```
len = readByte()
key = read(len) bytes
for i in 0..len-2:  key[i+1] ^= key[i]      // prefix-XOR cuộn dồn
getKeyComplete = true
```

**Điểm static analysis không lộ ra, phải thử mới biết:** server **không** chủ động
gửi khóa. Client phải gửi gói `-27` rỗng (`e5 00 00`) thì server mới trả về, ví dụ thật:

```
RX: e5 0011 10 ad064d4dddc888fd2433197725b5db28
    cmd=-27  len=17  klen=16  <16 byte khóa>
```
Khóa đổi mỗi lần kết nối. Parse đúng 100% bằng code trong `avatar-web/server/src/proto/session.ts`.

## ✅ Body — myWriter / myReader

Clone Java DataOutputStream, **big-endian toàn bộ** (`writeShort` @0x833368 dịch bit
từ 8 xuống 0). `writeUTF` @0x8335FC = `[u16 BE độ dài byte][UTF-8]`.

## ✅ Gói handshake sau khi có khóa

`GlobalService.setProviderAndClientType` @0x698898 — 3 gói liên tiếp:

| cmd | tên | body |
|---|---|---|
| -1 | GET_HANDLER | `i8 GameMidlet.CLIENT_TYPE` |
| -47 | SET_PROVIDER | `i8 PROVIDER`, `i32 SystemInfo.systemMemorySize`, `utf SystemInfo.deviceModel`, `i32 10000`, `i32 screenW`, `i32 screenH`, `bool true`, `i8 1`, `utf version`, `utf IMEI`, `i8 DEVICE` |
| -79 | SET_AGENT | `utf GameMidlet.AGENT` |

`GlobalService.getServerLoginInfo` @0x699478 — `-87` + `i8 1`. Đây là **request duy nhất
ở giai đoạn trước đăng nhập có phản hồi**, rất hữu ích để kiểm chứng kết nối: server
trả `-87` dài ~1499 byte chứa text "HƯỚNG DẪN CHƠI MỚI…".

### ⚠ Bẫy: tham số thứ 3 của login KHÔNG phải version

`GlobalService.login` @0x6991C8 — `LOGIN_ACC (-33)`: `utf`, `utf`, `utf`. Metadata đặt tên
tham số là `(username, pass, version)` **nhưng call site nói khác**: tại `LoginScr` @0x60876C
đối số thứ 3 nạp từ `GameMidlet[+0x58]` = **`IMEI`** (`SystemInfo.deviceUniqueIdentifier`),
và username đi qua `String.ToLower()` @0x60871C trước. Vậy body thật là:

```
utf user.toLowerCase()   utf pass   utf IMEI
```

Bài học: tên tham số trong metadata chỉ là gợi ý — phải đọc call site mới biết giá trị thật.

`GlobalService.login()` (không tham số) @0x699324 là đường khác: `LOGIN_IMEI (-32)` + `utf imei`.

### Hằng từ `GameMidlet..cctor` @0x5E0A4C
| Field | Giá trị |
|---|---|
| `CLIENT_TYPE` | 8 |
| `PROVIDER` | 0 |
| `DEVICE` | 0 |
| `CLIENT_ANDROID / IPHONE / WINPHONE` | 1 / 2 / 4 |
| `VERSIONCODE` | 13 |
| `version` | `Application.version` = `3.4.4` (khớp `versionName` trong apktool.yml) |
| `IMEI` | `SystemInfo.deviceUniqueIdentifier` |
| `AGENT` | ⚠ string literal chưa phân giải được từ metadata cache |

## Kết quả thực nghiệm với server thật

| Thử | Kết quả |
|---|---|
| Kết nối, không gửi gì | server im lặng, giữ kết nối — **không tự gửi khóa** |
| Gửi `-27` rỗng (plaintext) | ✅ trả gói khóa đúng cấu trúc đã reverse |
| Sau khi có khóa: gửi `-27` **đã mã hoá** | ✅ trả gói khóa mới, giải mã ra đúng `cmd=-27 len=17` |
| Sau khi có khóa: `-87` + `i8 1` | ✅ trả 1499 byte text tiếng Việt sạch |
| `-1` / `-47` / `-79` | im lặng — đúng bản chất, chúng là lệnh **setter** không có phản hồi |
| Plaintext `-47` khi chưa trao khóa | trả `cmd -40` *"Mời bạn tải phiên bản mới…"* |
| `-33` / `-32` / `-30` với tài khoản không tồn tại | im lặng |

→ **Toàn bộ tầng giao thức đã kiểm chứng đầu-cuối**: khung gói, XOR cuộn khóa cả hai
chiều, trao khóa, gom nhiều gói trong một TCP segment, chuỗi UTF tiếng Việt.

### Gói `-40` KHÔNG phải lỗi phiên bản

Play Store `com.TeaM.Avatar` hiện là **3.4.4** — đúng bằng APK đang reverse (versionCode
3096, minSdk 26). Nên `-40` *"Mời bạn tải phiên bản mới"* là **phản hồi rác khi server
không parse được stream** (ở đây là do ta nói plaintext trong khi nó chờ dữ liệu đã mã
hoá), không phải kết quả của việc so version. Đừng đi theo hướng "tìm bản mới hơn".

## ⚠ Hai IP trong svrip KHÔNG phải hai game server ngang hàng

`27.0.14.67 19129 27.0.14.120 19129` — cả hai đều mở port, đều trao khóa, đều trả lời
`getServerLoginInfo`. Nhưng **chỉ `27.0.14.120` xử lý `LOGIN_ACC`**; `27.0.14.67` nhận
gói login rồi im lặng hoàn toàn (nhiều khả năng là `IPDATA/PORTDATA` — server dữ liệu).

Đây là lý do thật của việc "login không phản hồi", **không** phải sai `CLIENT_TYPE`
(đã quét 0/1/2/4/8 trên cả 2 host: giá trị này không ảnh hưởng gì).

## Phản hồi đăng nhập

| cmd | Ý nghĩa | Body |
|---|---|---|
| -40 | **Hộp thoại thông báo chung** của server | `utf text` |
| -34 | `LOGIN_SUCESS` — kết quả đăng nhập | `i8`, `i32 id`, `i16` |

`-40` không phải lỗi cố định: cùng opcode mang cả *"Mời bạn tải phiên bản mới…"* (khi
server không parse được stream) lẫn *"Tên đăng nhập hoặc mật khẩu không chính xác"*.
Đừng suy ra ý nghĩa từ opcode, phải đọc text.

`-34` được gửi **cả khi đăng nhập hỏng**, khi đó `id = -1`. Sai thì cặp gói là
`-40 (lý do)` + `-34 (id=-1)`; đúng thì `id` là id nhân vật thật.

## ✅ Vào nông trại: phải xin handler trước

Gửi thẳng `doJoinFarm (69)` sau khi đăng nhập thì **server im lặng** — lệnh farm chỉ
được định tuyến khi phiên đang ở handler farm. Cách vào:

```
GlobalService.getHandler(sbyte)  @0x69b674   ->  cmd -1 + i8 handlerId
```

`GlobalLogicHandler.doGetHandler` @0x5E4974 (handler RX của `-1`) rẽ nhánh theo id:
`3` = casino, **`8` / `9` / `10` = farm** (nhánh farm gọi `FarmMsgHandler.onHandler`
→ `FarmScr.init` → `FarmScr.doJoinFarm`).

Thực nghiệm trên tài khoản thật:

| Gửi | Nhận |
|---|---|
| `-1` + `i8 8` | `-1` + `i8 8` |
| `-1` + `i8 9` | `-1` + `i8 9`, kèm `-57 WEATHER` |
| **`-1` + `i8 10`** | **`69 JOIN` 619 byte = toàn bộ dữ liệu farm**, rồi `-1` + `i8 10` |

Nên `enterFarm()` = `getHandler(10)`: server tự đẩy gói farm về, không cần gửi `69`.

## Công cụ: tools/xrefs.py

Tìm nơi gọi một hàm mà không cần IDA/Ghidra — giải mã trực tiếp opcode `BL`/`B`
trên toàn file rồi quy địa chỉ về tên method qua `script.json`:

```bash
python3 tools/xrefs.py 'FarmService\$\$doJoinFarm'
python3 tools/xrefs.py 0x8fd19c
```
Chính tool này chỉ ra `doJoinFarm` chỉ có đúng 1 chỗ gọi (`FarmScr.doJoinFarm`), từ đó
lần ngược ra `doGetHandler` và cơ chế handler ở trên.

## Nếu cần đối chiếu thêm

Bắt traffic phiên chơi thật — không cần root, không cần Frida. Vì gói khóa truyền
**plaintext**, một bản pcap bất kỳ là đủ để giải mã cả phiên bằng code trong
`avatar-web/server/src/proto/`:

```bash
# bật Internet Sharing trên Mac, cho điện thoại vào mạng đó
sudo tcpdump -i bridge100 -w avatar.pcap host 27.0.14.120
```

## Công cụ

- `tools/pktsig.py` — trích schema gói tin từ thân hàm: disassemble, phân giải mọi `bl`
  bằng `script.json`, in ra chuỗi `Message(cmd)` + `myWriter.write*` / `myReader.read*`
  theo thứ tự. Đây là ground truth cho width; **chữ ký C# không đáng tin** (khai `int`
  nhưng `writeByte` thật rất nhiều).
  ```bash
  python3 tools/pktsig.py 'FarmService\$\$'
  python3 tools/pktsig.py 'GlobalService\$\$login'
  ```
  Giới hạn: liệt kê theo thứ tự địa chỉ trong hàm — đúng tuyệt đối với hàm thẳng
  (mọi `do*` của FarmService), có thể lệch với hàm nhiều nhánh/vòng lặp (các `read*` RX).

- `avatar-web/server/src/tools/` — probe chạy với server thật:
  `probe.ts` (kiểm tra khung gói + khóa), `raw-probe.ts` (byte thô),
  `handshake-probe.ts` (quét biến thể gói mồi), `version-probe.ts` (thử version).

## ✅ Server ngắt client im lặng — phải tự giữ nhịp

`Cmd_Message` **không có opcode ping/keep-alive nào**, nhưng server vẫn đóng kết nối
với client không gửi gì trong khoảng ~2 phút. Đo được nhiều phiên chết đúng ~2 phút sau
đăng nhập, kể cả khi ngay trước đó vừa trao đổi thành công (nên không phải lỗi lệnh).

Cách khắc phục: gửi một request nhẹ có phản hồi theo chu kỳ. Dùng `getInventory`
(cmd 70, trả ~148 byte) mỗi 45 giây.

| Đo | Kết quả |
|---|---|
| Không keep-alive | chết ~120s sau đăng nhập |
| keep-alive 45s | sống 361s liên tục, vẫn online khi dừng đo |

⚠ Khi chẩn đoán, nhớ là **mọi tool tự tạo `GameClient` riêng đều mở phiên thứ hai trên
cùng tài khoản và đá phiên đang chạy**. Nhiều lần "server tự ngắt" hoá ra là do chính
tool chẩn đoán, hoặc do `tsx watch` nạp lại khi có file mới trong thư mục server.
Dùng `GET /api/traffic` thay vì tạo script tạm.
