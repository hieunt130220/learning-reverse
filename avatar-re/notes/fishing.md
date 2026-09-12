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
Độ dài mảng gửi = `queryCount` (số ảnh `arrImgNew` của RX79); slot chưa bấm được `update()`
tự điền bằng key 0 qua cú gọi `setIndex(0, 0)` lặp mỗi frame (xem guard bên dưới).

#### Ánh xạ referenceIndex → byte trên dây (✓ verified 2026-09-07, live Frida)

**Kết luận: TX43 answer byte = chính vị trí tham chiếu 0-based trong mảng `arrImg` của RX79
(identity mapping).** Không có bảng tra trung gian, không có offset. Byte `0x00` ở vị trí thứ
`j` nghĩa là query `j` được trả lời bằng reference ảnh số 0; slot không bấm giữ `0xFF` trong
`arrIndex` và bị loại khỏi mảng gửi đi (độ dài `n` = số query, mỗi phần tử đã có giá trị).

Chuỗi bằng chứng động (PID 4358, AVD `avatar-protocol-api30`, log `/tmp/fishing_phaseA2.log`):

| Capture | timeDelay | queryCount | `setIndex` key bấm theo thứ tự | TX43 `answerBytes` |
|---|---|---|---|---|
| C1 15:51:07→15:51:16 | 20000 | 6 | 0,1,2,3,4,5 | `00 01 02 03 04 05` |
| C2 15:58:15→15:58:23 | 20000 | 6 | 0,1,4,3,2,5 | `00 01 04 03 02 05` |
| C3 16:09:45→16:09:56 | 20000 | 9 | 4,4,4,4,4,4,4,3 | `04 04 04 04 04 04 04 03 00` |
| C4 16:17:15→16:17:31 | 20000 | 7 | 3,4,5,4,3,3,3 | `03 04 05 04 03 03 03` |

Mỗi capture là một challenge riêng (`onCaCanCau idUser 1005161` → `doFinishFishing` → `TX cmd 43`,
không có RX79 thứ hai chen giữa). Byte ghi trên dây khớp **chính xác và theo đúng thứ tự** với
`key` mà `FishingScr.setIndex(int key, bool isClick)` nhận được từ các cú chạm thật:

- C1 phủ vị trí 0..5, C2 phủ lại 0..5 theo hoán vị khác ⇒ **mọi vị trí tham chiếu được hỗ trợ
  (0..5) có ≥2 quan sát độc lập, đồng thuận**.
- C3/C4 chứng minh key không bị biến đổi khi lặp lại (4 xuất hiện 7 lần → byte 4 ở 7 slot) và
  khi không phải giá trị tăng dần.
- C3 có 9 query nhưng chỉ 8 cú bấm; slot cuối ra `00` = reference 0. Trong cửa sổ C3 không có
  cú chạm trượt nào (không thấy backtrace nhánh `numKeyPress` trượt @0x5DC484, cũng không thấy
  click key 0) ⇒ slot 9 được `update()` điền key 0, không phải do chạm trượt.

Bằng chứng tĩnh tương ứng (`libil2cpp.so` arm64):

| RVA | Hành vi |
|---|---|
| `onCaCanCau` 0x5DDD68 | Duyệt `arrImg` theo đúng thứ tự wire, `listKey.add(img, i)` tại 0x5DE4A4 (`w2 = w27 = i`) ⇒ phần tử thứ `i` của `listKey` mang key `i`. |
| `numKeyPress` 0x5DBFF0 | Hit-test vùng chạm với `listKey` (0x5DC3C8 `bl 0x659938`), khớp thì `setIndex(listKey[index].key, false)` tại 0x5DC3DC; không khớp thì `setIndex(0, false)` tại 0x5DC480. |
| `setIndex` 0x5DBA60 | `listKeySend.add(element)` (0x5DBBF8–0x5DBC10), rồi dựng lại `arrIndex[j] = (sbyte)listKeySend[j].key` (0x5DBCB8–0x5DBD00). |
| `checkSendArrIndex` 0x5DC4A0 | Chỉ chặn gửi khi còn `0xFF`; không ánh xạ lại giá trị nào. |
| `doFinishFishing` 0x71BC4C | Ghi thẳng `arrIndex` ra dây, không biến đổi. |

⇒ Không còn suy đoán nào: `referenceIndex` của matcher Phase 2 **chính là** byte TX43 cần gửi.

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
