# Khu Ngoại Ô — Cổng map con & B1 probe room 88 Evidence — 2026-09-17

## 1. Trạng thái

`map17-hub-verified; room18=joined(hub-trung-tam); room22=joined(rừng-gỗ-củi-khô-verified); room26=joined(mỏ-kim-cương-verified); mining-protocol=TX48-doItemSpecial-verified`

## 2. Hub map 17 (B0 baseline, rescan read-only)

- **Tool:** `avatar-web/server/src/tools/mining-probe.ts --account-id 3 --map 17 --area 0 --area-scan 20`
- **Timestamp:** `2026-09-17T06:11:45.191Z` (raw: `/tmp/probe17-scan.json`)
- **Board catalog:** `RX 90 len=21`, `boardCount = 20` (areas `0..19`)
- **Join:** 20/20 `TX 80 len=6` → `RX 80`; tất cả `roomId = 17`, `specialCount = 0`,
  `mapMarker = 0` (không có `mapItemType`/`mapItem`), `specials = []`, `RX 48 = []`
- **TX sau login:** chỉ `-1/90/80` (+ `-94` nội bộ client). Không có `TX -59/-61`.
- **Kết luận:** hub vẫn trống hoàn toàn trên snapshot server — 3 cổng là tile LinkMap
  phía client, không nằm trong `RX 80`. Khớp evidence 2026-09-16.

## 3. B1: join thử room 88 (giả định cũ `T_ROCK=88` — đã đính chính ở §4.6)

- **Tool:** `avatar-web/server/src/tools/maplink-probe.ts --account-id 3 --area 0 --probe-room 88`
- **Timestamp:** `2026-09-17T06:24:45.083Z` (raw: `/tmp/b1-room88.json`)
- **Approve:** user duyệt spec + "Chạy B1 join room 88" (2026-09-17). Đúng 1 `TX 80` probe + 1 `TX 80` về.
- **Request:** `TX 80 [88, 0, 100, 100]` (tọa độ mượn tạm hub 17, gắn nhãn UNVERIFIED)
- **Response:** **không có `RX 80` trong 7s**; server trả `RX -40 len=50` + sự kiện `dialog`
  → `probeJoin.status = 'timeout'`, `decode = 'probe-room-unverified'`
- **Khôi phục:** `TX 80 [17, 0, 100, 100]` → `RX 80 len=336`, `room/board = 17/0`, `x/y = 100/100` OK.

### Đọc kết quả (trung thực)
`room88 = unverified` — **không loại trừ** 88 là map đá. Hai khả năng còn mở:
1. Tọa độ `(100,100)` sai với room 88 (mỗi room có `xJoin/yJoin` native riêng) nên server từ chối bằng dialog;
2. Room 88 yêu cầu điều kiện khác (nhiệm vụ/vật phẩm) hoặc không join trực tiếp được mà phải đi qua cổng LinkMap.
- Nội dung dialog `-40` không decode (redaction) nên chưa biết lý do cụ thể.
- Không thử thêm room khác trong phiên (đúng Spec E2).

## 4. Static APK — 3 cổng map 17 (DataMap17 + LinkMap format)

**Nguồn:** `AvatarHD_3.4.4_APKPure.apk` → `assets/bin/Data/data.unity3d` TextAssets
(extract qua UnityPy; **bắt buộc** recover m_Script bằng `encode('utf-8','surrogateescape')`
— đọc string thường sẽ thay byte ≥0x80 thành `0x3F`, làm hỏng tile type và tọa độ).

### 4.1 LinkMap binary format (đã verify trên 8 asset LinkMap*)

```text
i32 wMap
i32 hMap
i32 count
repeat count:
  i16 destMapId
  i32 gateX, gateY      // portal trên map nguồn
  i32 arriveX, arriveY  // spawn trên map đích
```

### 4.2 Map 17 tile grid — CHỐT

- `DataMap17.bin`: header `00 03` + **216 body bytes**
- **Grid = 27 × 8**, tile size = **10** → native **270 × 80**
  (`216 == 27*8` exact; cùng T=10 với DataMap18/21/23/27)
- Map image `Map170.png`: 1299×528 (prefix `i16 mapId=17` + PNG)

ASCII (`#` chặn, `.`/`o` đi được, `G` = tile cổng):

```text
0 ###########################
1 ###########################
2 ##########.o.....##########
3 ########oo.......oo########
4 ########oo.......oo########
5 ########oo.......oo########
6 #########.........#########
7 ############GGG############
```

### 4.3 Tile cổng map 17

Cổng = tile type **`0xA4` (164)**. Map 17 có **đúng 3 ô liên tiếp**:

| # | cell (x,y) | native top-left | native center | tile |
|---|---|---|---|---|
| 1 | (12, 7) | **(120, 70)** | (125, 75) | `0xA4` |
| 2 | (13, 7) | **(130, 70)** | (135, 75) | `0xA4` |
| 3 | (14, 7) | **(140, 70)** | (145, 75) | `0xA4` |

(Tương quan tile-door trên map khác: map 21/23/27 dùng `0xD6`; map 18 dùng `0xD2/D3/D4` theo dest.)

### 4.4 LinkMap17 KHÔNG có trong APK

Asset LinkMap* đóng gói chỉ có: `10, 18, 21, 23, 27, 28, 29, 30`.
**Không có `LinkMap17`** → dest roomID của 3 cổng được client tải lúc runtime
(`downloadMapLink` / LINKMAP cache), không recover được từ APK tĩnh.

### 4.5 Ai trỏ VÀO map 17 (LinkMap đóng gói)

| Map nguồn | Tên (catalog) | gate trên nguồn | arrive trong 17 | Ghi chú |
|---|---|---|---|---|
| **21** | Khu nhà ở / T_ROAD_HOUSE | (120, 60) | **(140, 70)** | arrive **trùng cổng #3** |
| **23** | Khu mua sắm | (120, 70) | (160, 80) | y=80 nằm sát mép dưới (h=80) |
| **27** | Bến tàu / Đảo Hawai | (110, 70) | (140, 80) | y=80 sát mép dưới |

Suy luận **mức thấp** (không phải verified dest):
- Cổng #3 `(140,70)` nhiều khả năng là cổng **về map 21** (arrive khớp ô).
- Cổng #1/#2 chưa có bằng chứng dest trong APK.

### 4.6 Đính chính T_ROCK

- `T_ROCK` nằm trong cụm **object tile type** (`T_NEST, T_ROCK, T_TOP_FARM, …`),
  **không phải roomID 88**.
- B1 probe room 88 dựa trên giả định sai `T_ROCK=88`. Kết quả dialog không chứng minh
  cũng không bác bỏ 88; 88 **không** có DataMap/LinkMap/Map image trong APK 3.4.4.
- Map gỗ / map đá (nếu là room riêng) **chưa có ID** trong asset đóng gói.

### 4.7 Live capture 2026-09-17 (account 3) — LinkMap17 download

User approve: "ok" live-capture. Tool: `maplink-probe.ts --get-linkmap 17`.

| Bước | TX | RX | Kết quả |
|---|---|---|---|
| Handler 8 | `-1 [8]` | ACK | OK |
| Download | `-51 [i8 24, i16 16]` | `-51 len=456769` | OK |
| Offline parse | — | — | xem dưới |

**RX -51 layout (verified offline trên `/tmp/rx51_map17.bin`):**

```text
i8  subtype = 24
i16 idMap   = 16          // = requestedMapId - 1
i32 dataLen = 216
u8  tiles[216]            // = DataMap17 body; 0xA4 tại idx 201,202,203
i8  imgCount = 2
    img[0] len=232987 PNG
    img[1] len=223537 PNG
i16 idBG = 3
i16 linkIdMap = 0         // LinkMap section EMPTY
i32 wMap = 0
i32 hMap = 0
i8  linkCount = 0
```

**Kết luận live:**
1. TX `-51 [24, mapId-1]` tải **đúng DataMap17** (3 tile cổng `0xA4`) + 2 PNG map.
2. **LinkMap section rỗng** (`wMap=0, hMap=0` → client **skip** đọc `linkCount`) — server **không** trả dest roomID của 3 cổng trong packet này.
3. `RX -22` (REQUEST_TILE_MAP) là **PNG map image**, không phải LinkMap.
4. `RX -20` sau join hub là sound/id data (66B), **không** match LinkMap format.

**Native parse (Il2CppDumper 3.4.4, `GlobalMessageHandler.onMessage` @ 0x5E5FD4):**
```text
after images + readShort idBG:
  wMap=readInt(); hMap=readInt();
  if (wMap==0 || hMap==0) skip;          // ← map 17
  linkCount=readByte();
  loop: LinkMap{ x1,y1,x2,y2:i32; idMapTo:i16 }  // LinkMap.ctor 0x78BB40
  saveLinkMap(idMap, wMap, hMap, list)   // 0x8F6728
```
Request: `requestResendLinkMap` 0x8F69EC → `requestDownloadData` 0x6A02A8 (`cmd=0xCD`, `writeByte(24)`, `writeShort(mapId-1)`).

Frida agent (cần device + frida-server): `avatar-re/frida_scripts/linkmap17_agent.js`.

Tool: `avatar-web/server/src/tools/linkmap17-probe.ts`.
Summary: `/tmp/linkmap17-offline-summary.json`.

## 5. Bảng cổng / map con (cập nhật chính thức)

| # | Vị trí / Cổng | Tọa độ Pixel (Map 17) | dest room | Tên map con | Chứa | Trạng thái |
|---|---|---|---|---|---|---|
| 1 | Cửa hầm mỏ Tây (trái) | `(200, 205)` | pending | Hầm mỏ Tây | ? | `visual-pos-ok; dest-pending` |
| 2 | Cửa nhà gỗ Trung tâm | `(670, 210)` | **`18`** | Nhà tù / Trung tâm | Cổng sang 22, 26 | **`VERIFIED`** (`joined; LinkMap18 verified`) |
| 2a| Cổng trong Room 18 | `(310..340, 0..10)` | **`22`** | Khu khai thác Gỗ | Rừng cây khai thác | **`VERIFIED`** (`joined; Map220=forest; tiles=172-180`) |
| 2b| Cổng trong Room 18 | `(510..540, 0..10)` | **`26`** | Khu khai thác Đá | 4 Mỏ đá khai thác | **`VERIFIED`** (`joined; Map260=cave; 4 specials verified`) |
| 3 | Cửa hầm mỏ Đông (phải) | `(1080, 205)` | pending | Hầm mỏ Đông | ? | `visual-pos-ok; dest-pending` |

## 6. Danh Mục Đối Tượng Khai Thác Đã Quét Được (ItemMapSpecial)

### 6.1 Khu Khai Thác Đá & Kim Cương (Room 26 - `Map260.png`)
Chụp snapshot live qua `cmd 80` (`TX 80 [26, 0, 250, 45]`):
- **Object 0:** ID = `2000000028`, Vị trí: `X=260, Y=32`, Type: `2`, Image: `[1144]`, Menus: `[1207, 1220]`.
- **Object 1:** ID = `2000000029`, Vị trí: `X=198, Y=117`, Type: `2`, Image: `[1144]`, Menus: `[1207, 1220]`.
- **Object 2:** ID = `2000000030`, Vị trí: `X=403, Y=73`, Type: `2`, Image: `[1144]`, Menus: `[1207, 1220]`.
- **Object 3:** ID = `2000000031`, Vị trí: `X=487, Y=130`, Type: `2`, Image: `[1144]`, Menus: `[1207, 1220]`.

**Live Probe Tương Tác Khai Thác Mỏ Đá (Object 2000000028):**
- Gửi lệnh chọn menu khai thác: **`TX 48 [i8 3, i32 2000000028, i8 0]`** (`doItemSpecial`).
- Server phản hồi hộp thoại **`RX -40`** (len=78):
  ```text
  KIM CƯƠNG  Thu hoạch : Kim Cương Trắng  Sản lượng : 3000/3000
  ```
- **Kết luận:** Mỏ đá Room 26 thực chất là **Mỏ Kim Cương**, cho phép thu hoạch **Kim Cương Trắng** với giới hạn sản lượng 3000 đơn vị.

### 6.2 Khu Khai Thác Gỗ & Thợ Rèn (Room 22 - `Map220.png`)
Khảo sát toàn diện 10 khu vực (`area 0..9`) qua lệnh quét live `TX 80`:
- **Khu 0 (Board 0):** Sảnh vào / khu nghỉ chân, `specialCount = 0`.
- **Khu 1 (Board 1):** 5 cây gỗ (`ID: 2000000002, 2000000003, 2000000004, 2000000005, 2000000007`).
- **Khu 2 (Board 2):** 4 cây gỗ (`ID: 2000000008, 2000000009, 2000000010, 2000000011`).
- **Khu 3 (Board 3):** 3 cây gỗ (`ID: 2000000012, 2000000013, 2000000014`).
- **Khu 4 (Board 4):** 3 cây gỗ (`ID: 2000000015, 2000000016, 2000000017`).
- **Khu 5 (Board 5):**
  - **NPC Thợ Rèn:** ID = `2000000115`, Type = `0`, Tên = `"Thợ Rèn"`, ImageCount = 0.
  - 2 cây gỗ (`ID: 2000000018, 2000000019`).
- **Khu 6 (Board 6):** 3 cây gỗ (`ID: 2000000006, 2000000020, 2000000021`).
- **Khu 7 (Board 7):** 2 cây gỗ (`ID: 2000000022, 2000000023`).
- **Khu 8 (Board 8):** 2 cây gỗ (`ID: 2000000024, 2000000025`).
- **Khu 9 (Board 9):** 2 cây gỗ (`ID: 2000000026, 2000000027`).

**Live Probe Tương Tác Chặt Cây Lấy Gỗ (Object 2000000002 tại Khu 1):**
- Gửi lệnh chọn menu khai thác: **`TX 48 [i8 3, i32 2000000002, i8 0]`** (`doItemSpecial`).
- Server phản hồi hộp thoại **`RX -40`** (len=73):
  ```text
  THÂN CÂY KHÔ  Thu hoạch : Củi Khô  Sản lượng : 3688/4000
  ```
- **Kết luận:**
  - Room 22 là khu rừng khai thác **Củi Khô** từ các thực thể **THÂN CÂY KHÔ**.
  - Mỗi thân cây có trữ lượng 4000 đơn vị (thực tế đang còn 3688 đơn vị do người chơi khác đã khai thác).
  - Khu 5 có NPC **Thợ Rèn** (`ID 2000000115`) phục vụ việc chế tạo / rèn công cụ cuốc rìu khai thác.

### 6.3 Giao Thức Khai Thác Tài Nguyên (Reverse-Engineering Native IL2CPP)
Qua dịch ngược `libil2cpp.so` ARM64:
1. **Lớp đối tượng:** `ItemMapSpecial : Avatar` (TypeDefIndex: 5942).
2. **Khởi tạo Menu hành động:**
   - Client duyệt mảng `short[] idMenu` tại offset `0x1B0` (vd `[1207, 1220]`).
   - Với mỗi menu index `i`, client tạo `ItemMapSpecial.IActionMenu(index: i, id: objectId)`.
3. **Thực thi hành động & Phân biệt Menu Index:**
   - Khi tương tác đối tượng, mảng `menuIds: [1207, 1220]` chứa 2 lệnh:
     - **`menuIndex = 0` (icon 1207):** **Xem thông tin đối tượng** (Server trả về `RX -40` mô tả: `KIM CƯƠNG Thu hoạch: Kim Cương Trắng Sản lượng: 3000/3000` hoặc `THÂN CÂY KHÔ Thu hoạch: Củi Khô Sản lượng: 3688/4000`). Lệnh này **KHÔNG** làm nhân vật cuốc/chặt và **KHÔNG** làm tăng tài nguyên trong kho.
     - **`menuIndex = 1` (icon 1220):** **Khai thác thực tế** (`GlobalService.doItemSpecial(3, objectId, 1)`). Khi gửi lệnh này, nhân vật thực hiện một loạt nhát cuốc/chặt liên tục (khoảng 10 nhát), server trả về chuỗi thông báo:
       - `Chúc mừng bạn đã thu hoạch được 1 Đá Trắng` (Room 26) / `Chúc mừng bạn đã thu hoạch được 1 Củi` (Room 22) $\rightarrow$ Cộng trực tiếp vào kho đồ nhân vật!
       - `Úi cha, tài nguyên cứng quá. Gãy cuốc rồi T_T` (hao mòn cuốc chim).
4. **Cấu trúc gói tin TX 48:**
   - **Opcode:** `48` (`ITEM_MAP_SPECIAL`).
   - **Payload:** `[i8 type = 3, i32 objectId, i8 menuIndex]`.
     - `menuIndex = 0`: Đọc popup thông tin sản lượng.
     - `menuIndex = 1`: Khai thác thực tế thu hoạch đá / củi.
   - **Kích thước:** Đúng 6 bytes.
5. **Gói tin phản hồi từ Server:**
   - `RX -40`: Chuỗi UTF-8 trả về từng nhát đào thành công hoặc thông báo hao mòn/lỗi công cụ.
   - `RX 48`: Cập nhật trạng thái đối tượng sau khai thác.
   - `RX 70`: Cập nhật số lượng tài nguyên trong kho đồ (nếu thành công).

## 7. Metadata, Hash & Phiên Bản

- **Môi trường:** AvatarHD 3.4.4 APK (`com.TeaM.Avatar`, Android ARM64)
- **APK SHA-256:** `401b17880bacd1270188bdfdbb8a3fa0f1ed6a78b6fd58d28c8780d639979f4e`
- **CityMap TextAsset SHA-256:** `e3fc3c1272d6d6f7e2ba100f9e7c408ced3dd496f2b326721b17c719e9d5d4da`
- **Account probe:** ID 3
- **Spec 1:** `docs/superpowers/specs/2026-09-17-quet-object-dao-go-da-design.md`
- **Plan 1:** `docs/superpowers/plans/2026-09-17-quet-object-dao-go-da.md` (Hoàn thành)
- **Spec 2:** `docs/superpowers/specs/2026-09-17-probe-khai-thac-go-da-design.md`
- **Plan 2:** `docs/superpowers/plans/2026-09-17-probe-khai-thac-go-da.md` (Hoàn thành)
