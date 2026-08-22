# Hướng dẫn tìm & decode các loại Nhiệm Vụ (quest) nông trại — tránh lặp lại lỗi cũ

> **Mục đích:** Tài liệu này dạy cách **khám phá chuỗi nhiệm vụ mới** trong giao thức Avatar (server private, `27.0.14.120:19129`) và cách decode đúng, tổng hợp từ các lần điều tra thực tế (2026-08-21) để **KHÔNG lặp lại các lỗi đã mắc**.

## 1. Cơ chế cốt lõi (đã xác minh live)

**Mỗi chuỗi nhiệm vụ nông trại có một `userID` riêng** trong `doMenuOption(userID, menuIndex, subIndex)` (cmd -61 gửi đi: `writeInt(userID).writeByte(menuIndex).writeByte(subIndex)`).

| userID | Chuỗi quest | Trạng thái |
|--------|-------------|-----------|
| **19** | **Nhiệm Vụ Tân Thủ** | ✅ Đã implement (commit `fd1dc80`) |
| **35** | **Nhiệm Vụ Nhà Nông** | ✅ Đã implement (commit `4a4bcd6`) |
| **38** | Nhiệm Vụ Thợ Câu | Chưa hiển thị UI |
| **20** | Nhiệm Vụ Tháng 7 | Chưa hiển thị UI |
| **46** | Nhiệm Vụ Tiền Sử | Chưa hiển thị UI |
| 33 | VIP info | KHÔNG phải quest |

- NPC → userID: **NPC 90/91 → userID 35** (Nhà Nông), **NPC 95 → userID 38** (Thợ Câu). Server chấp nhận mọi userID quest kể cả sau `communicate(90)` (không cần NPC riêng).
- **Quan trọng:** quest KHÔNG liên quan farm level. Không bao giờ suy ra quest từ cấp độ nông trại.

## 2. Luồng hỏi quest (trong game)

Vào map Nông trại → bấm NPC **Lái buôn/Luffy** → chọn tab chuỗi quest (Tân Thủ/Nhà Nông/…) → "Xem nhiệm vụ hiện tại" hoặc "Xem danh sách nhiệm vụ".

```ts
c.enterFarm();                       // vào map nông trại
c.farm.communicate(90);              // cmd -59: mở NPC Lái buôn
await sleep(450);
c.farm.doMenuOption(19, 0, 0);       // cmd -61: userID=19 → "Xem nhiệm vụ hiện tại" → cmd -62
await sleep(500);
```

## 3. Các gói tin & format (đã xác minh)

### cmd -61 (menu response, trả về khi `communicate`)
```
[i32 userID][i16 count][(i16 len)+utf8]×count
```
Ví dụ: `00 00 00 23 | 00 02 | 00 1d "Xem nhiệm vụ hiện tại" | 00 1b "Xem danh sách nhiệm vụ"`
→ userID = 35. **userID đọc từ chính gói này** — không đoán.

### cmd -62 (nhiệm vụ hiện tại — có tiến trình)
```
byte0 = 0x00 (header), rồi lặp: [i16 len][utf8]
```
Raw packet đã xác minh bắt đầu: `00 | 000c | "Nhiệm Vụ" | 00f0 | "Nhiệm vụ hiện tại..."`. Length là **unsigned 16-bit big-endian** và tính theo số byte UTF-8.

Ví dụ phần tử chứa quest: `"Nhiệm vụ hiện tại của bạn là nhiệm vụ:Nhiệm Vụ Tân Thủ 2:\n- Mua 5 con gà  - 0/5\n- Mua 2 con cá chép  -Xong\n\nPhần Thưởng: \n - 5000 xu - 1 Tiến Sĩ vĩnh viễn …"`

**PHẢI lấy đúng phần tử** chứa `"nhiệm vụ hiện tại"` (`parts.find(s => /nhiệm vụ hiện tại/i.test(s))`), **KHÔNG join toàn bộ** các string lại với nhau.

> **Bẫy đã gặp:** Quest 1 có field dài 240 byte (`0x00f0`). Decoder i8 cũ đọc nhầm byte cao `0x00` thành chuỗi rỗng, rồi byte thấp `0xf0` thành length 240 nên tình cờ vẫn chạy. Quest 2 dài >255 byte (`0x01xx`) làm decoder i8 nuốt byte length thấp, dùng chữ `N` đầu của `"Nhiệm vụ"` làm length tiếp theo và chia vỡ text. Luôn đọc cmd -62 bằng i16.

### cmd -81 (danh sách nhiệm vụ — KHÁC cmd -62!)
```
[i16 len]"lsnhiemvu" [i16 len]"Danh Sách Nhiệm Vụ" [i32=15] [i32 count] ff ff
rồi count× : [i16 len]title + [i16 len]reward + ff ff
```
Cmd -81 cũng dùng **i16-len**, nhưng có header i32 count và separator riêng; dùng `parseQuestListPacket`, không dùng decoder cmd -62. Nhà Nông = 108 quest.

### cmd 104 (OPEN_INFO_FARM — tab "Nâng Cấp", KHÔNG phải chuỗi quest dialog)
- `action=1`: yêu cầu nâng cấp nông trại (`bool + 7 short + count + count×[type,(idFarm nếu 7/9),request,inStorage]`).
- `action=2/3`: `UpgradeFarmLvl2Scr` — missions nâng cấp, `screenType` 0=Nhà Nông, 1=Tân Thủ. Đừng nhầm đây là nguồn quest tiến trình chuỗi — chuỗi quest nằm ở cmd -62/-81.

## 4. Cách tìm chuỗi quest MỚI (sweep userID)

```ts
// Probe mẫu — chạy từ avatar-web/server/
//   npx tsx --env-file=.env /tmp/sweep-uid.ts
for (let uid = 1; uid <= 130; uid++) {
  c.farm.communicate(90);        // mở NPC (bắt buộc trước mỗi doMenuOption)
  await sleep(220);
  c.farm.doMenuOption(uid, 0, 0); // "Xem nhiệm vụ hiện tại" với mọi userID
  await sleep(330);
  // bắt cmd -62, decodeQuestDialogStrings (i16) → field chứa "nhiệm vụ hiện tại" → parse title
  // title chứa "Tân Thủ" → beginner, "Nhà Nông" → farmer, "Thợ Câu"/"Tháng 7"/"Tiền Sử" → chuỗi mới
}
```
Quy tắc:
- **Mỗi `doMenuOption` cần một lượt `communicate()` riêng** — server chỉ phản hồi trong farm handler, hai lượt liên tiếp không có communicate sẽ không trả.
- Khi thấy userID mới trả quest, **lưu vào bảng ở mục 1** + cập nhật file này.
- Nếu chỉ muốn "Xem danh sách" cho chuỗi mới: `doMenuOption(uid, 0, 1)` → cmd -81. (Lưu ý: userID 19 trả -81 len=1316 nhưng `parseQuestListPacket` ra 0 quest — danh sách Tân Thủ có cấu trúc khác, chưa cần.)

## 5. Data flow trong code (avatar-web)

```
refreshProgressQuests()  (GameClient, client.ts)
 └─ getInfoUpgradeFarm(1) → cmd 104 action=1 → farmUpgradeRequirements
 └─ communicate(90) → doMenuOption(35,0,0) → cmd -62 → farmerQuestState  (Nhà Nông)
 └─ communicate(90) → doMenuOption(35,0,1) → cmd -81 → questCatalog     (danh sách)
 └─ communicate(90) → doMenuOption(19,0,0) → cmd -62 → beginnerQuestState (Tân Thủ)
       → handler cmd -62: parts.find("nhiệm vụ hiện tại") → parseQuestDialogText
         → kind beginner/farmer theo title → emit('quests')
       → getQuestOverview() → /api/:id/state#quests.{daily,beginner,farmer,upgradeRequirements}
       → web: QuestsPanel tab beginner/farmer
```
Các file liên quan: `server/src/game/client.ts`, `server/src/game/progressQuests.ts`, `server/src/session/avatarSession.ts` (`getQuestOverview`), web `QuestsPanel.tsx`.

## 6. Các LỖI đã mắc — tránh lặp lại

| # | Lỗi | Hậu quả | Cách tránh |
|---|-----|---------|------------|
| 1 | Kết luận quest **liên quan farm level** ("level-gated 1→2") | Sai hướng điều tra, tốn thời gian | Quest lấy từ **hộp thoại NPC** (cmd -62/-81), không liên quan cấp độ |
| 2 | Query **nhiều chuỗi cùng lúc** (NPC 90 + NPC 95) | Phản hồi Thợ Câu ghi đè `farmerQuestState` | Chỉ query đúng userID mình cần; mỗi chuỗi ghi vào state khác nhau theo `kind` (beginner/farmer) — cùng kind sẽ ghi đè lẫn nhau |
| 3 | Đọc length cmd -62 bằng **i8** | Quest ngắn chạy tình cờ, quest >255 byte bị mất chữ đầu/chia vỡ text và web giữ state cũ | cmd -62 là **i16-len big-endian**; dùng `decodeQuestDialogStrings` |
| 4 | Dùng decoder cmd -62 cho cmd -81 hoặc **join toàn bộ** strings cmd -62 | Cmd -81 parse ra 0/1 quest; cmd -62 có title sai/kind sai | Cmd -81 dùng parser riêng có header i32 count; cmd -62 dùng i16 và `parts.find(s => /nhiệm vụ hiện tại/i.test(s))` |
| 5 | Đọc nhầm key JSON | Tưởng `upgradeRequirements` bị null | `/api/:id/state` chứa quest dưới **`quests`**, không phải `questOverview` |
| 6 | Tin tưởng `dump.cs` / `assembly-csharp.cs` | Mất thời gian tìm method body | `il2cpp_out/dump.cs` chỉ là **stub signature**; `notes/assembly-csharp.cs` là **.NET BCL** không phải game code. Tên quest ("Nhiệm Vụ Tân Thủ") **không có** trong `stringliteral.json` — server gửi text |
| 7 | Probe treo do account session conflict | Phải TaskStop | Dừng probe cũ trước khi chạy probe mới; chạy từ `avatar-web/server/` (cần `.env`) |
| 8 | Web session rớt khi sửa client.ts | "phiên chưa kết nối" | tsx watch restart làm mất session in-memory → reconnect `POST /api/accounts/:id/connect` |

## 7. Công cụ RE

- `avatar-re/tools/pktsig.py`, `iladis.py`, `xrefs.py` — chạy bằng `~/re-tools/frida-venv/bin/python`.
- `avatar-re/il2cpp_out/dump.cs` — stub signature (type/method chỉ, không có body).
- `avatar-re/il2cpp_out/stringliteral.json` — 12614 chuỗi (address → value); quest name nông trại KHÔNG có ở đây.
- `avatar-re/notes/farm.md`, `protocol.md`, `fishing.md`, `cooking.md` — ghi chú protocol từng hệ thống.

## 8. Quy trình phát triển (bắt buộc theo CLAUDE.md)

1. **Spec → Plan → Production Code**, có User Review Gate giữa các bước (docs trong `docs/superpowers/specs/` & `docs/superpowers/plans/`).
2. `impact()` (GitNexus) **trước khi sửa** symbol; `detect_changes()` **trước khi commit**; cảnh báo risk HIGH/CRITICAL.
3. **KHÔNG TDD** — chỉ viết test khi user yêu cầu, và sau khi code xong.
4. Verify live bằng probe (`/tmp/*.ts`) hoặc web session trước khi tuyên bố xong.
