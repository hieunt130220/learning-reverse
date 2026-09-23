# AvatarHD Park Probe Target NPC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nâng cấp công cụ `park-probe.ts` nhận tham số `--target-npc <tên NPC>`: khi quét phát hiện NPC trùng tên thì dừng lại tại board đó, giám sát qua các gói tin `RX 83`, `RX 48` mode 2 và polling snapshot cho đến khi NPC biến mất, sau đó tự động tiếp tục quét các board tiếp theo.

**Architecture:** Bổ sung trường `targetNpc` vào CLI args trong `park-probe.ts`. Cài đặt hàm `waitForNpcDeparture` kết hợp lắng nghe broadcast thời gian thực (`RX 83` cho Avatar NPC, `RX 48` mode 2 cho Special NPC) với cơ chế fallback polling re-query `TX 80` sau mỗi 15s để chống treo socket. Tích hợp điểm dừng này vào vòng lặp quét `runParkSweep`.

**Tech Stack:** TypeScript, Node.js (tsx), Socket binary protocol (`MyReader`, `Message`), EventEmitter.

**Spec:** `docs/superpowers/specs/2026-09-23-park-probe-target-npc-design.md`

## Global Constraints

- Tuân thủ nghiêm ngặt quy định **KHÔNG TDD** trong `CLAUDE.md` (không tạo test files, đi thẳng vào production code).
- Tuân thủ GitNexus (`gitnexus_impact` trước khi sửa symbol, `gitnexus_detect_changes` trước khi commit).
- Đảm bảo cơ chế cleanup sạch sẽ các event listeners và timer khi NPC biến mất hoặc khi gặp lỗi mạng.

---

### Task 1: Bổ sung tùy chọn CLI `--target-npc` vào `park-probe.ts`

**Files:**
- Modify: `avatar-web/server/src/tools/park-probe.ts:17-167`
- Modify: `avatar-web/server/src/tools/park-probe.ts:920-945`

**Interfaces:**
- Consumes: CLI argv
- Produces: `ProbeArgs.targetNpc?: string`

- [ ] **Step 1: Chạy GitNexus impact analysis trước khi sửa**
Run: `gitnexus_impact({target: "parseArgs", direction: "upstream"})`
Expected: Kiểm tra các caller của `parseArgs` (chủ yếu là `main()` trong `park-probe.ts`).

- [ ] **Step 2: Cập nhật `ProbeArgs` và `parseArgs`**
Mở file `avatar-web/server/src/tools/park-probe.ts`:
1. Thêm trường `targetNpc?: string;` vào interface `ProbeArgs`.
2. Thêm `'--target-npc'` vào `ALLOWED_KEYS`.
3. Trong `parseArgs`, tách riêng việc xử lý `--target-npc` để nhận giá trị chuỗi (string) thay vì ép kiểu số nguyên qua `parseInteger`.
4. Chuẩn hóa giá trị `targetNpc = raw.trim();` nếu rỗng thì báo lỗi `Tên NPC không được để trống`.
5. Cập nhật hướng dẫn trợ giúp `--help` trong `main()`.

- [ ] **Step 3: Kiểm tra biên dịch**
Run: `npm --prefix avatar-web/server run typecheck`
Expected: TypeScript compile thành công, không có lỗi.

- [ ] **Step 4: Kiểm tra thay đổi GitNexus và commit**
Run: `gitnexus_detect_changes({scope: "unstaged"})`
Run:
```bash
git add avatar-web/server/src/tools/park-probe.ts
git commit -m "feat(probe): add --target-npc CLI option to park-probe

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: Cài đặt `waitForNpcDeparture` và tích hợp vào luồng quét `runParkSweep`

**Files:**
- Modify: `avatar-web/server/src/tools/park-probe.ts`

**Interfaces:**
- Consumes: `GameClient`, `ParkNpc`, `NativeParkJoinPosition`, `Message`, `MyReader`.
- Produces: `waitForNpcDeparture(...) -> Promise<number>` trả về số giây NPC tồn tại trước khi biến mất.

- [ ] **Step 1: Chạy GitNexus impact analysis trước khi sửa**
Run: `gitnexus_impact({target: "runParkSweep", direction: "upstream"})`
Expected: Xác định ảnh hưởng của việc sửa đổi vòng lặp `runParkSweep`.

- [ ] **Step 2: Cài đặt hàm `waitForNpcDeparture`**
Hàm `waitForNpcDeparture(client, roomId, boardId, targetNpc, pos)`:
1. Ghi nhận thời điểm bắt đầu `const startTime = Date.now()`.
2. Lắng nghe `client.session.on('message', onMessage)`:
   - Gói `cmd === 83` (`PLAYER_LEAVE_PARK`):
     ```typescript
     const reader = new MyReader(msg.getData());
     const leaveId = reader.readInt();
     if (leaveId === targetNpc.id) {
       resolve();
     }
     ```
   - Gói `cmd === 48` (`ITEM_MAP_SPECIAL`):
     ```typescript
     const update = decodeMapSpecialUpdate(msg.getData());
     if (update.operation === 'remove' && update.id === targetNpc.id) {
       resolve();
     }
     ```
3. Thiết lập Heartbeat interval (5 giây):
   - In: `[WAITING] Đang chờ NPC "${targetNpc.name}" biến mất... (đã chờ ${seconds}s)`.
4. Thiết lập Fallback Polling interval (15 giây):
   - Gửi `TX 80` kiểm tra lại snapshot của phòng.
   - Nếu snapshot mới không còn `targetNpc.id` (và không có cập nhật upsert trong RX 48): coi như NPC đã biến mất và `resolve()`.
5. Trong khối dọn dẹp (`cleanup`): huỷ bỏ mọi interval, timer và remove message listener.
6. Trả về tổng thời gian đã chờ (tính theo giây).

- [ ] **Step 3: Tích hợp logic chờ vào `runParkSweep`**
Trong vòng lặp quét từng board của `runParkSweep`:
```typescript
if (args.targetNpc) {
  const match = roomNpcs.find(
    (n) => n.name.trim().toLowerCase() === args.targetNpc!.trim().toLowerCase(),
  );
  if (match) {
    console.log(
      `\n🎯 [PHÁT HIỆN TARGET NPC] Tìm thấy "${match.name}" (ID: ${match.id}) tại Map ${m} - Board ${b}!`,
    );
    console.log(`⏳ Đứng lại tại Map ${m} - Board ${b} để theo dõi cho đến khi NPC rời phòng...\n`);
    const elapsed = await waitForNpcDeparture(client, m, b, match, pos);
    console.log(
      `\n✅ [NPC BIẾN MẤT] NPC "${match.name}" đã rời khỏi Map ${m} - Board ${b} sau ${elapsed} giây.`,
    );
    console.log(`Tiếp tục quét các board tiếp theo...\n`);
    await new Promise<void>((r) => setTimeout(r, 1_200));
  }
}
```

- [ ] **Step 4: Kiểm tra biên dịch**
Run: `npm --prefix avatar-web/server run typecheck`
Expected: Compile thành công không có lỗi type.

- [ ] **Step 5: Kiểm tra thay đổi GitNexus và commit**
Run: `gitnexus_detect_changes({scope: "unstaged"})`
Run:
```bash
git add avatar-web/server/src/tools/park-probe.ts
git commit -m "feat(probe): implement target NPC departure detection and sweep pause

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: Chạy thực tế và kiểm chứng chức năng

**Files:**
- Execute: `avatar-web/server/src/tools/park-probe.ts`

- [ ] **Step 1: Test cờ `--help`**
Run:
```bash
node --env-file=avatar-web/server/.env --import tsx avatar-web/server/src/tools/park-probe.ts --help
```
Expected: Hiển thị tùy chọn `--target-npc <tên NPC>`.

- [ ] **Step 2: Test sweep với `--target-npc`**
Chạy probe quét thử với `--target-npc "Chức Nữ"` hoặc `--target-npc "Ngưu Lang"`:
```bash
node --env-file=avatar-web/server/.env --import tsx avatar-web/server/src/tools/park-probe.ts --account-id 1 --sweep --from-map 1 --to-map 3 --from-board 0 --to-board 5 --target-npc "Chức Nữ"
```
Expected:
1. Kết nối và đăng nhập thành công.
2. Quét qua các board bình thường nếu không có target NPC.
3. Nếu phát hiện target NPC: dừng quét, log thông tin phát hiện, in heartbeat thời gian chờ, khi NPC biến mất thì tiếp tục các board tiếp theo.
