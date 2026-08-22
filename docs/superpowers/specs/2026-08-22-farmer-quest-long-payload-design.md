# Sửa decode cmd -62 khi nội dung quest dài hơn 255 byte — Design Spec

- **Ngày:** 2026-08-22
- **Trạng thái:** Chờ duyệt
- **Liên quan:** `avatar-re/notes/quest-discovery.md`, commits `4a4bcd6`, `fd1dc80`

## Mục tiêu & Bối cảnh

Trong game, account `phu` đã chuyển từ **Nhiệm Vụ Nhà Nông - 1** sang **Nhiệm Vụ Nhà Nông 2**, nhưng web vẫn giữ Quest 1.

Điều tra live xác nhận server có trả Quest 2 qua cmd -62. Web không cập nhật vì decoder cmd -62 đang đọc sai trường độ dài khi nội dung quest lớn hơn 255 byte.

## Root cause đã xác minh

Raw cmd -62 đã bắt trước đây bắt đầu như sau:

```text
00 | 000c | "Nhiệm Vụ" | 00f0 | "Nhiệm vụ hiện tại..."
```

Format thật:

```text
[byte header=0]
[i16 len][UTF-8 title]
[i16 len][UTF-8 quest text]
```

Decoder hiện tại `decodeLenPrefixedStrings(buf, start=1)` lại đọc:

```text
[i8 len][UTF-8] lặp lại
```

Với Quest 1, text dài `0x00f0` (240 byte), parser i8 đọc nhầm byte cao `0x00` thành một chuỗi rỗng rồi byte thấp `0xf0` thành length 240. Do byte cao bằng 0, lỗi bị che giấu và parser tình cờ lấy được toàn bộ text.

Với Quest 2, text dài hơn 255 byte nên length bắt đầu bằng `0x01xx`. Parser i8 đọc `0x01` thành length=1, nuốt byte thấp length; sau đó coi ký tự đầu `N` (`0x4e`) là length tiếp theo. Kết quả quan sát live:

```text
["", "Nhiệm Vụ", "",
 "hiệm vụ hiện tại của bạn là nhiệm vụ:Nhiệm Vụ Nhà Nông ",
 " 2:\n- Thu hoạch 200 khóm ..."]
```

Chữ `N` đầu của `"Nhiệm vụ"` bị dùng làm length và mất khỏi text. Handler:

```ts
parts.find((s) => /nhiệm vụ hiện tại/i.test(s))
```

không match, nên giữ `farmerQuestState` cũ (Quest 1).

## Phạm vi

### In-scope

- Sửa decoder cmd -62 đọc `[i16 len][utf8]` từ offset 1.
- Đổi tên decoder để phản ánh đúng format, tránh tái sử dụng sai về sau.
- Cập nhật handler cmd -62 dùng decoder mới.
- Cập nhật tài liệu `avatar-re/notes/quest-discovery.md` để sửa kết luận cũ cmd -62 là i8.
- Xác minh bằng fixture raw packet Quest 1 và payload mô phỏng Quest 2 dài >255 byte; sau đó verify live khi account đăng xuất khỏi game thật.

### Out-of-scope

- Không thay đổi `parseQuestDialogText`.
- Không thay đổi `refreshProgressQuests`, userID mapping, API hoặc web UI.
- Không thay đổi parser cmd -81 (`parseQuestListPacket`) — cmd -81 vẫn có format i16 riêng và header khác.
- Không tự suy diễn quest từ farm data hoặc farm level.

## Thiết kế kỹ thuật

### Decoder mới

Trong `avatar-web/server/src/game/progressQuests.ts`:

```ts
export function decodeQuestDialogStrings(buf: Buffer, start = 1): string[] {
  const out: string[] = [];
  let offset = start;
  while (offset + 2 <= buf.length) {
    const length = buf.readUInt16BE(offset);
    offset += 2;
    if (offset + length > buf.length) break;
    out.push(buf.toString('utf8', offset, offset + length));
    offset += length;
  }
  return out;
}
```

Properties:
- Đọc length unsigned 16-bit big-endian đúng với `MyReader.readUTF()` / Java DataInput style.
- Không throw với trailing/truncated payload: dừng ở field không đầy đủ, giống behavior decoder cũ.
- Giữ `start=1` vì byte đầu cmd -62 là header/subtype `0x00`.

### Handler cmd -62

Trong `avatar-web/server/src/game/client.ts`:

```ts
const parts = decodeQuestDialogStrings(msg.getData());
const text = parts.find((s) => /nhiệm vụ hiện tại/i.test(s));
```

Không cần ghép chuỗi: với format i16 đúng, quest text là một field hoàn chỉnh, bất kể dài trên 255 byte.

### Data flow sau sửa

```text
cmd -62 raw
  → decodeQuestDialogStrings (i16 length)
  → ["Nhiệm Vụ", "Nhiệm vụ hiện tại ... Nhà Nông 2 ..."]
  → find("nhiệm vụ hiện tại")
  → parseQuestDialogText
  → farmerQuestState = Nhà Nông 2
  → emit('quests') → /api/:id/state → web
```

## Files liên quan

- Modify: `avatar-web/server/src/game/progressQuests.ts`
  - thay `decodeLenPrefixedStrings` (i8 sai) bằng `decodeQuestDialogStrings` (i16 đúng)
  - sửa comments cmd -62/cmd -81
- Modify: `avatar-web/server/src/game/client.ts`
  - đổi import và call trong handler cmd -62
- Modify: `avatar-re/notes/quest-discovery.md`
  - sửa format cmd -62 và lỗi lịch sử tương ứng
- Test: không tạo test file mới (theo CLAUDE.md không TDD; user không yêu cầu test). Dùng script fixture/probe sau production code.

## Edge cases

1. Quest text ≤255 byte: decoder i16 vẫn đọc đúng (khắc phục cơ chế “tình cờ chạy”).
2. Quest text >255 byte: decoder đọc đúng full field.
3. UTF-8 tiếng Việt nhiều byte: length tính theo byte, `Buffer.toString` decode đúng.
4. Payload truncated: trả các field hoàn chỉnh trước đó, handler không cập nhật nếu không có quest text.
5. Empty field (`length=0`): giữ chuỗi rỗng hợp lệ.

## Impact

- `parseQuestDialogText`: GitNexus risk **LOW**, không bị sửa.
- `GameClient.onMessage`: GitNexus risk **LOW**, 1 caller trực tiếp (`constructor`).
- `decodeLenPrefixedStrings` không có trong stale index; text search xác nhận chỉ production caller là handler cmd -62. Các reference khác chỉ nằm trong `/tmp` probe scripts.

## Verification Plan

1. Type-check: `npm run typecheck` trong `avatar-web/server/`.
2. Fixture Quest 1 raw prefix:
   - `00 000c "Nhiệm Vụ" 00f0 <240-byte text>` → 2 strings, quest text bắt đầu bằng `Nhiệm vụ`.
3. Fixture Quest 2 mô phỏng:
   - field text UTF-8 >255 byte → decoder trả nguyên text, không mất chữ `N`, `parseQuestDialogText` lấy đúng title `Nhiệm Vụ Nhà Nông 2`.
4. Live khi account phu không còn đăng nhập trong game thật:
   - connect web → refresh progress quests → `GET /api/accounts/2/state`
   - expected `quests.farmer.title` là `Nhiệm Vụ Nhà Nông 2`, source `game-dialog`.
5. Regression:
   - Tân Thủ vẫn decode đúng qua uid 19.
   - Upgrade requirements vẫn hoạt động.
6. Chạy `gitnexus_detect_changes` trước commit.
