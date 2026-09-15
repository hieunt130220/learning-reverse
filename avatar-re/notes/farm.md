# Nông trại (Farm) — com.TeaM.Avatar

Nông trại là **mini-game** (`FarmMsgHandler : IMiniGameMsgHandler`). Mọi gói đi qua `Session_ME`
chung, `command` = hằng sub-command trong `Cmd_Message`.

## Class chính
| Class | Vai trò |
|---|---|
| `FarmService` (gI 0x5D0500) | Dựng & gửi gói **TX** (mỗi hàm `do*` = 1 action) |
| `FarmMsgHandler` | Nhận & xử lý gói **RX** (`onMessage`, `readInfoCell`, `readInfoAnimal`, `readFarmData`) |
| `FarmData` | Cache dữ liệu farm (version, ảnh, cây, vật phẩm) + lưu local (`avatarDataFarm`…) |
| `CellFarm : SubObject` | 1 ô đất |
| `FarmItem`, `FishFarm`, `Animal` | Vật phẩm / ao cá / thú nuôi |
| `FarmScr` | Màn hình UI (Command: PlantSeed, KhoGiong, PriceLand, VatPham…) |

## Bảng opcode + layout body (TX) — ✓ ĐÃ XÁC MINH tại RVA
> Width lấy từ chuỗi `writeInt/writeByte/writeShort` **thực** trong `libil2cpp.so`
> (bằng `tools/iladis.py`), KHÔNG phải đoán theo chữ ký. `⚠` = value trùng lệnh khác (chỉ đúng trong farm).
> Bài học: rất nhiều tham số khai báo `int` trong C# nhưng gửi bằng `writeByte` → **i8**.

| cmd | Tên | TX method | Body (verified) | RVA |
|---|---|---|---|---|
| 66 | PLANT_SEED | doPlantSeed | **i32** idUser, **i8** indexCell, **i8** idSeed (`>=0`: gieo hạt, `-1 / 0xFF`: làm đất dọn cây cũ) | 0x5D1290 |
| 64 | TREE_HARVEST | doHervest | i32 idFarm, i8 indexCell | 0x5D1548 |
| 60 | OPEN_LAND | doOpenLand | i32 idFarm, i8 typeBuy | 0x5D1684 |
| 54 | HARVEST_ANIMAL ⚠ | doHarvestAnimal | i32 idFarm, i8 index | 0x5D18D0 |
| 53 | SELL_ANIMAL ⚠ | doSellAnimal | i32 idFarm, i8 iddb | 0x5D1A2C |
| 52 | PRICE_ANIMAL ⚠ | doRequestPriceAnimal | i32 idFarm, i8 iddb | 0x5D1DD0 |
| 51 | BUY_ANIMAL ⚠ | doBuyAnimal | *serialize AnimalInfo* + i32 typeBuy | 0x5D1B68 |
| 68 | BUY_ITEM | doBuyItem | i16 id, i8 n, i8 typeShop (money **không** gửi) | 0x5D0D18 |
| 67 | SELL_ITEM | doSellItem | i16 idItem, i32 num | 0x5D1154 |
| 65 | USING_ITEM | doUsingItem | i32 idUser, i8 indexCell, i16 idItem | 0x5D13EC |
| 69 | JOIN | doJoinFarm | i32 id | 0x5D0C08 |
| 70 | INVENTORY | getInventory | i32 idFarm | 0x5D0BAC |
| 55 | TRANSFER_MONEY | doTransMoney | i8 type, i32 money | 0x5D1F0C |
| 102 | UPDATE_FARM_CATTLE | doUpdateFarm | i8 type, i8 typeMoney | 0x5D20B4 |
| 81 | UPDATE_FARM_FISH ⚠ | doUpdateFish | i8 type, i8 typeMoney | 0x5D21F8 |
| 90 | UPDATE_LAND ⚠ | doUpdateLand | i8 step, i8 typeMoney | 0x5D245C |
| 94 | UPDATE_STORE | doUpdateStore | i8, i8, i8 | 0x5D260C |
| 103 | OPEN_SHOP_FARM ⚠ | doOpenShop | i8 type, i8 step, i16 idItem | 0x5D33E0 |
| 96 | STEAL ⚠ | doSteal | i8 step | 0x5D3000 |
| 95 | STEAL_INFO | doStealInfo | i8 | 0x5D2FA4 |
| 97 | STEAL_STORE ⚠ | doStealStore | i8 | 0x5D3110 |
| 98 | LICH_SU_BI_TROM ⚠ | doLichSuAnTrom | i8 | 0x5D316C |
| 83 | FINISH_STARFRUIT ⚠ | doFinishStarFruit | i8 | 0x5D2F48 |
| 93 | NAU_NHANH ⚠ | nauNhanh | i8 step | 0x5D2B10 |
| 74 | GET_BIG_FARM | getBigImage | i16 id | 0x5D0790 |
| 75 | GET_IMAGE_FARM ⚠ | getImageData | i8, i8 | 0x5D090C |
| 82 | GET_IMG_FARM | doGetImgIcon | i16 id | 0x5D233C |
| 76 | GET_TREE_INFO | getTreeInfo | i8, i8 | 0x5D09DC |
| 71 | SET_BIG_FARM ⚠ | setBigData | i16 index | 0x5D0734 |
| 91 | COOKING (container) | doCooking / doHarvestCook | i8 **sub** + (i8 num,i16 iD) / (i8,i8) | 0x5D2994 / 0x5D2C10 |

> ⚠ **Chú ý mapping trước đó sai**: `getBigImage` gửi **cmd 74** (không phải 75); `doHarvestCook`
> nằm trong **container COOKING=91** (không phải HARVEST_COOK=92). Đã sửa trong parser.

Tất cả đã nạp vào `SCHEMAS` của `frida_scripts/parser.ts` với width verified.

### Chưa map opcode (thân hàm không lộ 1 cmd đơn / tên không khớp hằng)
`doRequestPricePlant`, `doFastCook`, `getCook`, `doOpenSlot/doOpenLastSlot`, `requestUnlockSlotShop`,
`doRefeshShop`, `doGetItemShop`, `getInfoStarFruit`, `doUpdateStarFruil`, `doHarvestStarFruit`,
`doUpdateStarFruitByMoney`; và method cho `MOVE_FARM=56`/`CHAT_FARM=77`/`OPEN_INFO_FARM=104`.
→ Dùng `tools/iladis.py <RVA>` để đọc trực tiếp.

### Câu cá (fishing)
`START_CAU_CA=45`, `CA_CAN_CAU=42`, `CAU_THANH_CONG=43`, `CAU_CA_XONG=44`, `STATUS_FISH=46`,
`CAN_CAU=79`, `INFO_FISH=-111` (class `FishFarm : AnimalDan`).

## Dispatch RX (server → client) — ✓ giải mã jump-table `onMessage`
`FarmMsgHandler.onMessage` @0x634068 dùng **jump-table** tại VA `0x14e35d8` (53 entry i32, command 51–103;
`target = base + entry[cmd-51]`). Giải bằng `tools/jumptable.py`. Command ngoài 51–103 hoặc rơi vào
nhánh default `0x6378a8` (`readInt + addFlyText`) = không xử lý ở farm.

| cmd | Ý nghĩa RX | Đọc gì (call đầu) |
|---|---|---|
| 52 PRICE_ANIMAL | báo giá thú | readByte, readUTF, onPriceAnimal |
| 53 SELL_ANIMAL | bán thú | readInt, readByte, readInt |
| 54 HARVEST_ANIMAL | thu thú | readByte, readShort, onHarvestAnimal |
| 55 TRANSFER_MONEY | chuyển tiền | readByte, readInt, **setMoney** |
| 56 MOVE_FARM | di chuyển | readMove, readInt, readByte |
| 60 OPEN_LAND | mở đất | readInt, readInt, readByte, readUTF |
| **61** | (price plant) | onPricePlant, **readFarmData** |
| 63 | kick | onKick |
| 64 TREE_HARVEST | thu cây | readByte, readShort, onHarvestTree |
| 65 USING_ITEM | dùng item | readByte, readShort, getFarmItem |
| 66 PLANT_SEED | trồng (echo) | readInt, readByte, readByte |
| 67 SELL_ITEM | bán item | readInt, readInt, readShort |
| 68 BUY_ITEM | mua item | readShort, readByte, readInt |
| **69 JOIN** | **vào farm → toàn bộ dữ liệu** | **readFarmData** |
| 70 INVENTORY | túi đồ | readByte + list |
| 71 SET_BIG_FARM | version big | readByte, readShort, readShort |
| 74 GET_BIG_FARM | ảnh big | readShort, readShort, readUnsignedShort |
| 75 GET_IMAGE_FARM | ảnh | read + **saveImageData** |
| 76 GET_TREE_INFO | info cây | read + **saveTreeInfo** |
| 77 CHAT_FARM | chat | readChat |
| 81 UPDATE_FARM_FISH | ao cá | readByte, readByte, readInt |
| 82 GET_IMG_FARM | icon | readShort, readShort |
| 83 FINISH_STARFRUIT | khế | readBoolean, readShort, readByte |
| 90 UPDATE_LAND | nâng đất | readByte, readByte, readInt |
| 91 COOKING | nấu (container) | readByte (sub) |
| 92 FLY/HARVEST_COOK | món ăn | getFoodByID, getFarmItem |
| 93 NAU_NHANH | nấu nhanh | readByte, readInt×3 |
| 94 UPDATE_STORE | nâng kho | readByte, readByte, readInt |
| 95 STEAL_INFO | info trộm | readInt×4 |
| 96 STEAL | trộm | readByte, readBoolean, readShort, readUTF |
| 97 STEAL_STORE | trộm kho | readShort, readShort, getFarmItem |
| 100 INFO_CELL | 1 ô | checkTypeMapFarm, readByte, elementAt |
| 101 INFO_ANIMAL | 1 thú | checkTypeMapFarm, readByte, getAnimalByIndex |
| 102 UPDATE_FARM_CATTLE | chuồng | readByte, readByte, readInt |
| 103 OPEN_SHOP_FARM | mở shop | readByte, ToString, Concat |

> **Chốt**: gói dữ liệu farm đầy đủ (`readFarmData`) đến trên **cmd 69 (JOIN)** và **cmd 61** — KHÔNG phải 74.
> Đã đặt `FARMDATA_CMDS = {61, 69}` trong parser.
> Default (`0x6378a8`) gom các cmd 57,58,59,62,72,73,78-80,84-89,98,99.

## Cấu trúc RX (server → client) — ✓ ĐÃ XÁC MINH tại RVA
Đọc bằng `tools/iladis.py <RVA>` (full/`--calls`), map `readX` → offset field qua lệnh `str [obj,#off]`.

### readFarmData(Message) @0x639438 — gói dữ liệu farm tổng
```
i32 idFarm                       // == -1  => không có dữ liệu, dừng
i8  nCell
repeat nCell:
    i8 idTree                    // -> CellFarm.idTree (0x44)
    if idTree != -1:             // -1 = ô trống, không có thêm dữ liệu
        <readInfoCell>           // 6 field bên dưới
i8  nAnimal
repeat nAnimal:
    <readInfoAnimal>
// --- TAIL (LUÔN có, kể cả khi idFarm==-1 nhảy thẳng vào đây) ---
i8  A                             // @0x6399a4
i8  B                             // @0x6399b8
i16 x7                            // @0x6399cc..0x639a2c (version/giá? - chưa rõ tên)
repeat nCell: i8 level            // @0x639a38 Loop1 -> CellFarm.level (0x5F), mỗi cell 1 byte
i16 flag                          // @0x639b30 -> field 0xc2 (bool)
i8  mode                          // @0x639b6c (cmp #2)
i16                               // @0x639bb8
7 × { i16, bool }                 // @0x639bcc..0x639ce8 (khế/tính năng, lưu stack)
bool                              // @0x639d00
ret                               // @0x639e10
```
> Khối cuối (`i16 flag, i8 mode, i16, 7×(i16,bool), bool`) có vài `cmp #1/b.lt` count-guard nên
> tuỳ dữ liệu có thể lệch; `decodeFarmData` bọc try + để `autoDecode` xử lý phần dư. Test gói đầy đủ
> tiêu thụ hết 0 byte dư.

### readInfoCell(CellFarm, Message) @0x63BC0C — 1 ô đất (chỉ khi idTree != -1)
| # | Read | Field (offset) |
|---|---|---|
| 1 | i16 | time (0x48);  tempTime = time×60 *(tính cục bộ, không đọc)* |
| 2 | i8 | vitalityPer (0x5D) |
| 3 | i8 | hervestPer (0x5C) |
| 4 | bool | isArid (0x58) |
| 5 | bool | isWorm (0x59) |
| 6 | bool | isGrass (0x5A) |

*(xCell/yCell/status/level/statusTree/isCare* KHÔNG nằm trong gói này — tính từ index hoặc set cục bộ.)*

### readInfoAnimal(Animal, Message) @0x63C138 — 1 thú
`i32 [0x94]  ·  i8 [0x98]  ·  i8 [0xA9]  ·  i8 [0xB8]  ·  bool [0x9D]  ·  bool  ·  bool [0x21]`
*(tên field cần map Animal class; width/thứ tự đã chốt.)*

> RX FarmData **lồng nhau** (điều kiện + vòng lặp) nên không biểu diễn được bằng SCHEMAS phẳng —
> cần decoder riêng có Reader tuần tự. Có thể viết `decodeFarmData(bytes)` trong parser nếu cần
> giải mã đầy đủ gói server.

## Công cụ xác minh: tools/iladis.py
Disassemble 1 hàm trong `libil2cpp.so` (arm64) và resolve `bl` sang tên method qua `script.json`.
Không cần IDA/Ghidra.
```bash
PY=~/re-tools/frida-venv/bin/python     # có capstone
$PY tools/iladis.py 0x5D1290            # full disassembly + tên hàm được gọi
$PY tools/iladis.py 0x5D1290 --sum      # chỉ in: command + chuỗi write[...]
$PY tools/iladis.py doPlantSeed         # tìm theo tên
```
`--sum` cho ra vd: `FarmService$$doPlantSeed  cmd=0x42=66  writes=[Int, Byte, Byte]`.
Cách này chính là thứ xác minh width ở bảng trên.

## Hướng dẫn IDA/Ghidra (khi cài để phân tích sâu hơn)
1. **Ghidra** (free): mở `libil2cpp.so`, sau auto-analysis chạy `Script Manager` →
   `tools/Il2CppDumper/ghidra_with_struct.py`, chọn `il2cpp_out/il2cpp.h` + `script.json` →
   toàn bộ hàm được đổi tên (`FarmService::doPlantSeed`) và có struct.
2. **IDA**: `File > Script file` → `tools/Il2CppDumper/ida_with_struct_py3.py`, chọn cùng 2 file.
3. Nhảy tới địa chỉ RVA (vd `0x5D1290`), `F5` để decompile → đọc trực tiếp `msg.writeInt()/writeByte()`.
Kết quả tương đương `iladis.py` nhưng có pseudocode + xử lý luồng phức tạp (vòng lặp, struct RX).

## Bảng cây trồng (cmd 76) — ✓ giải mã trên gói thật 13.336 byte

```
i16 count                       // = 11
repeat count:
    i8  id
    utf name
    30 byte thuộc tính (15 × i16)
```
Thuộc tính: `[0]=24 (hằng)`, `[1]=phút lớn`, `[2]=-1`, `[3]=10`, `[4]=1`, `[5]=giá`,
`[6]=?`, `[7..12]=6 id ảnh theo giai đoạn`, `[13]=ảnh cuối`, `[14]=0`.

| id | tên | phút | giá |
|---|---|---|---|
| 0 | Cà chua | 4 | 25 |
| 1 | Cà rốt | 6 | 36 |
| 2 | Khóm | 10 | 55 |
| 3 | Dưa Hấu | 8 | 46 |
| 4 | Nho | 16 | 80 |
| 5 | Hoa Hồng | 2 | 15 |
| 6 | Lúa | 48 | 240 |
| 7 | Xoài | 24 | 120 |
| 8 | Thanh long | 12 | 63 |
| 9 | Hoa hướng dương | 12 | 63 |
| 10 | Hoa tulip | 6 | 36 |

Hết bảng cây ở offset 458; ~12,9 KB còn lại là vật nuôi / vật phẩm / món ăn, mỗi mục
có `utf` tên (+ `utf` mô tả với vật nuôi). Trong đó có **'Thuốc diệt cỏ'** và
**'Thuốc trừ sâu'** (id chưa chốt) — cần cho `doUsingItem`. Chưa thấy vật phẩm tưới nước.

## Kho vật phẩm (cmd 70) — ✓ giải mã trên gói thật 148 byte

Gồm **4 section liên tiếp**, mỗi section: `i8 count` + count × (`i16 id`, `i32 num`),
kết thúc bằng 12 byte đuôi chưa map.

| section | nội dung quan sát | suy đoán |
|---|---|---|
| 1 | `#0×7, #7×5, #1×19, #10×63, #5×21, #6×45` | **hạt giống** (id khớp bảng cây) |
| 2 | `#112…#124`, mỗi loại ~98–99 | nông sản/món ăn |
| 3 | `#6×1789, #50×503, #51×202` | ? |
| 4 | `#283×12, #279×190, #297×24, #276×4` | ? |

Chốt section 1 = hạt giống: tài khoản test có `#6 × 45` = hạt **Lúa**, và cả 46 ô
đang trồng `idTree = 6` = Lúa.

## ⚠ Sửa: phần đuôi readFarmData

Giải theo layout đuôi ở trên (`i8 A, i8 B, 7×i16, nCell×i8 level, …`) cho ra `level`
= 41/46/20 trên gói thật → **lệch**. Không dùng `level`; các field của từng ô đọc
trước đuôi nên vẫn đúng. Còn 23 byte đuôi: `01010101…01ffffffff000101`.

## ✓ Kiểm chứng chăm sóc ô bằng gói thật (cmd 65 USING_ITEM)

`doUsingItem(idFarm, indexCell, idItem)` — `i32, i8, i16`. Xác minh call site:
`FarmScr.doUsingVatPham` @0x642ADC nạp `ldrsh w3, [x21, #0x10]` = `FarmItem.id` (i16),
tức idItem là **id trong bảng vật phẩm**, không phải trường `type`.

| idItem | việc | kiểm chứng |
|---|---|---|
| **100** | tưới nước | ✓ `isArid` true→false. Không có trong bảng vật phẩm, kho không bị trừ. Là hằng số cứng trong `FarmScr.resetAction` @0x644674 và `ActionVatPham4.perform` |
| **123** | nhổ cỏ (Thuốc diệt cỏ) | ✓ `isGrass` true→false, server đẩy kèm `INFO_CELL`. Kho không bị trừ |
| 124 | bắt sâu (Thuốc trừ sâu) | chưa thử được (rớt kết nối) |

Phản hồi của server sau `doUsingItem`:
```
RX 100 INFO_CELL : i8 index + bản ghi ô y hệt readFarmData   (chỉ khi trạng thái ô đổi)
RX 65  USING_ITEM: i8 index, i16 idItem                       (echo xác nhận, luôn có)
```
Lúc tưới nước chỉ có echo, không có `INFO_CELL`, nhưng đọc lại gói 69 thì `isArid`
đã đổi thật → **đừng dựa vào `INFO_CELL` để biết lệnh thành công**, phải đọc lại.

Đáng chú ý: dùng thuốc **không trừ kho** (vẫn 98 Thuốc diệt cỏ sau khi nhổ cỏ thành công).

## ✓ Phase vật nuôi — giải mã và kiểm chứng trên gói thật

### Sửa lỗi trong readFarmData: bản ghi vật nuôi là 11 byte, không phải 10

`readFarmData` đọc **1 byte lưu vào `Animal.species` (+0xA8)** rồi mới gọi `readInfoAnimal`,
y hệt cách nó đọc `idTree` trước `readInfoCell`. Xác minh tại RVA: trong vòng lặp vật nuôi
có `strb w24, [x19, #0xa8]` ngay trước `bl readInfoAnimal`.

```
i8  nAnimal
repeat nAnimal:
    i8  species          // +0xA8, id trong bảng vật nuôi (50..61)
    <readInfoAnimal>     // 10 byte
```

`readInfoAnimal` @0x63C138 — offset đích đọc từ lệnh `str`:
| # | Read | Field |
|---|---|---|
| 1 | i32 | `bornTime` (+0x94) |
| 2 | i8 | `health` (+0x98) — khai `int`, ghi byte |
| 3 | i8 | `harvestPer` (+0xA9) |
| 4 | i8 | `numEggOne` (+0xB8) — khai `int`, ghi byte |
| 5 | bool | `hunger` (+0x9D) |
| 6 | bool | `Base` +0x20 (chưa rõ tên) |
| 7 | bool | `Base` +0x21 |

**Thiếu byte `species` chính là nguyên nhân phần đuôi gói từng bị lệch 16 byte**
(16 con × 1 byte) và làm `level` ra 41/46/20. Sửa xong thì đuôi khớp: đúng 46 byte
`level` liền nhau. Layout đuôi trong tài liệu này vốn ĐÚNG.

### Bảng vật nuôi (trong gói cmd 76, ngay sau bảng cây + 1 bảng 10 mục id 101–110)
`i16 count=12`, mỗi con: `i8 id`, `utf name`, `utf desc`, 62 byte thuộc tính.

| id | tên | | id | tên |
|---|---|---|---|---|
| 50 | Gà | | 56 | Cừu |
| 51 | Bò | | 57 | Mèo Tinh Ranh |
| 52 | Heo | | 58 | Trâu |
| 53 | Chó | | 59 | Rùa |
| 54 | Cá chép | | 60 | Dê |
| 55 | Vịt | | 61 | Thỏ |

`desc` chứa sẵn thời gian lớn và giá bán, vd *"Thời gian lớn : 1 ngày - Bán : 950 xu"*.

## ✓✓ Đo trên server thật — `time`/`bornTime` ĐẾM LÊN, tính bằng PHÚT

Đọc dữ liệu farm hai lần cách nhau đúng 60 giây trong **một** phiên
(`tools/farm-sample.ts`, đăng nhập lại sẽ bị đá phiên cũ):

| trường | lần 1 | lần 2 (+60s) | kết luận |
|---|---|---|---|
| ô `time` | 491 | **492** | +1 mỗi phút → **số phút kể từ lúc trồng** |
| con `bornTime` | 1837 / 2200 | **1838 / 2201** | +1 mỗi phút → **số phút kể từ lúc sinh** |

**Hệ quả**: điều kiện `time === 0` để biết ô chín là **SAI** — `time` bắt đầu từ 0
lúc trồng rồi tăng mãi, nên chỉ đúng trong đúng phút đầu tiên. Đây là nguyên nhân
auto-farm không bao giờ thu hoạch.

### Ô chín: `hervestPer > 0`, không phải `time`

Farm thật 46 ô, tất cả `idTree=6` (Lúa) nhưng `time` khác nhau:

| ô | time (phút) | ≈ giờ | hervestPer | thu được? |
|---|---|---|---|---|
| 0–22 | 501 | 8,4 | 0 | ✗ server im lặng |
| 23–37 | 415 | 6,9 | 0 | ✗ |
| 44 | 2194 | 36,6 | 0 | ✗ |
| 45 | 2296 | 38,3 | 0 | ✗ |
| **43** | **2978** | **49,6** | **20** | **✓** |

Chỉ ô 43 thu được: server trả `cmd 64` (`2b 00c0` = i8 index 43 + i16) kèm `-40`
*"Chúc mừng bạn đã nhận"*. Các ô `hervestPer=0` bị **bỏ qua im lặng** — không lỗi,
không phản hồi gì, y hệt như gửi vào hư không.

`TreeInfo.growMinutes` của Lúa = 48 mà ô chín ở 2978 phút ≈ 49,6 giờ → **đơn vị
trường đó là GIỜ**, không phải phút (48h = 2880 phút, đúng ngưỡng ô 43 vượt qua).
Dù vậy `hervestPer` mới là thứ nên dùng: tín hiệu trực tiếp từ server, không phải
suy ra từ bảng cây (mà lấy bảng cây còn phải xin thêm gói 76).

### Ô vừa thu xong: `time = -1`, `hervestPer = 100`

Ngay sau khi thu, ô 43 chuyển sang `idTree=6 (giữ nguyên) time=-1 hervestPer=100`
và **đứng yên ở đó** (kiểm tra lại sau nhiều phút vẫn vậy). Thu lại lần nữa →
server im lặng. Vậy phải loại trạng thái này ra khỏi điều kiện chín, nếu không mỗi
vòng auto lại bắn một lệnh vô ích.

⚠ **`idTree` KHÔNG về -1 sau khi thu** → Cây cũ vẫn còn trên ô đất (`time = -1`).
Phân tích binary client (`libil2cpp.so` tại `FarmMsgHandler.onHarvestTree` và `FarmScr.resetAction`)
đã tìm ra cơ chế: Client gửi `doPlantSeed(idFarm, cellIndex, -1)` (`cmd 66` với `idSeed = -1`)
để **Làm đất / Phá bỏ cây cũ**. Sau lệnh này, ô trở về trống sạch (`idTree = -1`) và server
sẵn sàng nhận lệnh gieo hạt giống mới.

### ✓ Section 3 gói kho = NÔNG SẢN (nơi thu hoạch đổ vào)

`decodeInventory` trả 4 section nhưng `GameClient` chỉ ghép section 1 (hạt) + 2
(vật phẩm) rồi bỏ phần còn lại. **Section 3 chính là nông sản**: `#6×2813` lúa,
`#50×530` trứng gà, `#51×202` sữa bò — id trùng bảng cây với cây trồng, trùng bảng
vật nuôi với trứng/sữa.

Đây là lý do "thu hoạch xong kho vẫn y nguyên": lệnh chạy đúng, hàng vào section 3,
chỉ là chỗ đó không được đọc. Kiểm chứng bằng chênh lệch: thu sản phẩm của 12 con
Gà → `#50` đi từ **530 → 730** (+200, khớp 12 con × 16–19 trứng).

Section 4 (`#283 #279 #297 #208`) vẫn chưa rõ.

### ✓ Thu sản phẩm vật nuôi: `numEggOne > 0` là đúng

Lúc đo lần đầu mọi con đều `numEggOne=0` nên `doHarvestAnimal` bị từ chối im lặng —
đúng, vì Gà đẻ mỗi 6 giờ và vừa thu xong. Sau một đêm `numEggOne` lên 12–19 và
`doHarvestAnimal` chạy ngon, trứng vào section 3. Vậy **`numEggOne` mới là số sản
phẩm chờ thu**, không phải `harvestPer`.

### ⚠ cmd 61 KHÔNG phải "giá trồng cây"

`doRequestPricePlant` (cmd 61) thực ra hỏi giá **mở ô đất mới**. Server trả:

> "Bạn có muốn mở ô đất thứ 47 bằng 634800 xu hoặc 634 lượng không ?"

Farm có 46 ô nên "ô thứ 47" là ô kế tiếp. Tên method trong `FarmService` dễ gây
hiểu nhầm; nó đi cặp với `doOpenLand` (cmd 60), không liên quan tới việc gieo hạt.

### ✓ ĐÃ GIẢI MÃ: Làm đất / Dọn cây cũ = cmd 66 với idSeed = -1 (0xFF)

Byte thô của ô 43 (offset 349 trong gói 69) sau khi thu:

```
06 ffff 64 64 00 00 00     idTree=6  time=-1  vitality=100  hervestPer=100
```

`nAnimal` đọc ngay sau vùng ô vẫn ra đúng 16 → decode **không** lệch, `idTree=6`
là thật: **gốc cây lúa vẫn nằm trên ô**.

→ **Giải pháp**: Gửi `doPlantSeed(idFarm, indexCell, -1)` (cmd 66 với `idSeed = -1`, tức byte `0xFF`).
Server xác nhận phá bỏ gốc cây cũ, đưa ô về `idTree = -1`, sau đó có thể gieo hạt giống mới
bằng `doPlantSeed(idFarm, indexCell, newSeedId)` bình thường.

### ✓ Tuổi lớn / tuổi thọ nằm trong `desc` bảng vật nuôi

`desc` (gói 76) có sẵn mọi thứ cần cho luật bán — không phải cứng hoá bảng loài:

| id | loài | lớn | sản phẩm | thọ |
|---|---|---|---|---|
| 50 | Gà | 1 ngày | 20 trứng / 6h | 7 ngày |
| 51 | Bò | 3 ngày | 30 sữa / 6h | 30 ngày |
| 52 | Heo | 2 ngày | **không** | 20 ngày |
| 53 | Chó | — | giữ nhà | 15 ngày |
| 54 | Cá chép | 3 ngày | **không** | 30 ngày |
| 55 | Vịt | 2 ngày | 20 trứng / 6h | 7 ngày |
| 56 | Cừu | 2 ngày | 20 lông / 12h | 10 ngày |
| 57 | Mèo | — | hỗ trợ trộm | 15 ngày |
| 58 | Trâu | 3 ngày | **không** | 30 ngày |
| 59 | Rùa | 1 ngày | **không** | 15 ngày |
| 60 | Dê | 1 ngày | 40 sữa / 4h | 10 ngày |
| 61 | Thỏ | 2 ngày | **không** | 10 ngày |

Lưu ý chuỗi thật ghi *"Không  có sản phẩm"* với **hai** dấu cách. Chó/Mèo không có
"Thời gian lớn".

⚠ **`gói 76 phải xin SAU `enterFarm``**: server chỉ định tuyến lệnh farm sau
`GET_HANDLER(-1)`. Gọi `getTreeInfo` trước thì bảng cây về **rỗng** (đã dính).

### `harvestPer` = phần trăm LỚN, không phải phần trăm sản phẩm

⚠ **Đã đo lại, kết luận cũ ở đây không vững.** Mẫu mới trên farm thật (16 con):

| loài | bornTime | tuổi | tuổi lớn | harvestPer | numEggOne |
|---|---|---|---|---|---|
| Rùa 59 (không sản phẩm) | 1836 | 1,29 ngày | 1 ngày | **0** | 0 |
| Gà 50 (20 trứng/6h) | 2220 | 1,54 ngày | 1 ngày | **100** | 0 |

Cả hai đều **đã quá tuổi lớn**, nhưng Rùa vẫn `harvestPer=0` → `harvestPer` **không
phải** phần trăm lớn (nếu vậy Rùa phải là 100). Nó gắn với việc loài đó có sản phẩm
hay không. `doHarvestAnimal` lên con Gà `harvestPer=100` cũng bị **bỏ qua im lặng**,
mà lúc đó `numEggOne=0` → khớp với việc chưa có sản phẩm nào chờ thu (Gà đẻ mỗi 6h).

| trường | nghĩa (theo dữ liệu hiện có) | dùng để |
|---|---|---|
| `harvestPer` | gắn với khả năng ra sản phẩm; loài không sản phẩm luôn 0 | **không** dùng để biết đã lớn |
| `numEggOne` | số sản phẩm đang chờ thu | `> 0` thì gọi `doHarvestAnimal` |
| `bornTime` | số phút đã sống | so với "Thời gian lớn"/"Thời gian sống" trong `desc` |

→ Muốn biết **đã lớn chưa** thì so `bornTime` với `Thời gian lớn` trong `desc`, chứ
đừng dùng `harvestPer`.

Phân loài theo sản phẩm: **không có sản phẩm** Heo 52 / Cá chép 54 / Rùa 59 — nuôi lớn
rồi bán. **Có sản phẩm** (thu nhiều lần) Gà 50 / Bò 51 / Vịt 55 — giữ lại để thu.

### ⚠ `bornTime` — CHƯA xác định chiều đếm

`bornTime` (i32, +0x94) là trường duy nhất suy ra được "còn sống được bao lâu", nhưng
gói tĩnh không cho biết nó đếm LÊN (đã sống được) hay XUỐNG (còn lại). Mẫu duy nhất đo
được: con Rùa `bornTime=990` lúc đã lớn 100%.

`AutoFarm.bornProbe` đang đo: mỗi vòng so `bornTime` với vòng trước, ghi
`[đo] vật nuôi … bornTime 990 -> 930 (-60 sau 120s)` vào `lastActions`. Dấu của delta
trả lời câu hỏi, khoảng giây thật cho biết đơn vị. **Chừng nào chưa có kết quả thì
không bán loài có sản phẩm theo tuổi thọ.**

### ⚠ Bán vật nuôi làm xê dịch IDDB

`iddb` = vị trí trong mảng `animals`. Bán một con thì các con đứng sau tụt index xuống 1,
nên index đọc từ ảnh chụp đầu vòng sẽ trỏ nhầm con khác. `AutoFarm` duyệt từ index **CAO
xuống THẤP**: bỏ phần tử phía sau không làm xê dịch phần tử phía trước, đúng cả khi
server để lại chỗ trống thay vì dồn mảng.

### Địa chỉ hoá: IDDB = vị trí trong danh sách

`FarmScr.IActionSetAnimal/IActionChichThuocAnimal/IActionTriBenh3` đều gọi
`doUsingItem(playerId, [obj+0x38], itemId)` với `Base.IDDB` (+0x38). Kiểm chứng bằng
`doRequestPriceAnimal` (cmd 52, chỉ đọc): `iddb=0` và `iddb=5` đều trả lời, giá khác nhau
→ **vị trí trong mảng `animals` dùng thẳng làm iddb**.

RX cmd 52 = `i8 iddb` + `utf` (*"Giá con vật này là 90 xu. Bạn có muốn bán không?"*).

### Cho ăn — cùng lệnh `doUsingItem`

`useItem(idFarm, iddb, foodId)`. Kiểm chứng: `useItem(farm, 0, 116)` lên con Rùa làm
`hunger` true→false, server đẩy về:

```
RX 101 INFO_ANIMAL: i8 iddb + đúng bản ghi 11 byte như trong readFarmData
   00 | 3b 000003de 4c 64 00 | 00 00 00
```

Thức ăn theo loài (id từ bảng vật phẩm): `116` thủy sản (Cá chép, Rùa) · `117` gia cầm
(Gà, Vịt) · `118` gia súc · `119` cho chó/mèo.

### ⚠ Sửa: vật phẩm CÓ bị trừ kho

Trước đây ghi "dùng thuốc không trừ kho" — **sai**, do so hai ảnh chụp kho quá gần nhau.
Đo lại sau nhiều lượt: `#123` 98→96, `#124` 98→95, `#116` 99→98 sau khi cho 1 con ăn.

## ✓ Chữa bệnh, bón phân, mua bán — kiểm chứng trên gói thật

### Hồi phục
| lệnh | tác dụng | đo được |
|---|---|---|
| `useItem(farm, iddb, 122)` Thuốc bổ | +20 máu vật nuôi mỗi liều | con #0: 76 → 96, server đẩy `INFO_ANIMAL` |
| `useItem(farm, cell, 112)` Phân bón siêu cấp | sức sống ô về 100 | ô 0: 73 → 100, server đẩy `INFO_CELL` |

Chạy trọn một vòng: 45 ô bón phân (`#112` 85→40) và 57 liều thuốc bổ cho 16 con
(`#122` 98→41) — tất cả vật nuôi về đủ 100 máu.

### Mua: `doBuyItem(id, num, typeShop)` — cmd 68, `i16, i8, i8`

`typeShop` có 2 giá trị (call site `FarmScr.IActionDoBuyItem1/2`): **1** và **2**.
Kiểm chứng `typeShop = 1` là **xu**: mua 1 Thuốc diệt cỏ → server trả

```
RX -3 UPDATE_MONEY : i32 delta, i8 type, i32 balance
     fffffffb  01  000737e1     = -5 xu, loại 1, còn 473.569
RX 68 BUY_ITEM     : i16 id, i8 num, i32 …
RX -40             : "Bạn đã mua vật phẩm thành công."
```

`typeShop = 2` là loại tiền còn lại — **chưa xác định, không dùng tự động**.

### Giá nằm ngay trong bảng vật phẩm

Trường `i16` đứng trước `FFFF` trong bản ghi vật phẩm chính là **giá bằng xu**
(Thuốc diệt cỏ = 5, khớp đúng `delta = -5`).

| id | tên | giá |
|---|---|---|
| 111 | Phân bón trung cấp | 7 |
| 112 | Phân bón siêu cấp | 10 |
| 116–119 | thức ăn các loại | 1 |
| 120/121 | Thuốc cúm / tiêu chảy | 10 |
| 122 | Thuốc bổ | 25 |
| 123/124 | Thuốc diệt cỏ / trừ sâu | 5 |

Số dư xu cũng nằm ở **12 byte đuôi của gói kho (cmd 70)**: 4 byte đầu = xu
(`000737e6` = 473.574, khớp số dư trước khi mua).

### ⚠ Bẫy khi tự mua

Kho chỉ có sau khi nhận gói 70. Nếu tính nhu cầu lúc `inventory` còn rỗng thì sẽ
tưởng đang có 0 và mua thừa toàn bộ — đã gặp thật (suýt mua 57 Thuốc bổ dù kho có 99).
Phải xin lại kho và **chờ phản hồi** trước khi quyết định mua.


## 2026-09-15 — ACK cây trong avatar-web

Metadata `il2cpp_out/dump.cs` ghi `onHarvestTree(int indexCell2, int number)`
(RVA 0x63B08C) và `onPlantSeed(int idUser, int indexCell, int idSeed)`
(RVA 0x63AB28). Kết hợp bảng đọc RX ở trên: Cmd 64 dài 3 byte
(unsigned index + signed i16 quantity), Cmd 66 dài 6 byte
(i32 idUser + unsigned index + signed i8 seed). Seed -1 là làm đất.
Decoder từ chối payload khác độ dài; không tự coi packet không rõ là thành công.

AutoFarm hiện chờ ACK đúng ô, và với Cmd 66 đúng farm/seed; đăng ký trước send.
Luồng thành công giữ thứ tự thu → làm đất → trồng, không JOIN sau từng ô.
Timeout dùng snapshot JOIN đúng farm trước khi chuyển bước; trồng timeout không retry
trong cùng lượt và refresh kho. Sự kiện `farm-snapshot` chỉ từ Cmd 69,
khác `farm` dùng chung cho cập nhật ô/vật nuôi. ACK không dựng care/vitality giả.

Đây là implementation dựa trên metadata và packet đã ghi trước đó, **chưa phải
live acceptance ngày 2026-09-15**. Probe cục bộ hai ô có 2 JOIN (đầu/cuối),
không JOIN giữa các ô; các nhánh timeout/abort và cleanup đã qua probe.
Cmd 64 không có request/farm ID; đối chiếu index và ownership không tạo được
correlation tuyệt đối. Không suy ra tốc độ thực tế từ probe.
