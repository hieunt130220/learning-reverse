# Phân tích kỹ thuật giao thức — Di chuyển Map & Tìm NPC trong AvatarHD

> **Ngày:** 2026-08-21 · **Phạm vi:** APK AvatarHD 3.4.4 (`com.TeaM.Avatar`, server private `27.0.14.120:19129`) — disassembly native (`libil2cpp.so`) + `script.json`/`dump.cs` + jump table RX + probe thật phiên trước.
> **Mức độ xác minh:** toàn bộ payload TX được xác minh bằng chuỗi lời gọi `myWriter` trong native; bảng handler/jump-table RX được xác minh bằng disassembly; gói `enter-world` (cmd -34) và `JOIN_OFFLINE_MAP` (-99) đã xác minh bằng probe thật. Chưa probe live được luồng vào khu có NPC (tài khoản test đang bị server giữ session / rate-limit) — các mục chưa chốt được đánh dấu ⚠️.

## 1. Kết luận nhanh

Để "tìm NPC" (NPC sự kiện như Ngưu Lang/Chức Nữ), bot cần 3 thứ: **đổi context bản đồ**, **di chuyển map/khu**, và **đọc danh sách NPC trên map hiện tại**.

| Thứ | Command | Hàm | Body | Trạng thái |
|---|---|---|---|---|
| Context | `-1 GET_HANDLER` | `GlobalService.getHandler` | `[i8 index]` | ✅ verified |
| Vào khu | `80 AVATAR_JOIN_PARK` | `ParkService.doJoinPark` | `[i8 roomID][i8 boardID]` | ✅ verified |
| Chọn khu | `-23 SELECTED_MINI_MAP` | `GlobalService.doSelectedMiniMap` | `[i8 idCityMap][i8 id]` | ✅ verified |
| Xin map | `-24 REQUEST_CITY_MAP` | `GlobalService.requestCityMap` | `[i8 idMini]` (idMini<0 → body rỗng) | ✅ verified |
| Join bất kỳ | `-21 REQUEST_JOIN_ANY` | `GlobalService.requestJoinAny` | `[i8 @0xC2][i8 @0xC1][i16 idJoin]` | ✅ verified |
| Map offline | `-99 JOIN_OFFLINE_MAP` | `GlobalService.doJoinOfflineMap` | `[i8]` | ✅ verified (RX thật `01 00 00 00`) |
| Dữ liệu map | `-34 LOGIN_SUCESS` (enter-world) | `GlobalMessageHandler.onMessage` | players + mapItem + anim + **special (NPC)** | ✅ verified (probe thật) |
| Player vào board | `81 PLAYER_JOIN_PARK` | `ParkMsgHandler.playerJoinBoard` | 1 player (i32 id, utf name, …) | ✅ verified static |

**NPC = `ItemMapSpecial`** (subclass của `Avatar`): có `id`, `name`, `idImg[]`, `idMenu[]`, `type`. Danh sách NPC của map hiện tại được đóng trong gói **enter-world (cmd -34)** — tức bot phải **vào lại map** (hoặc đổi khu) để quét NPC mới.

## 2. Cơ chế handler context (`GET_HANDLER -1`)

Server chỉ tuyến command theo context. Client chuyển context bằng `GET_HANDLER (-1) + i8 index` (`GlobalService.getHandler @0x69B674` — `Message.create(-1)` + `writeByte(index)` + `send`). `GlobalLogicHandler.doGetHandler @0x5E4974` rẽ nhánh theo index:

| index | Handler được kích hoạt | Ghi chú |
|---|---|---|
| `3` | `CasinoMsgHandler.onHandler @0x66A56C` | casino + `onJoinCasino` |
| `8` | `AvatarMsgHandler.onHandler @0x95F868` | context game chính; nếu có map offline chờ (`[session+0xB8+0xD0] != -1`) gửi tiếp `doJoinOfflineMap`. **Đây là index handshake gửi** (`CLIENT_TYPE=8`). |
| `9` | `ParkMsgHandler.onHandler @0x718D2C` | context bản đồ thành phố/công viên; tiếp theo `MapScr.joinCitymap @0x6141B8` (nạp danh sách bản đồ) rồi `doSetHandlerSuccess`. **"Exit to city" = gửi `getHandler(9)`** (`LoadMap.IActionExitToCity @0x84242C`). |
| `10` | `FarmMsgHandler.onHandler @0x633FCC` | nông trại; tự gửi `doJoinPark(0x19, 0)` + `FarmMsgHandler.init` + `doJoinFarm` (cmd 69). `0x19 = 25 = MapScr.NONG_TRAI`. |

> ⚠️ Chú thích cũ trong `client.ts` ghi "8/9/10 = farm" là **sai** — 8 = AvatarMsgHandler (game chính), 9 = ParkMsgHandler (bản đồ thành phố), 10 = FarmMsgHandler.

Các handler RX này dùng **jump table riêng**:
- `ParkMsgHandler.onMessage @0x718DC8`: `cmd = w8 - 0x4F`, bảng `@0x14E3CA8` (15 mục, cmd **79–93**); riêng cmd **-111** (`INFO_FISH`) là nhánh `onInfo @0x5DF330`.
- `AvatarMsgHandler.onMessage @0x95F8EC`: `cmd = w8 + 0x2E`, bảng `@0x14F2920` (6 mục, cmd **-46…-41** — `GET_AVATAR_PART`/`GET_IMAGE`/`GET_BIG`/`BUY_ITEM_STACK`/`LOGIN_NEW_GAME`/`SET_BIG`).

## 3. Payload TX — di chuyển map/khu

### 3.1. Vào khu/bản đồ — `doJoinPark(roomID, boardID)` cmd 80

```text
cmd 80
body:
  i8 roomID     // định danh bản đồ/khu (xem §6 — trùng hằng số zone)
  i8 boardID    // số hiệu bảng/khu con; -1 = board mặc định
```

`ParkService.doJoinPark @0x718188`: `Message.create(80)` → `writeByte(roomID)` → `writeByte(boardID)` → `send`. Các call site quan trọng:

- `GlobalLogicHandler.doGetHandler` (farm, case 10): `doJoinPark(0x19=25, 0)` → **nông trại = roomID 25 (NONG_TRAI), board 0**.
- `MapScr.doJoin @0x6217E4` (bấm chọn vị trí trên màn hình map): `doJoinPark(zoneType, -1)` — `zoneType` đọc từ mảng zone của bản đồ (`ldrsb [x8+0x20]`).
- `LoadMap.doJoin @0x8CEB10` (case `typeMap=0`): `doJoinPark(typeMap, -1)`.
- `ParkListSrc.doSelect @0x7180FC` (chọn công viên từ danh sách): `doJoinPark(...)`.
- `HouseScr.doOut @0x8EFA10` (ra khỏi nhà): `doJoinPark(...)`.
- `FarmMsgHandler.onMessage @0x635810` (RX farm): `doJoinPark(...)`.

### 3.2. Chọn khu từ minimap — `doSelectedMiniMap(idCityMap, id)` cmd -23

```text
cmd -23
body:
  i8 idCityMap   // id bản đồ
  i8 id          // id khu trong bản đồ
```

`GlobalService.doSelectedMiniMap @0x69F690`. Gọi từ UI: `MapScr.commandActionPointer @0x612F00` (chạm minimap) và `GlobalMessageHandler.IActionMiniMap.perform @0x789830` (action server đẩy → client chọn khu).

### 3.3. Xin danh sách bản đồ — `requestCityMap(idMini)` cmd -24

```text
cmd -24
body:
  i8 idMini          // idMini < 0 (vd -1) → KHÔNG ghi byte (body rỗng)
```

`GlobalService.requestCityMap @0x69F2A4`. Gọi từ:
- `MapScr.joinCitymap @0x614AC8` — sau khi client nhận/nạp danh sách bản đồ (luồng sau `GET_HANDLER 9`).
- `LoadMap.doJoin @0x8CF5C0` — case T_CITY: `requestCityMap(0xFF = -1)` → body rỗng → server đẩy danh sách bản đồ thành phố.

### 3.4. Join bất kỳ — `requestJoinAny(idJoin)` cmd -21

```text
cmd -21
body:
  i8 a = [Session_ME +0xB8 +0xC2]
  i8 b = [Session_ME +0xB8 +0xC1]
  i16 idJoin
```

`GlobalService.requestJoinAny @0x69F7CC`: `writeByte(@0xC2)` → `writeByte(@0xC1)` → `writeShort(idJoin)`. Hai byte đầu là trạng thái context/session đang giữ (offset 0xC1/0xC2 của đối tượng session). Gọi từ `LoadMap.doJoin @0x8CF334` (với `idJoin=4`) và `@0x8CF990` (với `idJoin=0`). ⚠️ Giá trị chuẩn của 2 byte @0xC1/@0xC2 chưa xác minh live — probe với `[0,0]` không phản hồi.

### 3.5. Map offline — `doJoinOfflineMap(i)` cmd -99

```text
cmd -99
body:
  i8 i
```

`GlobalService.doJoinOfflineMap @0x6A0664` — chỉ gọi từ `doGetHandler` case 8 khi có map offline chờ. Probe thật trả về RX 4 byte `01 00 00 00`.

### 3.6. Liên quan: feel/đánh — `doFeel(focusFeel)` cmd 87

```text
cmd 87
body:
  i8  focusFeel   // lặp lại
  i16 feel        // lặp lại 2 lần (4 byte tổng)
```

`AvatarService.doFeel @0x960F1C` — viết **cả 2 giá trị, mỗi giá trị 2 lần**. `feel=8` (DAN — đánh), `feel=11` (KISS — hôn). Đây là "hành động" trên đối tượng đang focus — ứng viên cho thao tác đánh NPC, ⚠️ chưa xác minh live. `MENU_ROTATE (-83)` = `doRequestCmdCouple(idAction, idFocus)` body `[i16 idAction][i32 idFocus]`.

## 4. Payload RX — trạng thái map

### 4.1. Enter-world — cmd -34 (`LOGIN_SUCESS`)

Gói snapshot map đầy đủ, decode tại `GlobalMessageHandler.onMessage @0x5E6F00` (đã verify trọn bằng probe thật phiên trước — tài khoản test, 220 byte):

```text
i8  flag · i32 id · utf str · i8 · i8 · i16 · i16
<readListPlayer>      @0x5F8DE8   // nPlayer, mỗi player: i32 id, utf name, i8 nPart, nPart×i16, 15 field trạng thái
i16
<readMapItemType>     @0x5F9E1C   // nType × { i8, i16, i8, i16, i16, nPos × (i8 x, i8 y) }
<readMapItem>         @0x5FA174   // nItem × { i8, i8, i8, i8 }
i8 nAnim · nAnim × { i16, i32, i32 }            // @0x5E7008
i8 nSpecial · nSpecial × <readItemDataMapSpecial> // @0x5E7130  ← NPC
```

Kết quả probe thật (map khởi tạo, không có NPC): `flag=1, id=136826058, str="xinkn01", ab=[6,0], hdr=[12389,0], player{nPlayer=0}, s=12133, mapType=0, mapItem=0, anim=0, special=0`.

### 4.2. Player vào board — cmd 81 (`PLAYER_JOIN_PARK`)

`ParkMsgHandler.onMessage` cmd 81 → `playerJoinBoard @0x719EB4`: decode **1 player** đúng cấu trúc `readListPlayer` (i32 id → `Avatar+0x38`, utf name → `setName`, i8 nPart + nPart×i16, rồi i16 x/y, i8, i8, i8, i16, i8, i8, i16, i16, i16, i8, i16, i8, i8…) → `MapScr.onPlayerJoinPark @0x61C7AC`.

### 4.3. Bảng command park — cmd 79–93

| cmd | Ý nghĩa (tên) | Target jump table @0x14E3CA8 |
|---|---|---|
| 79 | `CAN_CAU` (bắt đầu câu cá) | `@0x718F68` — i32 idUser, i16 idFish, i16 timeDelay, 2 mảng ảnh |
| 80 | (join park — TX, không RX) | — |
| 81 | `PLAYER_JOIN_PARK` | `@0x7193CC` → `playerJoinBoard` |
| 83 | `MENU_ROTATE` | `@0x7193E0` → `onMenuRotate` |
| 87 | `AVATAR_FEEL` | `@0x719498` → `onFeel` |
| 89 | (drop/gift…) | `@0x71927C` |
| 93 | (…park) | `@0x7191FC` |

## 5. NPC — `ItemMapSpecial`

`dump.cs`:

```csharp
public class ItemMapSpecial : Avatar {
    public int id;        // 0x19C
    public string name;   // 0x1A0  ← tên NPC (so với npcName user nhập)
    public short[] idImg; // 0x1A8
    public short[] idMenu;// 0x1B0
    public sbyte type;    // 0x1B8
    // + toạ độ/thông tin chạm/block kế thừa Avatar
}
```

`AvatarData.readItemDataMapSpecial @0xA0C280` — verify trọn (đã có trong `avatar-re/frida_scripts/parser.ts`):

```text
i32 · utf(name) · i32 · i32 · i8
i8 nS1 · nS1 × i16
8 × i32
i8 nS2 · nS2 × i16
```

Chỉ có **2 call site**, cả hai trong `GlobalMessageHandler.onMessage`: `@0x5E716C` (đuôi enter-world cmd -34) và `@0x5EDE68`. → **NPC chỉ xuất hiện trong gói enter-world**; bot muốn quét NPC phải thực hiện di chuyển map/khu (đổi context, join khu) để server đẩy lại snapshot.

## 6. Hằng số map/zone

`LoadMap..cctor @0x8E25EC` (sbyte):

| Hằng | Giá trị |
|---|---|
| `LoadMap.T_CITY` | 9 |
| `LoadMap.T_KHU_MUA_SAM` | 23 |
| `LoadMap.T_FARM` | 24 |
| `LoadMap.T_FARMWAY` | 25 |
| `LoadMap.T_FARM_FRIEND` | 53 |

`MapScr..cctor @0x627290` (int):

| Hằng | Giá trị |
|---|---|
| `MapScr.KHU_GIAI_TRI` | 9 |
| `MapScr.CONG_VIEN` | 11 |
| `MapScr.KHU_SINH_THAI` | 13 |
| `MapScr.KHU_NGOAI_O` | 17 |
| `MapScr.KHU_MUA_SAM` | 23 |
| `MapScr.NONG_TRAI` | 25 |
| `MapScr.ME_CUNG` | 28 |

**Bằng chứng roomID cmd 80 trùng hằng số zone:** doGetHandler case 10 (farm) gọi `doJoinPark(0x19, 0)` với `0x19 = 25 = MapScr.NONG_TRAI`.

`LoadMap.getTypeMap @0x8CD284` trả về **type của ô (x,y)** trên lưới zone của thành phố (đọc `[session+0xB8+0x28]` = cột, `[+0x40]` = hàng, mảng zone `[+0x30]`), và `LoadMap.doJoin @0x8CEB10` rẽ nhánh theo `typeMap + 2` qua jump table — các type khác nhau đi các luồng join khác nhau (park, farm, farm-friend, offline map…). Case `typeMap=18` gửi `getHandler(9)` (chuyển context park).

## 7. Đối chiếu "Map X - Khu Y" của 4utovip

Dữ liệu thật `api/npc/events.php` (2026-08-21, sự kiện Thất Tịch):

| Thời điểm | NPC | Vị trí |
|---|---|---|
| 21:10:32 | Ngưu Lang | **Map 5 - Khu 7** |
| 21:12:36 | Ngưu Lang (respawn) | **Map 2 - Khu 6** |

Giả thuyết mạnh nhất: **"Map X" = `roomID`, "Khu Y" = `boardID`** của cmd 80 (`doJoinPark`), hoặc cặp `(idCityMap, id)` của cmd -23 (`doSelectedMiniMap`) — đúng nghĩa "bản đồ X, khu Y" trong UI game. ⚠️ Giá trị số (5/2, 7/6) **chưa khớp trực tiếp** với hằng số zone (9/11/13/17/23/25/28) — có thể 4utovip dùng `map_id` riêng của server (không phải hằng số client), hoặc NPC sự kiện chỉ spawn ở một tập con map có id 1..N riêng. Cần probe live để chốt:

1. Login tài khoản rảnh → `GET_HANDLER 9`.
2. `cmd 80 [i8 roomID][i8 boardID]` với roomID 0..8 → quan sát RX cmd 81 / cmd -34.
3. Đối chiếu NPC thấy được (tên trong `ItemMapSpecial`) với `map_id`/`zone` trên `events.php`.

## 8. Hướng implement "Tìm NPC" trong avatar-web

Luồng gợi ý (chưa phải Spec/Plan — tạo theo AGENTS.md khi bắt đầu implement):

1. **Đổi context** — sau login, gửi `GET_HANDLER (-1) + i8 9` (chuyển sang handler bản đồ/park). Tránh gửi lại khi đang ở context đó (server có thể đóng socket như trường hợp farm).
2. **Duyệt khu** — với từng `(map, khu)` cần quét: gửi `cmd 80 [i8 map][i8 khu]` (hoặc `-23 [i8 idCityMap][i8 id]`); chờ RX.
3. **Quét NPC** — decode gói `-34` (enter-world) mỗi lần vào khu; lọc `ItemMapSpecial` có `name == npcName` (so chính xác, đúng yêu cầu 3x.4utovip).
4. **Đánh/nhận quà** — chưa chốt cmd (ứng viên `87 AVATAR_FEEL` feel=8 DAN, hoặc menu `-61 MENU_OPTION`/`-59 COMMUNICATE` — xem `farmService.ts:69-74`); cần xác minh live.
5. **Báo vị trí** — khi thấy NPC: lưu `(map, khu)` vào `currentMap`/`currentArea` (khớp live keys của 3x.4utovip), dừng quét, chuyển chế độ theo `npcCompletionMode`.

Cảnh báo:
- **Anti-cheat**: `AntiCheat.detectHackTeleport @0xA41010` (và `detectHackSpeed @0xA41014`?) — chuyển map/khu đột ngột liên tục có thể bị server nghi ngờ; nên có độ trễ hợp lý giữa các lần join.
- **NPC sống ~60s** — cơ chế chia sẻ vị trí (như `api/npc/events.php` của 4utovip) quan trọng hơn quét tuần tự.
- Server có rate-limit login ("đăng nhập quá nhanh") — không reconnect dồn dập.

## 9. Mức độ xác minh & việc còn lại

**Đã xác minh (static + probe):**
- Toàn bộ body TX §3 từ disassembly native (chuỗi `writeByte/writeShort/writeInt`).
- `doGetHandler` rẽ nhánh 3/8/9/10 + `getHandler(9)` từ `ExitToCity`.
- Jump table `ParkMsgHandler` cmd 79–93, `AvatarMsgHandler` cmd -46…-41.
- Gói enter-world cmd -34 (probe thật phiên trước), RX `-99` = `01 00 00 00`.
- `ItemMapSpecial` struct + decode `readItemDataMapSpecial`.

**Chưa xác minh (cần probe live khi có tài khoản rảnh):**
- ⚠️ Luồng `GET_HANDLER 9` → `cmd 80` → RX cmd 81 với map thật (tài khoản test đang bị chiếm/rate-limit).
- ⚠️ Giá trị 2 byte @0xC1/@0xC2 của `-21 REQUEST_JOIN_ANY`.
- ⚠️ Ý nghĩa số `map_id`/`zone` của 4utovip so với hằng số zone client.
- ⚠️ Command "đánh NPC nhận quà" (`d{sl}`/`ad{sl}` trong MOD).

**Lưu ý repo:** tài khoản test nằm trong `avatar-web/server/data/avatar-web.db`, pass giải mã bằng `MASTER_KEY` trong `.env` — không hiển thị/commit plaintext. Các script probe tạm (`probe_npc.tmp.mts`, `probe_park.tmp.mts`, `.probe.env`, `decode34.tmp.mjs`) không commit.
