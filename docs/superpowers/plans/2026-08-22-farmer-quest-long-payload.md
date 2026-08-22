# Farmer Quest Long Payload Decode Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Sửa cmd -62 decoder để web nhận đúng Nhiệm Vụ Nhà Nông 2 và các quest có nội dung dài hơn 255 byte.

**Architecture:** Thay decoder i8-length đang sai bằng decoder i16 big-endian đúng với raw protocol `[header][i16 len][utf8]...`. Handler cmd -62 tiếp tục tìm field chứa `"nhiệm vụ hiện tại"` và dùng `parseQuestDialogText`, nên toàn bộ state/API/UI flow hiện tại được giữ nguyên.

**Tech Stack:** TypeScript, Node.js Buffer, Avatar private-server protocol, GitNexus.

**Spec:** `docs/superpowers/specs/2026-08-22-farmer-quest-long-payload-design.md`

## Global Constraints

- Tuân thủ Spec → Plan → Production Code và review gates trong CLAUDE.md.
- Không TDD, không tạo test file mới vì user không yêu cầu test.
- Chỉ sửa decoder cmd -62, import/call-site tương ứng và tài liệu protocol; không thay đổi `parseQuestDialogText`, API hoặc UI.
- Không thay đổi cmd -81 parser.
- Không suy diễn quest từ farm level hoặc FarmData.
- Impact đã kiểm tra: `GameClient.onMessage` và `parseQuestDialogText` đều LOW.
- Không tuyên bố live verification pass khi account vẫn đăng nhập trong game thật và bot không thể kết nối.

## Tasks

### Task 1: Thay decoder cmd -62 từ i8 sang i16

**Files:**
- Modify: `avatar-web/server/src/game/progressQuests.ts:544-570`
- Modify: `avatar-web/server/src/game/client.ts:32-45,710-728`

**Interfaces:**
- Consumes: cmd -62 payload `[byte header][i16 len][utf8]...`.
- Produces: `string[]` gồm các field hoàn chỉnh; quest text không bị chia khi dài >255 byte.

- [x] **Step 1: Đổi tên và implement decoder đúng**

  Trong `progressQuests.ts`, thay:

  ```ts
  export function decodeLenPrefixedStrings(buf: Buffer, start = 1): string[]
  ```

  bằng:

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

  Cập nhật JSDoc: cmd -62 dùng i16 big-endian; byte 0 là header/subtype. Cập nhật comment cmd -81 để không còn nói cmd -62 dùng i8.

- [x] **Step 2: Đổi import và call-site handler cmd -62**

  Trong `client.ts`:

  ```ts
  import { decodeQuestDialogStrings } from './progressQuests.js';
  // ...
  const parts = decodeQuestDialogStrings(msg.getData());
  ```

  Giữ nguyên logic `parts.find(...)`, `parseQuestDialogText`, routing beginner/farmer và emit events.

- [x] **Step 3: Type-check**

  Run từ `avatar-web/server/`:

  ```bash
  npm run typecheck
  ```

  Expected: exit code 0.

### Task 2: Verify decoder bằng fixture sau production code

**Files:**
- Temporary only: `/tmp/verify-quest-dialog-i16.ts` (không commit)

**Interfaces:**
- Consumes: fixture cmd -62 ngắn và dài.
- Produces: bằng chứng decoder giữ nguyên field text và parser lấy đúng title/conditions.

- [x] **Step 1: Tạo script fixture**

  Script tự build packet:

  ```ts
  function field(text: string): Buffer {
    const body = Buffer.from(text, 'utf8');
    const length = Buffer.alloc(2);
    length.writeUInt16BE(body.length);
    return Buffer.concat([length, body]);
  }
  const packet = Buffer.concat([
    Buffer.from([0]),
    field('Nhiệm Vụ'),
    field(longQuestText),
  ]);
  ```

  `longQuestText` phải dài >255 byte và chứa title `Nhiệm Vụ Nhà Nông 2`, conditions/rewards hợp lệ.

- [x] **Step 2: Chạy fixture**

  Run:

  ```bash
  npx tsx --env-file=.env /tmp/verify-quest-dialog-i16.ts
  ```

  Expected:
  - packet text field >255 byte.
  - `decodeQuestDialogStrings` trả đúng 2 strings.
  - string thứ 2 bắt đầu `Nhiệm vụ hiện tại`.
  - `parseQuestDialogText` trả title `Nhiệm Vụ Nhà Nông 2`, step 2 và conditions đúng.

### Task 3: Cập nhật tài liệu discovery

**Files:**
- Modify: `avatar-re/notes/quest-discovery.md`

**Interfaces:**
- Consumes: root cause đã xác minh từ raw cmd -62.
- Produces: hướng dẫn protocol đúng cho các phiên điều tra sau.

- [x] **Step 1: Sửa format cmd -62**

  Thay mô tả i8 bằng:

  ```text
  byte0 = 0x00 (header), rồi lặp [i16 len][utf8]
  ```

  Ghi rõ Quest 1 dưới 256 byte từng làm parser i8 chạy tình cờ; quest dài >255 byte sẽ vỡ.

- [x] **Step 2: Sửa bảng lỗi lịch sử**

  Thêm/sửa lỗi: đọc cmd -62 bằng i8 và join field — cách đúng là i16 + lấy field chứa `nhiệm vụ hiện tại`.

### Task 4: Verify live, detect changes và commit

**Files:**
- Verify only; không thêm production files ngoài Task 1/3.

**Interfaces:**
- Consumes: account phu khi không còn đăng nhập trong game thật.
- Produces: API state với farmer Quest 2.

- [x] **Step 1: Verify live nếu account login được**

  - Connect account 2 qua web API.
  - Trigger `POST /api/accounts/2/quests/progress/refresh`.
  - Read `GET /api/accounts/2/state`.
  - Expected: `quests.farmer.title` chứa `Nhiệm Vụ Nhà Nông 2`, source `game-dialog`.
  - Check Tân Thủ và upgrade không regression.

  Nếu server trả "Tài khoản này đang đăng nhập", ghi rõ live verification bị chặn; không giả vờ pass. Fixture + type-check vẫn phải pass.

- [x] **Step 2: Run GitNexus detect_changes**

  ```text
  detect_changes(scope="unstaged", repo="learning-reverse")
  ```

  Expected scope: decoder quest dialog + `GameClient.onMessage`; review mọi HIGH warning trước commit.

- [x] **Step 3: Commit**

  ```bash
  git add \
    avatar-web/server/src/game/progressQuests.ts \
    avatar-web/server/src/game/client.ts \
    avatar-re/notes/quest-discovery.md \
    docs/superpowers/specs/2026-08-22-farmer-quest-long-payload-design.md \
    docs/superpowers/plans/2026-08-22-farmer-quest-long-payload.md

  git commit -m "fix(quest): decode cmd -62 bằng length i16"
  ```

  Commit message body phải kết thúc:

  ```text
  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
  ```
