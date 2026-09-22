# AvatarHD Central Park Probe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng tool probe `park-probe.ts` để kết nối vào Công viên trung tâm (Map 0, Board 0), quét và in tóm tắt danh sách người chơi (Users) và NPC/Specials trong khu vực.

**Architecture:** Bổ sung toạ độ native map 0 `(254, 82)` vào `NATIVE_PARK_JOIN_POSITIONS` trong `parkService.ts`. Tạo script độc lập `park-probe.ts` tận dụng `GameClient` để xác thực, chuyển context Park (`TX -1 [9]`), xin board catalog (`TX 90`), gửi `TX 80` vào map 0 board 0, giải mã danh sách người chơi và specials từ `RX 80`, lắng nghe thêm `RX 48` trong 2s grace period rồi in báo cáo tóm tắt.

**Tech Stack:** TypeScript, Node.js (tsx), Socket binary protocol (Message, MyReader).

**Spec:** `docs/superpowers/specs/2026-09-22-central-park-probe-design.md`

## Global Constraints

- Tuân thủ quy định **KHÔNG TDD** trong `CLAUDE.md` (không tạo test files, đi thẳng vào production code).
- Tuân thủ GitNexus (`gitnexus_impact` trước khi sửa symbol, `gitnexus_detect_changes` trước khi commit).
- Xử lý cleanup socket và database connection an toàn khi kết thúc hoặc lỗi.

---

### Task 1: Bổ sung toạ độ native Map 0 vào `parkService.ts`

**Files:**
- Modify: `avatar-web/server/src/game/parkService.ts:80-105`

**Interfaces:**
- Produces: `NATIVE_PARK_JOIN_POSITIONS[0] = { x: 254, y: 82 }`

- [ ] **Step 1: Chạy GitNexus impact analysis trước khi sửa**
Run: `gitnexus_impact({target: "NATIVE_PARK_JOIN_POSITIONS", direction: "upstream"})`
Expected: Kiểm tra các caller của `NATIVE_PARK_JOIN_POSITIONS` (chủ yếu là `ParkService.doJoinPark`).

- [ ] **Step 2: Thêm toạ độ map 0 vào `NATIVE_PARK_JOIN_POSITIONS`**

Mở file `avatar-web/server/src/game/parkService.ts` và thêm key `0` vào bảng:

```typescript
export const NATIVE_PARK_JOIN_POSITIONS: Readonly<Record<number, NativeParkJoinPosition>> =
  Object.freeze({
    0: Object.freeze({ x: 254, y: 82 }), // Công viên trung tâm (LoadMap.T_PARK = 0)
    1: Object.freeze({ x: 473, y: 100 }),
    // ...
```

- [ ] **Step 3: Kiểm tra biên dịch**
Run: `npm --prefix avatar-web/server run typecheck`
Expected: TypeScript compile thành công, không có lỗi type.

- [ ] **Step 4: Kiểm tra thay đổi GitNexus và commit**
Run: `gitnexus_detect_changes({scope: "unstaged"})`
Run:
```bash
git add avatar-web/server/src/game/parkService.ts
git commit -m "feat(park): add native coordinates for Central Park map 0

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: Tạo công cụ probe `park-probe.ts`

**Files:**
- Create: `avatar-web/server/src/tools/park-probe.ts`

**Interfaces:**
- Consumes: `GameClient` (`../game/client.js`), `openDb` (`../db/index.js`), `getAccountById`, `readGamePass` (`../accounts/repo.js`), `NATIVE_PARK_JOIN_POSITIONS` (`../game/parkService.js`), `MyReader` (`../proto/reader.js`).
- Produces: CLI script chạy quét người chơi và NPC theo map/board chỉ định.

- [ ] **Step 1: Viết script `park-probe.ts`**

Tạo file `avatar-web/server/src/tools/park-probe.ts` với đầy đủ logic:
1. Parse CLI arguments (`--account-id`, `--map` mặc định 0, `--board` mặc định 0).
2. Kiểm tra web server local dừng (`assertAvatarWebStopped`).
3. Đăng nhập game client với tài khoản trong SQLite.
4. Chuyển ngữ cảnh Park qua `client.enterParkContext()` và chờ ACK `RX -1 [9]`.
5. Xin sĩ số khu qua `client.sendRaw(90, [{ t: 'i8', v: String(map) }])` và bắt `RX 90`.
6. Gửi lệnh vào phòng qua `client.sendRaw(80, [...])`.
7. Giải mã `RX 80`:
   - Trích xuất mảng `ParkUser`: `id`, `name`, `x`, `y`, `dir`.
   - Bỏ qua `dropParts`, `mapMarker`, `mapItem`, `animCount`.
   - Trích xuất mảng `ParkNpc`: `id`, `name`, `x`, `y`, `type`, `menuIds`.
8. Lắng nghe `RX 48` trong 2 giây grace period để cập nhật NPC bổ sung.
9. In kết quả tóm tắt ra console theo format:
   ```text
   === CÔNG VIÊN TRUNG TÂM (Map 0 - Board 0) ===
   Sĩ số phòng: X người chơi

   [Danh sách User (N người)]:
     - [ID] Tên (vị trí: x, y)

   [Danh sách NPC / Specials (M đối tượng)]:
     - [ID] Tên (vị trí: x, y - menus: [...])
   ```
10. Tự động đóng kết nối socket và SQLite DB trong khối `finally`.

- [ ] **Step 2: Kiểm tra biên dịch**
Run: `npm --prefix avatar-web/server run typecheck`
Expected: Typecheck hoàn tất không có lỗi.

- [ ] **Step 3: Chạy thử nghiệm probe thực tế**
Run:
```bash
node --env-file=avatar-web/server/.env --import tsx avatar-web/server/src/tools/park-probe.ts --account-id 1 --map 0 --board 0
```
Expected: Kết nối thành công, join vào Map 0 Board 0, in ra danh sách User và NPC trong khu vực.

- [ ] **Step 4: Kiểm tra thay đổi GitNexus và commit**
Run: `gitnexus_detect_changes({scope: "unstaged"})`
Run:
```bash
git add avatar-web/server/src/tools/park-probe.ts
git commit -m "feat(probe): add park-probe tool scanning users and npcs

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```
