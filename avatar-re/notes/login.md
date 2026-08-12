# Đăng nhập (Login) — com.TeaM.Avatar

Login **không phải mini-game** — chạy ở tầng session chính qua `GlobalService` (TX) và
`GlobalMessageHandler` (RX). UI ở `LoginScr` (field `tfUser` 0x38, `tfPass` 0x40, `tfIP`/`tfPort`).

## Luồng
1. `LoginScr.doLogin()` @0x6048E4 — validate user/pass, lấy `deviceUniqueIdentifier` (IMEI).
2. `LoginScr.login()` @0x60835C — gọi `Canvas.connect(host,port)` mở socket.
3. Sau connect + trao key (xem `analysis.md`), gửi gói login qua `GlobalService`.

## TX (client → server) — ✓ XÁC MINH tại RVA
| cmd | Tên | Hàm (GlobalService) | Body |
|---|---|---|---|
| **-33** (0xDF) | LOGIN_ACC | `login(user, pass, version)` @0x6991C8 | **utf user, utf pass, utf version** |
| **-32** (0xE0) | LOGIN_IMEI | `login()` @0x699324 | **utf imei** |
| **-30** (0xE2) | REQUEST_REGISTER | `requestRegister(user, pass, introCode, email)` @0x699D18 | **utf, utf, utf** (3 UTF; email có thể ở path khác) |
| **-87** (0xA9) | (getServerLoginInfo) | `getServerLoginInfo()` @0x699478 | i8 |

> ⚠ Schema cũ `LOGIN_ACC=[utf,utf,i8]` **SAI** — thực tế field thứ 3 là **utf version**, không phải byte type.
> Đã sửa trong `parser.ts`.

## RX (server → client) — dispatch `GlobalMessageHandler.onMessage` @0x5E5FD4
Dispatcher lớn (nhiều tầng: range-check + jump-table + so trực tiếp). Nhánh login dùng so **unsigned byte**:
- `cmp #0xdd` (=-35 LOGIN_FAIL) → handler @0x5E6CC8
- `cmp #0xde` (=-34 LOGIN_SUCESS) → handler @0x5E6980

| cmd | Tên | Đọc | Xử lý |
|---|---|---|---|
| **-35** (0xDD) | LOGIN_FAIL | **utf message** | `GlobalLogicHandler.onLoginFail` (hiện dialog lỗi) |
| **-34** (0xDE) | LOGIN_SUCESS | header + dữ liệu enter-world | vào game, load map |

### LOGIN_SUCESS = login-confirm + enter-world (không phải struct player đơn)
> ⚠ Lưu ý tên trùng: có 2 class `Avatar`. Class **player game** có `.ctor` @0x9FED74 + `setName`
> @0xA02A8C + `id`@0x38 (dùng trong `readListPlayer` — xác nhận đây là player). Class
> `UnityEngine.Avatar` (`.ctor(PlayableHandle)`, +SkeletonBone) là animation, khác hẳn.
> `onLoginSuccess()` @0x5E35CC không nhận Message (chỉ chuyển UI); toàn bộ đọc gói nằm trong `onMessage`.

Cấu trúc (✓ header verified; phần map dùng helper reader):
```
i8  flag
i32 id            -> [singleton+0x38]  (id/session)
utf str           (version/session; String.Equals kiểm tra)
// GlobalLogicHandler.onLoginSuccess()  (chuyển UI, không đọc)
i8, i8
// --- enter-world (@0x5E6F00) ---
i16, i16
<readListPlayer>       @0x5F8DE8   (danh sách người chơi quanh map)
i16
<readMapItemType>      @0x5F9E1C
<readMapItem>          @0x5FA174   (vật phẩm trên map)
i8, i16, i32, i32, …   (thêm trạng thái map)
```
→ Map đầy đủ các sub-list: `iladis.py 0x5F8DE8` (player), `0x5FA174` (map item), `0x5F9E1C` (item type).

### readListPlayer @0x5F8DE8 — ✓ XÁC MINH: cấu trúc 1 người chơi
> Object player là class **`Avatar`** (game): `.ctor` @0x9FED74, `setName` @0xA02A8C, `id` @+0x38.
> (Trùng tên với UnityEngine.Avatar nhưng đây là class player thật — có setName/id/toạ độ.)

```
i8  nPlayer
repeat nPlayer:
    i32 id                 -> Avatar+0x38
    utf name               -> setName
    i8  nPart
    repeat nPart: i16 partId     // SeriPart = trang phục/bộ phận avatar
    // 15 field trạng thái (thứ tự & width verified):
    i16, i16, i8, i8, i8, i16, i8, i8, i16, i16, i16, i8, i16, i8, i8
    // -> offsets Avatar: 0x11a,0x79,0x110,0x112,0x116,0x11c,0x124,0x81… (level/hp/toạ độ/hướng - suy đoán)
    checkBannedPlayer; addElement
```

### readMapItemType @0x5F9E1C — ✓ verify (MapItemType, có inner-loop AvPosition)
```
i8 nType
repeat nType:
    i8 a, i16 b, i8 c, i16 d, i16 e        // -> MapItemType +0x10..+0x1a
    i8 nPos
    repeat nPos: i8 x, i8 y                // AvPosition (toạ độ ô)
```
### readMapItem @0x5FA174 — ✓ verify (MapItem)
```
i8 nItem
repeat nItem: i8, i8, i8, i8               // -> MapItem +0x38,+0x3e,+0x10,+0x14
```

### Gói enter-world đầy đủ (LOGIN_SUCESS cmd-34) — ghép @0x5E6F00
```
i8 flag · i32 id · utf str · i8 · i8 · i16 · i16
<readListPlayer>  ·  i16  ·  <readMapItemType>  ·  <readMapItem>
i8 nAnim · nAnim×AnimItem{ i16, i32, i32 }          // @0x5E7008
i8 nSpecial · nSpecial×<readItemDataMapSpecial>     // @0x5E7130 (struct lớn - xem dưới)
…(còn nữa sau special)
```

### readItemDataMapSpecial @0xA0C280 — ✓ XÁC MINH TRỌN (hết reads → dựng ItemMapSpecial + orderVector)
```
i32 · utf · i32 · i32 · i8 · i8 nShort1 · nShort1×i16 · 8×i32 · i8 nShort2 · nShort2×i16
```
Sau nShort2 không còn read (chỉ `ItemMapSpecial.ctor` + `LoadMap.orderVector`).
> `decodeEnterWorld` giờ decode **trọn** enter-world: header → player → mapType → mapItem → anim →
> **special** (đầy đủ). Test end-to-end 0 byte dư. Handler có nhánh nên vẫn bọc `try` + `autoDecode`
> phần dư (nếu có field phụ sau special mà chưa trace).
Parser tự in dòng `world:` cho RX cmd-34 (hàm `decodeEnterWorld`). Cũng gọi tay được từ REPL Frida:
```js
decodeEnterWorld([...bytes...])   // hoặc decodeListPlayer([...])
// => flag=1 id=1001 str="v1" ab=[2,3] hdr=[10,20]
//    player{nPlayer=1 p0{id=5,name="A",parts=[7],state=[...]}}
//    s=99  mapType{nType=1 t0{1,2,3,4,5,pos=[(6,7)]}}  mapItem{nItem=1 i0{1,2,3,4}}
```
> Handler LOGIN_SUCESS có nhánh nên thứ tự ghép là best-effort; `decodeEnterWorld` bọc try và để
> `autoDecode` phần dư. Các field/`state[15]`/offset là width+thứ tự verified, tên semantic là suy đoán.

## Đã nạp vào parser (SCHEMAS)
`LOGIN_ACC` (utf×3), `LOGIN_IMEI` (utf), `REQUEST_REGISTER` (utf×3), `LOGIN_FAIL` (utf message), `VERSION` (utf).
Khi chạy `frida -U -f com.TeaM.Avatar -l _parser.js`, gói login sẽ hiện:
```
[TX] cmd=-33 (LOGIN_ACC) ...
      decode: [schema LOGIN_ACC] user:utf="..."  pass:utf="..."  version:utf="..."
[RX] cmd=-35 (LOGIN_FAIL) ...
      decode: [schema LOGIN_FAIL] message:utf="Sai mật khẩu"
```

## Ghi chú bảo mật
- Mật khẩu gửi **plaintext trong writeUTF** (chỉ được che bởi XOR-key ở tầng socket, xem `Session_ME.writeKey`).
  Hook `writeKey`/`LoginScr.doLogin` hoặc dùng parser TX là đọc được user/pass rõ.
- Đăng nhập IMEI (`deviceUniqueIdentifier`) cho phép login không mật khẩu theo thiết bị.
