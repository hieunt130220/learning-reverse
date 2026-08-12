# Câu cá (Fishing) — com.TeaM.Avatar

Câu cá **KHÔNG** đi qua `FarmMsgHandler`/`FarmService` như dự đoán ban đầu, mà nằm trong
**Park** (`ParkMsgHandler` / `ParkService`). Đây là lý do các opcode 41–46 không có trong
jump-table farm (dải 51–103).

## Class chính
| Class | Vai trò |
|---|---|
| `ParkService` (gI 0x718104) | Dựng & gửi gói **TX** (4 hàm) |
| `ParkMsgHandler` (onMessage 0x718DC8) | Nhận gói **RX**, gọi thẳng vào `FishingScr` |
| `FishingScr : MyScreen` (gI 0x5DA888) | Màn hình câu cá + toàn bộ callback `on*` |
| `Fish` | Đối tượng phao/dây/mồi khi câu (client-side, không lên mạng) |
| `FishingBoxScr` | Rương cá (`setInfo(numFish, totalFish, listFish)`) |
| `FishInfo` | 1 dòng thông tin cá: name, ID, idImg(i16), Lvl, map |
| `FishFarm : AnimalDan` | **Ao cá trong nông trại** — khác hệ thống này, xem `farm.md` cmd 81 |

## Dispatch trong `ParkMsgHandler.onMessage` @0x718DC8
1. So sánh thẳng: `cmn w8, #0x6f` → **command == -111** (INFO_FISH) xử lý ngay tại 0x718E9C.
2. Jump-table **0x14E3CA8**, 15 entry, index = `command - 79` → dải **79..93** (Park).
   Entry đầu (cmd 79 CAN_CAU) → 0x718F68 = handler *cá cắn câu*.
3. Jump-table **0x14E3C90**, 6 entry, index = `command - 41` → dải **41..46**.
   `cmd 42` trỏ về epilogue ⇒ **CA_CAN_CAU=42 không được dùng**; server báo cá cắn câu
   bằng **cmd 79 (CAN_CAU)**.

| cmd | Tên trong Cmd_Message | Target | Callback |
|---|---|---|---|
| 41 | QUANG_CAU | 0x719194 | `FishingScr.onQuanCau` |
| 42 | CA_CAN_CAU | *(epilogue)* | **không xử lý** |
| 43 | CAU_THANH_CONG | 0x719574 | `FishingScr.onFinish` |
| 44 | CAU_CA_XONG | 0x719544 | `FishingScr.onCauCaXong` |
| 45 | START_CAU_CA | 0x71951C | `FishingScr.onStartFishing` |
| 46 | STATUS_FISH | 0x7194D4 | `FishingScr.onStatus` |
| 79 | CAN_CAU | 0x718F68 | `FishingScr.onCaCanCau` |
| -111 | INFO_FISH | 0x718E9C | `FishingScr.onInfo` |

## TX — `ParkService` (✓ xác minh tại RVA bằng `tools/iladis.py`)
| cmd | Tên | TX method | Body (verified) | RVA | Gọi từ |
|---|---|---|---|---|---|
| 41 | QUANG_CAU | doQuanCau | *(rỗng)* | 0x71BBF0 | `FishingScr.commandActionPointer` |
| 43 | CAU_THANH_CONG | doFinishFishing | **bool** isF, **i8** n, n×**i8** index | 0x71BC4C | `FishingScr.setIndex` |
| 44 | CAU_CA_XONG | doCauCaXong | *(rỗng)* | 0x71BEB8 | `FishingScr.commandActionPointer` |
| 45 | START_CAU_CA | doStartFishing | *(rỗng)* | 0x71BF14 | `FishingScr.doSat` |

> Đã quét toàn bộ `libil2cpp.so` (mọi `Message..ctor` với command 41–46/79/-111):
> **chỉ có 4 hàm TX trên**. `STATUS_FISH(46)`, `CAN_CAU(79)`, `INFO_FISH(-111)` là
> **server-push một chiều**, client không bao giờ gửi.

### cmd 43 TX — chi tiết
`doFinishFishing(bool isF, sbyte[] index)`: `writeBoolean(isF)`, `writeByte(index.Length)`,
rồi vòng lặp `writeByte(index[i])`.
`index` = chuỗi phím mini-game gom trong `FishingScr.listKeySend`; `FishingScr.arrIndex` dùng
`0xFF` làm sentinel "chưa đặt" (`checkSendArrIndex` @0x5DC4A0 trả false nếu còn 0xFF).
Chỗ gọi duy nhất truyền `isF = 1` (hằng số) ⇒ thực tế client luôn gửi `true`.

## RX — layout body (✓ xác minh tại RVA)
| cmd | Tên | Body | Callback (chữ ký metadata) |
|---|---|---|---|
| 41 | QUANG_CAU | i32 idUser | `onQuanCau(int idUser)` |
| 43 | CAU_THANH_CONG | i32 idUser, **i16** idFish | `onFinish(int idUser4, int idFish)` |
| 44 | CAU_CA_XONG | i32 idUser | `onCauCaXong(int idUser5)` |
| 45 | START_CAU_CA | bool iss; **nếu iss==false** → utf error | `onStartFishing(bool iss, string error)` |
| 46 | STATUS_FISH | i32 idUser, i8 status | `onStatus(int idUser6, int status)` |
| -111 | INFO_FISH | i32 idUser, i8 lv, i8 perLv, i32 numFish, **i16** idPart | `onInfo(int idUser7, sbyte lv, sbyte perLv, int numFish, short idPart)` |

**Bài học lặp lại**: `onFinish` khai báo `int idFish` nhưng dây gửi **i16** (`readShort` @0x719594);
`onInfo` khai báo `int numFish` thì đúng là i32, còn `idPart` là i16. Luôn verify tại RVA.

Ở cmd 45, nhánh `iss == true` nạp một string tĩnh (`adrp 0x1ABD000 + 0x8D0`) chứ **không** đọc
thêm byte nào → gói chỉ dài 1 byte khi thành công.

### cmd 79 CAN_CAU (cá cắn câu) — gói duy nhất có thân động
Handler 0x718F68 → `onCaCanCau(int idUser3, int idFish, short timeDelay, sbyte[][] arrImg, sbyte[][] arrImgNew)`

```
i32  idUser
i16  idFish          // ⚠ readShort, dù chữ ký là int
i16  timeDelay
i8   n
n × { i32 len; len byte }        // arrImg     (myReader.read(ref sbyte[]) đọc đúng len byte)
if (available() >= 1) {
    i8 m
    m × { i32 len; len byte }    // arrImgNew
} else arrImgNew = null          // gói cũ không có khối này
```

## Luồng thực tế
```
client  doStartFishing (45, rỗng)          → server
server  START_CAU_CA (45) bool[+utf error] → onStartFishing   // được phép câu?
client  doQuanCau (41, rỗng)               → server           // quăng cần
server  QUANG_CAU (41) i32 idUser          → onQuanCau        // broadcast cho người khác thấy
server  CAN_CAU (79) …arrImg…              → onCaCanCau       // cá cắn câu + ảnh mini-game
client  doFinishFishing (43, bool+mảng)    → server           // chuỗi phím đã bấm
server  CAU_THANH_CONG (43) i32,i16        → onFinish         // idFish câu được
client  doCauCaXong (44, rỗng)             → server           // đóng màn
server  CAU_CA_XONG (44) i32 idUser        → onCauCaXong
server  STATUS_FISH (46) / INFO_FISH (-111) bất kỳ lúc nào    // trạng thái & lv/số cá
```

## Đã đưa vào parser (`frida_scripts/parser.ts`)
- `SCHEMAS_RX` (bảng mới, tra trước `SCHEMAS` khi `dir === "RX"`): QUANG_CAU, CAU_THANH_CONG,
  CAU_CA_XONG, START_CAU_CA, STATUS_FISH, INFO_FISH.
  Cần bảng riêng vì cùng opcode nhưng **layout TX ≠ RX** (vd 43: TX bool+mảng, RX i32+i16).
- `decodeCanCau()` cho RX cmd 79, `decodeFinishFishing()` cho TX cmd 43 (thân động).
- `smartDecode(b, names, dir)` nhận thêm tham số `dir`.
- Test gói giả: 9/9 khớp, 0 byte dư (chưa chạy trên thiết bị thật).
