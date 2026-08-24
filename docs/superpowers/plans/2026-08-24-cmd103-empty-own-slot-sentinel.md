# Cmd 103 Empty Own-Slot Sentinel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Giải mã đúng slot sạp trống được server mã hóa bằng `itemId=-1`, giữ nguyên fail-closed cho packet hỏng và reconcile giao dịch thu sạp hiện tại mà không gửi lại lệnh.

**Architecture:** Chỉ sửa biên decoder RX cmd 103 sub-type 0: mỗi slot đọc `itemId` trước, sentinel `-1` được normalize thành `OwnShopSlot` trống, còn slot có hàng tiếp tục dùng schema hiện tại. `GameClient`, `ShopCoordinator`, API, DB và UI giữ nguyên; live acceptance dựa trên fresh snapshot/reconciliation ở epoch mới.

**Tech Stack:** TypeScript, Node.js, `tsx`, Node `assert/strict`, SQLite, GitNexus MCP, React/Vite verification hiện có.

**Spec:** `docs/superpowers/specs/2026-08-24-cmd103-empty-own-slot-sentinel-design.md`

## Global Constraints

- Thực thi production code trong worktree cô lập tạo bằng `superpowers:using-git-worktrees`; không sửa trực tiếp source trong checkout `main` đang được backend watch.
- Repo cấm TDD: viết production code trước, không tạo hoặc sửa test file; chỉ dùng one-off decoder harness sau khi code hoàn tất.
- Chỉ sửa `avatar-web/server/src/game/shopProtocol.ts` và tài liệu protocol cmd 103 đã nêu; không sửa `ShopCoordinator`, `GameClient`, API, DB schema hoặc UI.
- Sentinel hợp lệ duy nhất trong scope là `itemId === -1`; các item ID khác giữ hành vi hiện tại.
- Giao dịch `359ac82a-93af-4c91-be2d-1315395a382e` đã được gửi và có ACK; tuyệt đối không retry, không gọi lại `takeItemBack(0)`, không sửa SQLite trực tiếp.
- Packet malformed vẫn phải ném `ShopProtocolDecodeError` và giữ cơ chế khóa channel hiện tại.
- Giữ mọi thay đổi không liên quan trong `AGENTS.md`, `CLAUDE.md`, `.superpowers/brainstorm/` và các spec/plan khác.
- Trước khi sửa symbol phải chạy `gitnexus_impact`; nếu kết quả HIGH/CRITICAL, dừng và cảnh báo người dùng.
- Trước commit phải chạy `gitnexus_detect_changes(scope: "staged")`.
- Checkout `main` đang được watch và tài khoản 2 đang bật AutoFarm; phải xin xác nhận riêng ngay trước merge/integration live.

---

### Task 1: Sửa decoder sentinel và cập nhật tài liệu protocol

**Files:**
- Modify: `avatar-web/server/src/game/shopProtocol.ts:142-155`
- Modify: `docs/Phân tích kỹ thuật giao thức  — cmd 103 trong AvatarHD.md:142-172`
- Test: Không tạo/sửa test file; dùng one-off harness ở Step 5.

**Interfaces:**
- Consumes: `decodeEvent(reader: MyReader, body: Buffer): ShopProtocolEvent`, `readShort`, `readInt`, `readBoolean`, `validateCount`, `OwnShopSlot`.
- Produces: public contract `decodeShopPacket(body: Buffer): DecodedShopPacket` không đổi; sub-type 0 trả đủ một `OwnShopSlot` cho mỗi index trong `0..count-1`, gồm normalized empty slot khi `itemId === -1`.

- [x] **Step 1: Tạo worktree cô lập và chụp baseline**

Invoke `superpowers:using-git-worktrees` tại thời điểm execution. Tạo branch:

```text
codex/cmd103-empty-own-slot-sentinel
```

Trong worktree mới, chạy:

```bash
git status --short
git rev-parse --short HEAD
```

Expected:

- HEAD bắt đầu từ commit `5ca5f01` hoặc commit `main` mới hơn nếu người dùng đã thay đổi repo;
- worktree feature sạch;
- checkout `main` và các dirty file hiện có không bị thay đổi.

- [x] **Step 2: Chạy impact analysis trước khi sửa decoder**

Gọi GitNexus:

```json
{
    "tool": "mcp__gitnexus__impact",
  "arguments": {
    "repo": "learning-reverse",
    "target": "decodeEvent",
    "direction": "upstream",
    "includeTests": true,
    "maxDepth": 3
  }
}
```

Sau đó gọi cùng payload với `target: "decodeShopPacket"`.

Expected:

- `decodeEvent` có direct dependent `decodeShopPacket`;
- `decodeShopPacket` có direct dependent `GameClient.onMessage`;
- risk LOW/MEDIUM. Nếu HIGH/CRITICAL, không sửa code và báo blast radius cho người dùng.

- [x] **Step 3: Sửa production decoder sub-type 0**

Trong `avatar-web/server/src/game/shopProtocol.ts`, thay toàn bộ body của
`case 0` bằng:

```ts
case 0: {
  const count = readByte(reader, 'own.count', body);
  validateCount(count, MAX_OWN_SLOTS, 'own.count', reader, body, 2, 1);
  const slots: OwnShopSlot[] = [];
  for (let slot = 0; slot < count; slot += 1) {
    const itemId = readShort(reader, `own[${slot}].itemId`, body);
    if (itemId === -1) {
      slots.push({
        slot,
        itemId,
        quantity: 0,
        price: 0,
        isSale: false,
        isTimeOut: false,
      });
      continue;
    }
    const quantity = readInt(reader, `own[${slot}].quantity`, body);
    const price = readInt(reader, `own[${slot}].price`, body);
    const isSale = readBoolean(reader, `own[${slot}].isSale`, body);
    const isTimeOut = isSale
      ? false
      : readBoolean(reader, `own[${slot}].isTimeOut`, body);
    slots.push({ slot, itemId, quantity, price, isSale, isTimeOut });
  }
  const canOpenSlot = readBoolean(reader, 'own.canOpenSlot', body);
  return { subType: 0, kind: 'own-snapshot', slots, numSlot: count, canOpenSlot };
}
```

Không sửa helper dùng chung, các sub-type 1–8 hoặc public union
`ShopProtocolEvent`.

- [x] **Step 4: Cập nhật tài liệu reverse-engineering**

Trong file tài liệu Unicode đã liệt kê, đổi schema sub-type 0 thành:

```text
i8  count
repeat count:
  i16 idItem
  if idItem == -1:
    slot trống; record kết thúc tại đây
  else:
    i32 num
    i32 price
    bool isSale
    if isSale == false:
      bool isTimeOut
bool canOpenSlot
```

Bổ sung ngay sau schema:

```markdown
Packet live `0001ffff01` xác nhận `count=1` có thể chứa một slot trống chỉ
gồm sentinel `idItem=-1`, sau đó là `canOpenSlot=true`. Vì vậy `count` là
số slot đã mở; không được pre-validate mọi slot như một record đầy đủ.
```

Giữ nguyên giải thích conditional `isTimeOut`, nhưng sửa câu “với mỗi record”
thành “với mỗi slot có item” để không mâu thuẫn với sentinel.

- [x] **Step 5: Chạy one-off decoder harness sau production code**

Run trong `avatar-web/server`:

```bash
node --import tsx --input-type=module <<'NODE'
import assert from 'node:assert/strict';
import {
  decodeShopPacket,
  ShopProtocolDecodeError,
} from './src/game/shopProtocol.ts';

const empty = decodeShopPacket(Buffer.from('0001ffff01', 'hex'));
assert.deepEqual(empty, {
  event: {
    subType: 0,
    kind: 'own-snapshot',
    slots: [{
      slot: 0,
      itemId: -1,
      quantity: 0,
      price: 0,
      isSale: false,
      isTimeOut: false,
    }],
    numSlot: 1,
    canOpenSlot: true,
  },
});

const zero = decodeShopPacket(Buffer.from('000001', 'hex'));
assert.deepEqual(zero, {
  event: {
    subType: 0,
    kind: 'own-snapshot',
    slots: [],
    numSlot: 0,
    canOpenSlot: true,
  },
});

const mixed = decodeShopPacket(
  Buffer.from('0002ffff000300000384000000090101', 'hex'),
);
assert.deepEqual(mixed, {
  event: {
    subType: 0,
    kind: 'own-snapshot',
    slots: [
      {
        slot: 0,
        itemId: -1,
        quantity: 0,
        price: 0,
        isSale: false,
        isTimeOut: false,
      },
      {
        slot: 1,
        itemId: 3,
        quantity: 900,
        price: 9,
        isSale: true,
        isTimeOut: false,
      },
    ],
    numSlot: 2,
    canOpenSlot: true,
  },
});

const expired = decodeShopPacket(
  Buffer.from('000100030000038400000009000101', 'hex'),
);
assert.equal(expired.event.kind, 'own-snapshot');
assert.deepEqual(expired.event.slots[0], {
  slot: 0,
  itemId: 3,
  quantity: 900,
  price: 9,
  isSale: false,
  isTimeOut: true,
});

assert.throws(
  () => decodeShopPacket(Buffer.from('0001ffff', 'hex')),
  (error) => error instanceof ShopProtocolDecodeError
    && error.offset === 2
    && /own\.count=1 cần tối thiểu 3 byte, còn 2/.test(error.message),
);

console.log('cmd103 empty-slot sentinel harness: ok');
NODE
```

Expected:

```text
cmd103 empty-slot sentinel harness: ok
```

Lệnh không kết nối game, không gửi packet và không sửa DB.

- [x] **Step 6: Chạy source contract và regression verification**

Run tại root worktree:

```bash
rg -n "validateCount\(count, MAX_OWN_SLOTS.*2, 1|itemId === -1|quantity: 0|own\.canOpenSlot" avatar-web/server/src/game/shopProtocol.ts
git diff --check
```

Expected:

- thấy minimum bytes `2, 1`, branch sentinel và normalized fields;
- `git diff --check` không có output.

Run trong `avatar-web/server`:

```bash
npm run typecheck
npm test
npm run build
```

Expected: typecheck/build exit 0 và toàn bộ server tests hiện có pass.

Run trong `avatar-web/web`:

```bash
npm test
npm run build
```

Expected: toàn bộ web tests hiện có pass và Vite production build exit 0.

- [x] **Step 7: Kiểm tra phạm vi GitNexus trên final diff**

Vì GitNexus index gắn với checkout chính, trước tiên xác nhận hai target file
trong `main` và main index sạch. Từ feature worktree, đưa đúng diff hai file
vào **main index only**:

```bash
git diff --binary -- avatar-web/server/src/game/shopProtocol.ts 'docs/Phân tích kỹ thuật giao thức  — cmd 103 trong AvatarHD.md' | git -C /Users/devios/learning-reverse apply --cached --check -
git diff --binary -- avatar-web/server/src/game/shopProtocol.ts 'docs/Phân tích kỹ thuật giao thức  — cmd 103 trong AvatarHD.md' | git -C /Users/devios/learning-reverse apply --cached -
```

Gọi:

```json
{
  "tool": "mcp__gitnexus__detect_changes",
  "arguments": {
    "repo": "learning-reverse",
    "scope": "staged"
  }
}
```

Expected: chỉ decoder cmd 103/GameClient flow và file tài liệu bị ảnh hưởng;
không có flow AutoFarm/coordinator mới ngoài dependency hiện có của decoder.

Ngay sau tool call, khôi phục **main index only**:

```bash
git -C /Users/devios/learning-reverse restore --staged -- avatar-web/server/src/game/shopProtocol.ts 'docs/Phân tích kỹ thuật giao thức  — cmd 103 trong AvatarHD.md'
```

Xác nhận source checkout `main` chưa đổi và các dirty file cũ vẫn nguyên vẹn.

- [x] **Step 8: Commit chỉ khi người dùng yêu cầu rõ ràng**

```bash
git add avatar-web/server/src/game/shopProtocol.ts 'docs/Phân tích kỹ thuật giao thức  — cmd 103 trong AvatarHD.md'
git commit -m "fix(shop): decode empty own-shop slots"
```

Expected: commit chỉ chứa đúng hai file của Task 1. Nếu chưa có chỉ thị commit,
giữ Step 8 unchecked và báo branch/worktree cùng diff đã verify.

---

### Task 2: Tích hợp và live acceptance không retry

**Files:**
- Read-only inspect: `avatar-web/server/data/avatar-web.db`
- Read-only inspect: runtime state/traffic của tài khoản 2.
- No source modifications ngoài merge commit đã được duyệt.

**Interfaces:**
- Consumes: branch/commit Task 1, backend watcher trên `main`, transaction `359ac82a-93af-4c91-be2d-1315395a382e`.
- Produces: bằng chứng fresh own snapshot có slot 0 trống, channel cmd 103 không bị block và transaction cũ được reconcile mà không có withdraw mới.

- [x] **Step 1: Xin xác nhận integration live ngay trước merge**

Nêu rõ `main` được backend watch và tài khoản 2 đang bật AutoFarm. Merge sẽ
reload backend, tạo connection epoch mới và chạy sync hiện có. Không tiếp tục
nếu người dùng chưa xác nhận tại thời điểm này.

- [x] **Step 2: Chụp baseline read-only**

Run tại root `/Users/devios/learning-reverse`:

```bash
sqlite3 -readonly -header -column avatar-web/server/data/avatar-web.db "
SELECT id, auto_enabled,
       json_extract(auto_config_json, '$.revision') AS config_revision,
       json_extract(auto_config_json, '$.config.autoSellProduce') AS auto_sell
FROM avatar_accounts
WHERE id = 2;

SELECT id, kind, status, error_code, error_message, created_at
FROM avatar_shop_transactions
WHERE id = '359ac82a-93af-4c91-be2d-1315395a382e';

SELECT COUNT(*) AS withdraw_since_candidate
FROM avatar_shop_transactions
WHERE account_id = 2
  AND kind = 'withdraw'
  AND created_at >= 1787552300758;

SELECT own_observed_at,
       json_extract(own_snapshot_json, '$.revision') AS own_revision,
       json_extract(own_snapshot_json, '$.data.slots[0].itemId') AS slot0_item,
       json_extract(own_snapshot_json, '$.data.slots[0].isSale') AS slot0_sold
FROM avatar_shop_cache
WHERE account_id = 2;
"
```

Expected trước integration:

- transaction candidate vẫn `unknown`;
- `withdraw_since_candidate = 1`;
- cache có thể vẫn giữ slot 0 item 3 đã bán vì snapshot sentinel từng bị reject.

- [x] **Step 3: Fast-forward vào main và quan sát watcher**

Trước merge:

```bash
git -C /Users/devios/learning-reverse branch --show-current
git -C /Users/devios/learning-reverse status --short -- avatar-web/server/src/game/shopProtocol.ts 'docs/Phân tích kỹ thuật giao thức  — cmd 103 trong AvatarHD.md'
```

Expected: branch `main`, hai target file sạch.

Sau khi đã có commit được duyệt:

```bash
git -C /Users/devios/learning-reverse merge --ff-only codex/cmd103-empty-own-slot-sentinel
```

Không chạy `git pull` nếu local `main` đã bằng `origin/main`; không chạm
các dirty file không liên quan. Quan sát watcher tạo child process mới và cổng
8787 tiếp tục LISTEN. Không bấm Rút, không gửi raw cmd 103 và không toggle
AutoFarm.

- [x] **Step 4: Đối chiếu traffic/runtime read-only**

Dùng trang debug/API đã đăng nhập ở chế độ đọc-only:

- tìm RX cmd 103 body `0001ffff01`;
- xác nhận không còn log `own.count=1 cần tối thiểu 12 byte`;
- xác nhận own snapshot mới có `numSlot=1`, slot 0 `itemId=-1`,
  `quantity=0`, `isSale=false`;
- xác nhận channel cho phép các read sync tiếp theo thay vì báo
  “cần reconnect trước khi gửi lệnh mới”.

Không click bất kỳ control gửi packet nào.

- [x] **Step 5: Đối chiếu transaction và chống retry**

Chạy lại query Step 2.

Expected:

- transaction `359ac82a-93af-4c91-be2d-1315395a382e` chuyển
  `unknown -> succeeded`;
- `result_json` có `reconciledAfterReconnect=true` và own revision mới;
- `withdraw_since_candidate` vẫn bằng 1, chứng minh không có giao dịch thu
  thay thế;
- cache slot 0 là sentinel trống.

Nếu transaction vẫn `unknown`, báo đúng trạng thái và dừng; không retry,
không sửa DB, không gọi lại API withdraw.

- [x] **Step 6: Verify checkout main sau integration**

Run:

```bash
cd /Users/devios/learning-reverse/avatar-web/server
npm run typecheck
npm test
npm run build
```

Run:

```bash
cd /Users/devios/learning-reverse/avatar-web/web
npm test
npm run build
```

Run tại repo root:

```bash
git diff --check
git status --short
git log -1 --oneline
```

Expected: mọi verification pass, production target files sạch so với HEAD, và
chỉ các dirty file có trước/spec/plan chưa commit còn xuất hiện.

- [x] **Step 7: Báo cáo kết quả live trung thực**

Báo tách riêng:

- static decoder harness/tests/build;
- merge/watcher health;
- snapshot/transaction reconciliation;
- mọi acceptance chưa đạt.

Không mô tả build pass là live acceptance. Task 2 không tạo commit rỗng hoặc
thay đổi DB trực tiếp.
