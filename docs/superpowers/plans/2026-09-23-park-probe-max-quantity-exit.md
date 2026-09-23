# AvatarHD Park Probe Max Quantity Auto-Exit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nâng cấp công cụ `park-probe.ts` tự động phát hiện thông báo từ server game dạng `Số lượng max/max` (ví dụ `Số lượng 50/50`), lập tức ngắt trạng thái chờ NPC, dừng quét qua các phòng, dọn dẹp kết nối và kết thúc probe.

**Architecture:** Bổ sung helper `parseMaxQuantityDialog` dùng regex nhận diện mẫu `Số lượng current/max` với điều kiện `current >= max`. Sử dụng đối tượng ngữ cảnh `ProbeContext` chứa cờ `quotaReached` được cập nhật từ listener sự kiện `'dialog'` của `GameClient`. Tích hợp kiểm tra cờ này vào `waitForNpcDeparture` để ngắt sớm trạng thái chờ, và vào `runParkSweep` để ngắt toàn bộ vòng lặp quét phòng.

**Tech Stack:** TypeScript, Node.js (tsx), EventEmitter (`GameClient`), Regex.

**Spec:** `docs/superpowers/specs/2026-09-23-park-probe-max-quantity-exit-design.md`

## Global Constraints

- Tuân thủ nghiêm ngặt quy định **KHÔNG TDD** trong `CLAUDE.md` (không tạo test files, đi thẳng vào production code).
- Tuân thủ GitNexus (`gitnexus_impact` trước khi sửa symbol, `gitnexus_detect_changes` trước khi commit).
- Đảm bảo cơ chế dọn dẹp sạch sẽ các event listeners và timer khi ngắt sớm do đạt quota.

---

### Task 1: Cài đặt hàm helper `parseMaxQuantityDialog` và type `MaxQuantityCheck`

**Files:**
- Modify: `avatar-web/server/src/tools/park-probe.ts:50-100`

**Interfaces:**
- Consumes: `text: string`
- Produces: `parseMaxQuantityDialog(text: string): MaxQuantityCheck | null`

- [ ] **Step 1: Chạy GitNexus impact analysis trước khi sửa**
Run: `node .gitnexus/run.cjs impact "parseArgs" --direction upstream --repo .`
Expected: Xác định các caller liên quan trong `park-probe.ts`.

- [ ] **Step 2: Thêm `MaxQuantityCheck` và `parseMaxQuantityDialog` vào `park-probe.ts`**
Thêm interface và hàm vào `avatar-web/server/src/tools/park-probe.ts`:

```typescript
export interface MaxQuantityCheck {
  current: number;
  max: number;
  isMax: boolean;
}

export function parseMaxQuantityDialog(text: string): MaxQuantityCheck | null {
  const match = text.match(/số lượng\s*[:]?\s*(\d+)\s*\/\s*(\d+)/i);
  if (!match) return null;
  const current = Number(match[1]);
  const max = Number(match[2]);
  if (!Number.isFinite(current) || !Number.isFinite(max) || max <= 0) {
    return null;
  }
  return {
    current,
    max,
    isMax: current >= max,
  };
}
```

- [ ] **Step 3: Kiểm tra biên dịch**
Run: `npm --prefix avatar-web/server run typecheck`
Expected: TypeScript compile thành công, không có lỗi.

- [ ] **Step 4: Kiểm tra nhanh bằng node CLI**
Run:
```bash
node -e '
const { parseMaxQuantityDialog } = await import("./avatar-web/server/dist/tools/park-probe.js").catch(async () => import("./avatar-web/server/src/tools/park-probe.ts"));
' || node --env-file=avatar-web/server/.env --import tsx -e '
import { parseMaxQuantityDialog } from "./avatar-web/server/src/tools/park-probe.ts";
console.log("Test 1/50:", parseMaxQuantityDialog("Chúc mừng bạn nhận được 1 Hộp bánh. Số lượng 1/50"));
console.log("Test 50/50:", parseMaxQuantityDialog("Chúc mừng bạn nhận được 1 Hộp bánh. Số lượng 50/50"));
console.log("Test 51/50:", parseMaxQuantityDialog("Số lượng: 51/50"));
'
```
Expected:
`Test 1/50: { current: 1, max: 50, isMax: false }`
`Test 50/50: { current: 50, max: 50, isMax: true }`
`Test 51/50: { current: 51, max: 50, isMax: true }`

- [ ] **Step 5: Kiểm tra thay đổi GitNexus và commit**
Run: `node .gitnexus/run.cjs detect-changes --scope unstaged --repo .`
Run:
```bash
git add avatar-web/server/src/tools/park-probe.ts
git commit -m "feat(probe): add parseMaxQuantityDialog helper

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: Tích hợp cơ chế ngắt auto-exit vào `waitForNpcDeparture`, `runParkSweep`, và `runParkProbe`

**Files:**
- Modify: `avatar-web/server/src/tools/park-probe.ts:655-750`
- Modify: `avatar-web/server/src/tools/park-probe.ts:775-915`
- Modify: `avatar-web/server/src/tools/park-probe.ts:916-1070`

**Interfaces:**
- Consumes: `parseMaxQuantityDialog`, `GameClient` `'dialog'` event
- Produces: `ProbeContext`, auto-exit behavior khi `isMax === true`

- [ ] **Step 1: Chạy GitNexus impact analysis trước khi sửa**
Run: `node .gitnexus/run.cjs impact "waitForNpcDeparture" --direction upstream --repo .`
Expected: Kiểm tra caller của `waitForNpcDeparture` (`runParkSweep`, `runParkProbe`).

- [ ] **Step 2: Cập nhật `waitForNpcDeparture` nhận `ProbeContext` và ngắt khi đạt quota**
Định nghĩa interface:
```typescript
export interface ProbeContext {
  quotaReached: boolean;
  quotaMessage?: string;
}
```

Cập nhật chữ ký hàm `waitForNpcDeparture`:
```typescript
async function waitForNpcDeparture(
  client: GameClient,
  _roomId: number,
  _boardId: number,
  targetNpc: ParkNpc,
  _pos: NativeParkJoinPosition,
  ctx?: ProbeContext,
  maxWaitSeconds = 300,
): Promise<number>
```
Bên trong `waitForNpcDeparture`:
1. Bổ sung listener sự kiện `'dialog'`:
```typescript
const onDialog = (text: string): void => {
  if (settled) return;
  const check = parseMaxQuantityDialog(text);
  if (check?.isMax) {
    if (ctx) {
      ctx.quotaReached = true;
      ctx.quotaMessage = text;
    }
    finish(`Đạt giới hạn số lượng tối đa (${check.current}/${check.max})`);
  }
};
client.on('dialog', onDialog);
```
2. Trong hàm `cleanup()`:
```typescript
client.removeListener('dialog', onDialog);
```

- [ ] **Step 3: Cập nhật `runParkSweep` kiểm tra cờ `quotaReached` và ngắt vòng lặp**
Trong `runParkSweep`:
1. Khởi tạo `const ctx: ProbeContext = { quotaReached: false };` ở đầu hàm.
2. Lắng nghe `'dialog'` ở cấp sweep để bắt cả các dialog nhận được ngoài lúc đứng chờ NPC:
```typescript
const onSweepDialog = (text: string): void => {
  const check = parseMaxQuantityDialog(text);
  if (check?.isMax) {
    ctx.quotaReached = true;
    ctx.quotaMessage = text;
  }
};
client.on('dialog', onSweepDialog);
```
3. Truyền `ctx` vào lệnh gọi `waitForNpcDeparture(client, m, b, match, pos, ctx);`.
4. Trong vòng lặp board và map:
```typescript
if (ctx.quotaReached) {
  console.log(
    `\n🛑 [ĐẠT GIỚI HẠN SỰ KIỆN] Nhận thông báo "${ctx.quotaMessage}". Tự động kết thúc quét!\n`,
  );
  break;
}
```
5. Đảm bảo nếu `ctx.quotaReached` thì vòng lặp map ngoài cùng cũng `break`.
6. Dọn dẹp listener trong khối `finally`: `client.removeListener('dialog', onSweepDialog);`.

- [ ] **Step 4: Cập nhật `runParkProbe` cho chế độ probe đơn lẻ**
Trong `runParkProbe`:
1. Tạo `ctx: ProbeContext = { quotaReached: false };`.
2. Truyền `ctx` vào `waitForNpcDeparture`.
3. Nếu `ctx.quotaReached` thì in thông báo và hoàn thành sớm.

- [ ] **Step 5: Kiểm tra biên dịch**
Run: `npm --prefix avatar-web/server run typecheck`
Expected: Compile thành công không có lỗi type.

- [ ] **Step 6: Kiểm tra thay đổi GitNexus và commit**
Run: `node .gitnexus/run.cjs detect-changes --scope unstaged --repo .`
Run:
```bash
git add avatar-web/server/src/tools/park-probe.ts
git commit -m "feat(probe): auto exit probe when max quantity dialog is received

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: Chạy thực tế và kiểm chứng chức năng

**Files:**
- Execute: `avatar-web/server/src/tools/park-probe.ts`

- [ ] **Step 1: Test cờ `--help`**
Run:
```bash
(cd avatar-web/server && node --env-file=.env --import tsx src/tools/park-probe.ts --help)
```
Expected: Hiển thị help bình thường.

- [ ] **Step 2: Test với tài khoản đã đạt 50/50 bánh**
Run:
```bash
(cd avatar-web/server && node --env-file=.env --import tsx src/tools/park-probe.ts --account-id 3 --sweep --from-map 1 --to-map 3 --from-board 0 --to-board 5 --target-npc "Chú cuội")
```
Expected:
1. Kết nối game thành công.
2. Quét map 1 board 1 (hoặc các board có Chú Cuội).
3. Khi nhận được dialog báo số lượng 50/50 (hoặc nếu server gửi dialog đạt giới hạn):
   - In: `🛑 [ĐẠT GIỚI HẠN SỰ KIỆN]...`
   - Ngắt ngay trạng thái chờ, dừng quét các board tiếp theo.
   - In bảng tổng kết sweep và thoát tiến trình sạch sẽ (exit code 0).
