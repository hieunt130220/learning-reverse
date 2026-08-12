# Tiến độ reverse — com.TeaM.Avatar (handoff)

> File này để bắt đầu chat mới. Target là **game Unity IL2CPP** (TeaMobi), giao thức **TCP nhị phân**
> (không HTTP). Chi tiết từng mảng ở `analysis.md`, `farm.md`, `login.md`, `fishing.md`.

## Môi trường (đã cài, verify OK)
- Bộ chuẩn: `jadx 1.5.6`, `apktool 3.0.3`, `adb`, `frida 17.17.0` (venv `~/re-tools/frida-venv`, symlink `~/.local/bin`).
- IL2CPP: `Il2CppDumper` (dotnet 10) → `il2cpp_out/` (dump.cs 5947 class, il2cpp.h, script.json).
- APK giải nén: `apk_extracted/`. libil2cpp arm64: `apk_extracted/lib/arm64-v8a/libil2cpp.so`.
- ⚠ macOS 26 làm hỏng python homebrew (`mac_ver` rỗng) → dùng python do `uv` quản lý.

## Công cụ tự viết (dùng lại cho câu cá)
- `tools/iladis.py <RVA|tên> [n] [--sum|--calls]` — disassemble 1 hàm, resolve `bl` → tên method
  (qua script.json). `--sum` in `command + writes[...]`; `--calls` liệt kê mọi call (đọc luồng RX).
  ⚠ `n` là **positional** — phải gõ `iladis.py 0x71BBF0 200 --sum`, thiếu `n` thì crash.
  ⚠ `--sum`/mặc định dừng ở `ret`; hàm kết bằng tail-call `b` sẽ **tràn sang hàm kế** → đọc kỹ.
  Chạy: `~/re-tools/frida-venv/bin/python tools/iladis.py 0x…`
- `tools/jumptable.py` — giải jump-table (đã dùng cho FarmMsgHandler.onMessage).
- `tools/xrefs.py <regex|RVA>` — tìm mọi chỗ gọi 1 hàm (quét BL/B toàn file).

## Parser Frida — `frida_scripts/`
- `parser.ts` (+ `opcodes.ts` 289 opcode) → build `npm run build:parser` → `_parser.js`.
- Hook `Session_ME.sendMessage`(TX) / `onRecieveMsg`(RX), in cmd+tên+hex+ascii+decode.
- **SCHEMAS** (width verified): login (LOGIN_ACC/IMEI/REGISTER/FAIL) + ~29 opcode farm.
- **SCHEMAS_RX** — bảng riêng cho chiều RX, tra trước `SCHEMAS` khi `dir==="RX"` (cùng opcode
  nhưng layout TX ≠ RX). Hiện có 6 opcode câu cá.
- Decoder lồng nhau: `decodeFarmData` (RX cmd 61/69), `decodeEnterWorld` (RX cmd -34, gồm
  player/mapType/mapItem/anim/special), `decodeCanCau` (RX 79), `decodeFinishFishing` (TX 43).
  Helper REPL: `decodeListPlayer`, `decodeEnterWorld`.
- Chạy thật cần thiết bị root + frida-server 17.17.x (CHƯA chạy trên máy thật; mọi test = gói giả).

## Phương pháp (đã kiểm nghiệm)
1. Kiến trúc TeaMobi: `Session_ME` (socket, XOR-key `readKey/writeKey`), `Message{sbyte command + body}`,
   `Cmd_Message` = bảng opcode, `*MsgHandler`/`*Service` theo tính năng.
2. TX: đọc hàm `Service` bằng `iladis --sum` → `command (mov w1,#0x..)` + chuỗi `writeInt/Byte/Short/UTF`.
   **Bài học: kiểu C# `int` thường gửi bằng writeByte → phải verify tại RVA, đừng đoán.**
3. RX: `onMessage` thường là jump-table → dùng `jumptable.py`; sub-reader đọc bằng `--calls` + map
   `readX → str [obj,#offset]`. Loop = `readByte count` + `cmp #1/b.lt`.

## Đã hoàn tất
- **Giao thức lõi**: XOR-key `Session_ME` (readKey 0x679F04 / writeKey 0x679E98), Cmd_Message.
- **Login** (`login.md`): TX LOGIN_ACC(-33)=utf user/pass/version, LOGIN_IMEI(-32)=utf imei,
  REQUEST_REGISTER(-30)=utf×3. RX LOGIN_FAIL(-35)=utf, **LOGIN_SUCESS(-34)=enter-world đầy đủ**
  (player+SeriPart, mapItemType+AvPosition, mapItem, anim, special) — decode trọn, 0 byte dư.
- **Nông trại** (`farm.md`): TX 29 opcode (width verified), RX jump-table 53 command (51-103),
  `readFarmData` (cmd 61/69) + readInfoCell/readInfoAnimal + tail đầy đủ.
- **Câu cá** (`fishing.md`): nằm ở **Park** chứ không phải Farm — `ParkService` (4 hàm TX) +
  `ParkMsgHandler.onMessage` @0x718DC8 (2 jump-table: 0x14E3CA8 cmd 79-93, 0x14E3C90 cmd 41-46)
  → gọi thẳng `FishingScr.on*`. TX 41/43/44/45; RX 41/43/44/45/46/79/-111 decode trọn.
  `CA_CAN_CAU=42` là **hằng chết** (entry jump-table trỏ epilogue); server báo cá cắn câu bằng
  **cmd 79 CAN_CAU**. Đã quét toàn binary: 46/79/-111 là server-push, client không gửi.

## TIẾP THEO — gợi ý
- **Chạy thật**: vẫn chưa hook trên thiết bị root lần nào. Mọi schema (login/farm/fishing) mới chỉ
  test bằng gói giả → ưu tiên số 1 là verify bằng traffic thật, nhất là `decodeCanCau`
  (khối `arrImgNew` phụ thuộc `available()`) và LOGIN_SUCESS.
- Mảng chưa đụng: Clan (`ClanService`/`CLAN=-112`), Market (`MarketService`), Casino/Baucua,
  MiniGame (Caro/TrucXanh/Aincrad/Phom `PhomMsgHandler` @0x721034), Wedding, Park phần còn lại
  (cmd 79-93 ngoài 79: move/chat/gift/feel/board-list… đã lộ ra khi đọc onMessage).
- Cách làm giữ nguyên: `xrefs.py` tìm Service → `iladis.py <RVA> <n> --sum` cho TX →
  jump-table + `--calls` cho RX → thêm SCHEMAS/SCHEMAS_RX → ghi `<feature>.md`.
