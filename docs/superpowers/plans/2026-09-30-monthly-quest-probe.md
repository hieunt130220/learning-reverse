# Monthly Quest Probe Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng công cụ probe CLI `monthly-quest-probe.ts` kết nối live server Avatar, tương tác NPC Lái buôn tại Nông trại để thu thập và giải mã toàn bộ danh sách nhiệm vụ tháng (`cmd -81`) cùng tiến trình nhiệm vụ tháng hiện tại (`cmd -62`).

**Architecture:** Tạo script CLI TypeScript `avatar-web/server/src/tools/monthly-quest-probe.ts` sử dụng `GameClient` và `FarmService`. Gửi luồng tương tác chuẩn `communicate(90)` $\to$ `doMenuOption(uid, 0, 1/0)`. Tích hợp bộ giải mã linh hoạt cho `cmd -81` (kết hợp `parseQuestListPacket` và fallback quét chuỗi UTF-8 big-endian) cùng `decodeQuestDialogStrings` cho `cmd -62` để trích xuất đầy đủ tên nhiệm vụ, tiến trình và phần thưởng.

**Tech Stack:** TypeScript, Node.js v25, `GameClient`, `Message`, `MyReader`, `better-sqlite3`, SQLite (`avatar-web.db`).

**Spec:** `docs/superpowers/specs/2026-09-30-monthly-quest-probe-design.md`

## Global Constraints
- **KHÔNG THỰC HIỆN TDD:** Không viết test trước khi viết code, không tạo test files, không dùng workflow Red-Green-Refactor.
- Wire format `doMenuOption(idUser, idMenu, i)` = `writeInt(idUser).writeByte(idMenu).writeByte(i)` (opcode `TX -61`).
- Mọi tương tác `doMenuOption` trong farm handler đều bắt buộc phải đi kèm một lượt `communicate(90)` trước đó.
- Tuân thủ quy tắc GitNexus (`gitnexus_impact` trước khi sửa symbol nếu có, `gitnexus_detect_changes` trước khi commit).

---

### Task 1: Bộ Khung CLI, Kết Nối Live Server & Gia Nhập Nông Trại

**Files:**
- Create: `avatar-web/server/src/tools/monthly-quest-probe.ts`

**Interfaces:**
- Consumes: `openDb`, `loadConfig`, `getAccountById`, `readGamePass`, `GameClient`.
- Produces: CLI script nhận đối số `--account-id`, `--uid`, `--sweep`, `--min`, `--max`, `--delay`, thực hiện đăng nhập và gia nhập Nông trại thành công.

- [ ] **Step 1: Viết khung CLI, xử lý tham số và kết nối vào Nông trại**

Tạo `avatar-web/server/src/tools/monthly-quest-probe.ts`:
```typescript
import { openDb } from '../db/index.js';
import { getAccountById, readGamePass } from '../accounts/repo.js';
import { GameClient } from '../game/client.js';
import { loadConfig } from '../config.js';
import { Message } from '../proto/message.js';
import {
  parseQuestListPacket,
  decodeQuestDialogStrings,
  parseQuestDialogText,
  type QuestCatalogEntry,
  type ProgressQuestChain,
} from '../game/progressQuests.js';

interface CliArgs {
  accountId: number;
  uid: number;
  sweep: boolean;
  minUid: number;
  maxUid: number;
  delayMs: number;
}

function parseArgs(args: string[]): CliArgs {
  const result: CliArgs = {
    accountId: 1,
    uid: 20,
    sweep: false,
    minUid: 15,
    maxUid: 50,
    delayMs: 400,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--account-id' && args[i + 1]) {
      result.accountId = Number(args[++i]);
    } else if (arg === '--uid' && args[i + 1]) {
      result.uid = Number(args[++i]);
    } else if (arg === '--sweep') {
      result.sweep = true;
    } else if (arg === '--min' && args[i + 1]) {
      result.minUid = Number(args[++i]);
    } else if (arg === '--max' && args[i + 1]) {
      result.maxUid = Number(args[++i]);
    } else if (arg === '--delay' && args[i + 1]) {
      result.delayMs = Number(args[++i]);
    }
  }

  return result;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
```

- [ ] **Step 2: Kiểm tra biên dịch TypeScript**

Run: `npx tsc --noEmit` từ `avatar-web/server`
Expected: Không có lỗi TypeScript syntax.

- [ ] **Step 3: Commit**

```bash
git add avatar-web/server/src/tools/monthly-quest-probe.ts
git commit -m "feat(probe): scaffold monthly quest probe CLI structure

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: Bộ Giải Mã Gói Tin Nhiệm Vụ (Cmd -81 Danh Sách & Cmd -62 Tiến Trình)

**Files:**
- Modify: `avatar-web/server/src/tools/monthly-quest-probe.ts`

**Interfaces:**
- Consumes: Buffer từ `Message` (cmd -81, -62, -40, -88, -101).
- Produces: `scanRawQuestStrings(buf: Buffer): QuestCatalogEntry[]`, hàm giải mã hộp thoại tiến trình và in thông tin rõ ràng.

- [ ] **Step 1: Viết hàm giải mã linh hoạt cho `cmd -81` và `cmd -62`**

Bổ sung vào `avatar-web/server/src/tools/monthly-quest-probe.ts`:
```typescript
/**
 * Giải mã danh sách nhiệm vụ cmd -81 với cơ chế fallback:
 * 1. Thử giải mã chuẩn bằng parseQuestListPacket (header lsnhiemvu).
 * 2. Nếu không ra kết quả (ví dụ cấu trúc header khác), quét toàn bộ chuỗi [i16 len][utf8]
 *    trong payload để ghép các cặp (tiêu đề, phần thưởng).
 */
export function extractQuestCatalog(buf: Buffer): { source: 'standard' | 'fallback'; entries: QuestCatalogEntry[] } {
  try {
    const std = parseQuestListPacket(buf);
    if (std.length > 0) {
      return { source: 'standard', entries: std };
    }
  } catch {
    // tiếp tục fallback
  }

  // Fallback quét chuỗi UTF-8
  const strings: string[] = [];
  let o = 0;
  while (o + 2 <= buf.length) {
    const len = buf.readUInt16BE(o);
    if (len > 0 && o + 2 + len <= buf.length) {
      const slice = buf.subarray(o + 2, o + 2 + len);
      // Kiểm tra có phải chuỗi in được UTF-8 không
      try {
        const text = new TextDecoder('utf-8', { fatal: true }).decode(slice);
        if (text.length > 0 && !/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(text)) {
          strings.push(text);
          o += 2 + len;
          // bỏ qua delimiter ff ff nếu có
          if (o + 1 < buf.length && buf[o] === 0xff && buf[o + 1] === 0xff) {
            o += 2;
          }
          continue;
        }
      } catch {
        // không phải utf-8 hợp lệ
      }
    }
    o++;
  }

  const entries: QuestCatalogEntry[] = [];
  // Bỏ qua các chuỗi header như "lsnhiemvu", "Danh Sách Nhiệm Vụ"
  const questStrings = strings.filter(
    (s) => s !== 'lsnhiemvu' && !s.toLowerCase().includes('danh sách nhiệm vụ')
  );

  for (let i = 0; i < questStrings.length; i += 2) {
    const title = questStrings[i];
    const reward = questStrings[i + 1] ?? '—';
    if (title) {
      entries.push({ title, reward });
    }
  }

  return { source: 'fallback', entries };
}
```

- [ ] **Step 2: Kiểm tra biên dịch TypeScript**

Run: `npx tsc --noEmit` từ `avatar-web/server`
Expected: Không có lỗi TypeScript syntax.

- [ ] **Step 3: Commit**

```bash
git add avatar-web/server/src/tools/monthly-quest-probe.ts
git commit -m "feat(probe): implement flexible quest packet decoders for monthly quests

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: Thực Thi Luồng Tương Tác NPC Lái Buôn, Báo Cáo Kết Quả & Live Verification

**Files:**
- Modify: `avatar-web/server/src/tools/monthly-quest-probe.ts`

**Interfaces:**
- Consumes: `GameClient`, `c.farm.communicate(90)`, `c.farm.doMenuOption(uid, 0, 1/0)`.
- Produces: Toàn bộ quá trình probe live, in bảng danh sách nhiệm vụ tháng (tên, yêu cầu, phần thưởng) và trạng thái nhiệm vụ hiện tại.

- [ ] **Step 1: Hoàn thiện hàm `main()` thực hiện probe và in bảng kết quả**

Thực hiện:
1. Đăng nhập tài khoản, `c.enterFarm()`.
2. Định nghĩa hàm `queryQuestUid(uid: number)`:
   - Gửi `communicate(90)` $\to$ `doMenuOption(uid, 0, 1)` $\to$ đợi `cmd -81`.
   - Gửi `communicate(90)` $\to$ `doMenuOption(uid, 0, 0)` $\to$ đợi `cmd -62`.
   - Thu thập mọi dialog `-40`, `-88`, `-70` đi kèm.
3. Nếu `--sweep` được bật: lặp qua các `uid` từ `minUid` đến `maxUid` và báo cáo mọi `uid` trả về dữ liệu nhiệm vụ.
4. In bảng danh sách nhiệm vụ tháng chi tiết:
   ```
   ================================================================================
   DANH SÁCH NHIỆM VỤ THÁNG (userID: <uid>)
   Tổng số nhiệm vụ: <N>
   ================================================================================
   #1  Nhiệm vụ: <Tên>
       Phần thưởng: <Phần thưởng>
   ...
   ================================================================================
   TIẾN TRÌNH NHIỆM VỤ THÁNG HIỆN TẠI
   Tiêu đề: <Tên>
   Điều kiện:
     - <Mục tiêu 1> (<current>/<total>) [<Trạng thái>]
   Phần thưởng: <Phần thưởng>
   ================================================================================
   ```
5. Đăng xuất `c.logout()` an toàn.

- [ ] **Step 2: Chạy kiểm tra thực tế (Live Verification)**

Run: `cd avatar-web/server && npx tsx --env-file=.env src/tools/monthly-quest-probe.ts --account-id 1`
Expected: Kết nối live server, gửi lệnh tới NPC Lái buôn, nhận phản hồi packet và in danh sách nhiệm vụ tháng.

- [ ] **Step 3: Commit**

```bash
git add avatar-web/server/src/tools/monthly-quest-probe.ts
git commit -m "feat(probe): finalize monthly quest probe execution and reporting

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```
