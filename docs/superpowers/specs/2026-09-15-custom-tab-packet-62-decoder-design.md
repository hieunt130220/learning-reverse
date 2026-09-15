# Thiết Kế Decoder Gói Tin -62 (CUSTOM_TAB / Quest Dialog Chứa Ảnh)

## 1. Mục tiêu & Bối cảnh

### Vấn đề
Khi server Avatar gửi gói tin opcode `-62` (`CUSTOM_TAB`) chứa icon/ảnh đính kèm (ví dụ nhiệm vụ Thợ Câu, danh hiệu, hoặc thông báo sự kiện có hình ảnh), log hệ thống bị in ra chuỗi rác nhị phân:
```
1:30:36 PM thông báo (-62): | PNG    IHDRKK 8Nz  pHYs   MiCCPPhOtoshop ICC profile...
```
Đồng thời, nội dung văn bản nhiệm vụ thực sự nằm sau khối dữ liệu ảnh bị bỏ qua hoàn toàn, khiến bot không cập nhật được tiến độ nhiệm vụ.

### Nguyên nhân gốc rễ
Hàm giải mã hiện tại `decodeQuestDialogStrings` trong `progressQuests.ts` giả định sau byte đầu tiên (tưởng là header `0x00`) chỉ là chuỗi các cặp `[i16 length][utf8]`.

Trên thực tế, theo mã nguồn dịch ngược từ `GlobalMessageHandler.onMessage` (RVA `0x5E8ED8`) và `CustomTab.setInfo` (RVA `0xAEE6F8`) trong `libil2cpp.so`:
- **Byte 0**: `nImages` (số lượng ảnh PNG/JPEG đính kèm).
- **Nếu `nImages > 0`**, lặp `nImages` lần:
  - `i16 idImg` (2 bytes): ID ảnh.
  - `i16 imgLen` (2 bytes): Chiều dài byte dữ liệu ảnh.
  - `byte[imgLen]`: Dữ liệu nhị phân ảnh thô (PNG/JPEG).
- **Tiếp theo**:
  - `utf title`: Chuỗi UTF-8 (`i16 length` + chuỗi bytes UTF-8).
  - `utf content`: Chuỗi UTF-8 (`i16 length` + chuỗi bytes UTF-8 chứa văn bản nhiệm vụ / nội dung).
- **Đuôi (nếu còn byte `available() >= 1`)**:
  - `i8 idAction`: ID hành động phản hồi của CustomTab.

Khi `nImages = 0` (các quest Nhà Nông / Tân Thủ không có icon ảnh):
- Byte 0 = `0x00`.
- Decoder cũ tình cờ bỏ qua byte 0 (`start=1`) và đọc tiếp `title` rồi `content` nên trước đây vô tình hoạt động.

Khi `nImages > 0` (quest có icon cá/vật phẩm hoặc dialog sự kiện):
- Decoder cũ đọc byte 1-2 (`idImg`) thành độ dài chuỗi rỗng, byte 3-4 (`imgLen`) thành độ dài chuỗi UTF-8, nuốt trọn toàn bộ binary của PNG thành text string, làm hỏng con trỏ đọc dữ liệu và in ra rác nhị phân.

---

## 2. Phạm vi (Scope)

### In-scope
1. Tạo hàm decode chuẩn `decodeCustomTabPacket(buf: Buffer): CustomTabPacket` trong `avatar-web/server/src/game/progressQuests.ts`.
2. Định nghĩa interface `CustomTabPacket` và `CustomTabImage`.
3. Cập nhật handler `case -62:` trong `avatar-web/server/src/game/client.ts` để:
   - Dùng `decodeCustomTabPacket`.
   - Tìm text nhiệm vụ trong `tab.content` (hoặc `tab.title`).
   - Cập nhật đúng `beginnerQuestState`, `fishermanQuestState`, hoặc `farmerQuestState`.
   - Nếu không phải quest dialog: ghi log sạch sẽ (tiêu đề, tóm tắt nội dung, số lượng ảnh đính kèm), tuyệt đối không in binary PNG ra log.
4. Giữ hàm `decodeQuestDialogStrings` cho tương thích ngược (hoặc ủy quyền sang decoder mới).

### Out-of-scope
- Không can thiệp vào các opcode khác (`-81`, `-40`, `-60`, `-94`...).
- Không render ảnh PNG lên giao diện web nếu chưa có yêu cầu từ người dùng (chỉ lưu trữ buffer ảnh trong struct để sẵn sàng sử dụng khi cần).

---

## 3. Thiết kế kiến trúc & Giải pháp kỹ thuật

### Data Contracts & Interfaces

Trong `avatar-web/server/src/game/progressQuests.ts`:
```typescript
export interface CustomTabImage {
  id: number;
  data: Buffer;
}

export interface CustomTabPacket {
  nImages: number;
  images: CustomTabImage[];
  title: string;
  content: string;
  idAction?: number;
}
```

### Thuật toán giải mã `decodeCustomTabPacket`

```typescript
export function decodeCustomTabPacket(buf: Buffer): CustomTabPacket {
  if (buf.length < 1) {
    return { nImages: 0, images: [], title: '', content: '' };
  }

  let offset = 0;
  const nImages = buf.readInt8(offset);
  offset += 1;

  const images: CustomTabImage[] = [];
  if (nImages > 0) {
    for (let i = 0; i < nImages; i++) {
      if (offset + 4 > buf.length) break;
      const id = buf.readInt16BE(offset);
      const imgLen = buf.readUInt16BE(offset + 2);
      offset += 4;
      if (offset + imgLen > buf.length) break;
      const data = buf.subarray(offset, offset + imgLen);
      images.push({ id, data });
      offset += imgLen;
    }
  }

  // Đọc title (readUTF)
  let title = '';
  if (offset + 2 <= buf.length) {
    const titleLen = buf.readUInt16BE(offset);
    offset += 2;
    if (offset + titleLen <= buf.length) {
      title = buf.toString('utf8', offset, offset + titleLen);
      offset += titleLen;
    }
  }

  // Đọc content (readUTF)
  let content = '';
  if (offset + 2 <= buf.length) {
    const contentLen = buf.readUInt16BE(offset);
    offset += 2;
    if (offset + contentLen <= buf.length) {
      content = buf.toString('utf8', offset, offset + contentLen);
      offset += contentLen;
    }
  }

  // Đọc idAction (nếu còn byte)
  let idAction: number | undefined;
  if (offset < buf.length) {
    idAction = buf.readInt8(offset);
    offset += 1;
  }

  return { nImages, images, title, content, idAction };
}
```

### Handler `case -62:` trong `GameClient.onMessage`

```typescript
case -62: { // CUSTOM_TAB — Hộp thoại tùy chỉnh / "Xem nhiệm vụ hiện tại" (NPC Lái buôn)
  try {
    const tab = decodeCustomTabPacket(msg.getData());
    const text = [tab.content, tab.title].find((s) => /nhiệm vụ hiện tại/i.test(s));
    if (!text) {
      const parts: string[] = [];
      if (tab.title) parts.push(`tiêu đề="${tab.title}"`);
      if (tab.content) parts.push(`nội dung="${tab.content.replace(/\r?\n/g, ' ').slice(0, 120)}"`);
      if (tab.images.length > 0) parts.push(`ảnh=[${tab.images.map((img) => `#${img.id}(${img.data.length}B)`).join(', ')}]`);
      const summary = parts.join(' · ');
      if (summary.length > 0) {
        this.emit('log', `hộp thoại (-62): ${summary}`);
      }
      break;
    }
    const questState = parseQuestDialogText(text);
    if (questState) {
      if (questState.kind === 'beginner') {
        this.beginnerQuestState = questState;
      } else if (questState.kind === 'fisherman') {
        this.fishermanQuestState = questState;
      } else {
        this.farmerQuestState = questState;
      }
      this.emit(
        'log',
        `cập nhật ${questState.title}: ${questState.conditions
          .map((c) => `${c.name} (${c.current}/${c.total})`)
          .join(', ')}`,
      );
      this.emit('quests');
    }
  } catch (err) {
    this.emit('log', `giải mã nhiệm vụ hiện tại lỗi: ${(err as Error).message}`);
  }
  break;
}
```

---

## 4. Verification Plan

1. **Unit Test / Regression Check**:
   - Chạy test suite hiện có của server: `npm run build && npm test` trong `avatar-web/server`.
   - Đảm bảo các gói tin cũ không bị vỡ.
2. **Kiểm tra với payload có ảnh**:
   - Tạo mẫu buffer mô phỏng: `[0x01][id: 2B][len: 2B][PNG bytes: 100B][lenTitle: 2B][""][lenContent: 2B]["Nhiệm vụ hiện tại của bạn là nhiệm vụ:Nhiệm Vụ Thợ Câu - 1:..."]`.
   - Xác nhận parser bóc đúng ảnh, không làm rách text và trích xuất đúng `questState`.
3. **Kiểm tra log sạch sẽ**:
   - Không xuất hiện chuỗi ký tự nhị phân `| PNG IHDR...` trong log.
