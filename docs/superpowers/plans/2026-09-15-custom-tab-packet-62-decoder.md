# CustomTab Cmd -62 Decoder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sửa decoder gói tin opcode -62 (CUSTOM_TAB) để bóc tách chính xác khối ảnh PNG đính kèm, trích xuất text quest đúng và ngăn in chuỗi nhị phân ảnh ra log.

**Architecture:** Thêm cấu trúc `CustomTabImage`, `CustomTabPacket` và hàm `decodeCustomTabPacket` trong `progressQuests.ts` theo đúng layout il2cpp (`nImages` -> mảng ảnh `[id, len, data]` -> `title: utf` -> `content: utf` -> `idAction?: i8`). Cập nhật handler `case -62` trong `client.ts` để đọc text nhiệm vụ từ `tab.content` / `tab.title`, đồng thời chuẩn hoá log thông báo khi không phải dialog quest.

**Tech Stack:** TypeScript, Node.js Buffer, GitNexus Code Intelligence.

**Spec:** `docs/superpowers/specs/2026-09-15-custom-tab-packet-62-decoder-design.md`

## Global Constraints
- Không dùng TDD (không tạo test files mới trừ khi được yêu cầu).
- Chạy `gitnexus_impact` trước khi sửa code và `gitnexus_detect_changes` trước khi commit.
- Giữ tương thích ngược cho hàm `decodeQuestDialogStrings`.
- Không in dữ liệu nhị phân thô ra terminal.

---

### Task 1: Thêm `decodeCustomTabPacket` và các kiểu dữ liệu liên quan

**Files:**
- Modify: `avatar-web/server/src/game/progressQuests.ts:555-580`

**Interfaces:**
- Consumes: `Buffer` từ Node.js.
- Produces: `CustomTabImage`, `CustomTabPacket`, `decodeCustomTabPacket(buf: Buffer): CustomTabPacket`.

- [x] **Step 1: Định nghĩa types và hàm `decodeCustomTabPacket`**
Thêm interface và hàm decode vào `avatar-web/server/src/game/progressQuests.ts`:
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

/**
 * Giải mã gói tin CUSTOM_TAB (cmd -62).
 * Cấu trúc xác minh từ GlobalMessageHandler.onMessage @0x5E8ED8:
 * - byte nImages (số lượng ảnh)
 * - Nếu nImages > 0, lặp nImages lần:
 *     - i16 idImg
 *     - i16 imgLen
 *     - byte[imgLen] imgData (PNG/JPEG binary)
 * - utf title (i16 len + utf8)
 * - utf content (i16 len + utf8)
 * - i8 idAction (nếu còn byte)
 */
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

  let title = '';
  if (offset + 2 <= buf.length) {
    const titleLen = buf.readUInt16BE(offset);
    offset += 2;
    if (offset + titleLen <= buf.length) {
      title = buf.toString('utf8', offset, offset + titleLen);
      offset += titleLen;
    }
  }

  let content = '';
  if (offset + 2 <= buf.length) {
    const contentLen = buf.readUInt16BE(offset);
    offset += 2;
    if (offset + contentLen <= buf.length) {
      content = buf.toString('utf8', offset, offset + contentLen);
      offset += contentLen;
    }
  }

  let idAction: number | undefined;
  if (offset < buf.length) {
    idAction = buf.readInt8(offset);
    offset += 1;
  }

  return { nImages, images, title, content, idAction };
}
```

- [x] **Step 2: Cập nhật hàm `decodeQuestDialogStrings`**
Chuyển đổi `decodeQuestDialogStrings` dùng `decodeCustomTabPacket` hoặc fallback an toàn để tránh nuốt binary nếu caller cũ vẫn dùng.

- [x] **Step 3: Kiểm tra biên dịch**
Run: `npm run build --prefix avatar-web/server`
Expected: Biên dịch TypeScript thành công, không lỗi type.

- [x] **Step 4: Kiểm tra GitNexus và Commit**
Run: `detect_changes`
`git commit -m "feat(quest): implement decodeCustomTabPacket for cmd -62"`

---

### Task 2: Cập nhật handler `case -62` trong `GameClient`

**Files:**
- Modify: `avatar-web/server/src/game/client.ts:40-55,1307-1340`

**Interfaces:**
- Consumes: `decodeCustomTabPacket` từ `progressQuests.ts`.
- Produces: State quest (`beginnerQuestState`, `fishermanQuestState`, `farmerQuestState`) được cập nhật ngay cả khi gói -62 có đính kèm ảnh PNG.

- [x] **Step 1: Cập nhật import trong `client.ts`**
Import `decodeCustomTabPacket` từ `./progressQuests.js`.

- [x] **Step 2: Cập nhật handler `case -62:` trong `client.ts`**
Thay thế logic đọc `decodeQuestDialogStrings` cũ bằng `decodeCustomTabPacket`:
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

- [x] **Step 3: Kiểm tra biên dịch và verify**
Run: `npm run build --prefix avatar-web/server`
Expected: Build thành công không có lỗi type.

- [x] **Step 4: Kiểm tra GitNexus và Commit**
Run: `detect_changes`
`git commit -m "fix(client): handle cmd -62 custom tab with images without corrupting quest dialog"`
