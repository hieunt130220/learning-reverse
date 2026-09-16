# Maze Chest Probe Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng công cụ CLI `avatar-web/server/src/tools/maze-probe.ts` tự động kiểm tra giờ mở cửa Mê cung (map 28), trích xuất snapshot danh mục rương kho báu (`ItemMapSpecial`), và test mở rương (`TX 48`) / nhận quà (`RX 47`).

**Architecture:** Tạo CLI probe độc lập kế thừa kiến trúc an toàn từ `mining-probe.ts` và `chest-probe.ts`. Sử dụng `GameClient` để login, chuyển context `cmd -1 [9]`, gọi `cmd 90` và `cmd 80` (Mê cung map 28). Bắt sự kiện thoại `RX -40` (thông báo đóng cửa) và snapshot `RX 80` + cập nhật `RX 48`, ghi nhận phản hồi `TX 48` / `RX 47` khi có cờ `--open-chest <id>`.

**Tech Stack:** TypeScript, Node.js (v20+), SQLite (`better-sqlite3`), Network Protocol AvatarHD.

**Spec:** `docs/superpowers/specs/2026-09-16-maze-chest-probe-design.md`

## Global Constraints
- Không tạo test files mới (tuân thủ nguyên tắc KHÔNG TDD trong `CLAUDE.md`).
- Output JSON redact toàn bộ thông tin nhạy cảm (mật khẩu, auth token, salt).
- Tuân thủ quy tắc GitNexus (`gitnexus_impact` trước khi sửa, `gitnexus_detect_changes()` trước khi commit).
- Mặc định an toàn: Chỉ đọc snapshot rương, chỉ thực hiện thao tác mở rương khi người dùng truyền cờ rõ ràng `--open-chest <id>`.

---

### Task 1: Tạo công cụ `maze-probe.ts`

**Files:**
- Create: `avatar-web/server/src/tools/maze-probe.ts`

**Interfaces:**
- Consumes:
  - `GameClient` (`src/game/client.ts`)
  - `getAccountById`, `readGamePass` (`src/accounts/repo.ts`)
  - `loadConfig` (`src/config.ts`)
  - `openDb` (`src/db/index.js`)
  - `NATIVE_PARK_JOIN_POSITIONS` (`src/game/parkService.ts`)
  - `MyReader` (`src/proto/reader.ts`)
- Produces:
  - CLI script chạy qua `node --env-file=.env --import tsx src/tools/maze-probe.ts` xuất JSON metadata rương và quà tặng.

- [x] **Step 1: Viết mã nguồn `avatar-web/server/src/tools/maze-probe.ts`**
  Bao gồm:
  - Parse CLI options: `--account-id <N>`, `--area <A>` (default 0), `--open-chest <id>`, `--output <json|text>`.
  - Decoder `ItemMapSpecial` từ `RX 80` (hỗ trợ đọc `id`, `name`, `x`, `y`, `type`, `idImg`, `touch`, `block`, `idMenu`).
  - Decoder `RX 48`: subType 2 (xóa rương), subType 0/1 (thêm rương).
  - Decoder `RX 47`: subType 0 (rơi sàn `idGift`, `xDrop`, `yDrop`), subType 10 (nhận trực tiếp `idGift`), subType 11 (`doGift`).
  - Bắt `RX -40` (hộp thoại đóng cửa / thông báo server) và `RX -62` (hộp thoại nhận quà).
  - Khi có `--open-chest <id>`: Gửi `TX 48 [i8 3, i32 id, i8 0]` sau khi join map thành công.

- [x] **Step 2: Kiểm tra Typecheck và Build**
  Run: `npm --prefix avatar-web/server run typecheck && npm --prefix avatar-web/server run build`
  Expected: Không có lỗi TypeScript compilation.

---

### Task 2: Chạy kiểm thử Probe thực tế ở trạng thái hiện tại (Map đóng cửa)

**Files:**
- Test target: `avatar-web/server/src/tools/maze-probe.ts`

**Interfaces:**
- Consumes: Server game live và account ID 3 trong CSDL SQLite.

- [x] **Step 1: Thực thi probe với Account ID 3**
  Run: `cd avatar-web/server && node --env-file=.env --import tsx src/tools/maze-probe.ts --account-id 3 --area 0`
  Expected:
  - Kết nối và đăng nhập thành công.
  - Nhận thoại `RX -40` từ server: `"Mê cung hiện tại đang đóng cửa. Mê cung sẽ mở cửa vào 20h45 mỗi thứ 3 và thứ 5. Bạn hãy quay lại sau nhé"`.
  - Script ghi nhận `status: "closed"` và thoát sạch sẽ, không crash.

---

### Task 3: GitNexus Scope Check & Commit

**Files:**
- Verify: `avatar-web/server/src/tools/maze-probe.ts`
- Commit: `feat(probe): add maze chest probe tool for map 28`

- [x] **Step 1: Chạy `gitnexus_detect_changes()`**
  Verify: Không có ảnh hưởng ngoài ý muốn lên các file lõi khác.

- [ ] **Step 2: Tạo git commit**
  Run: `git add avatar-web/server/src/tools/maze-probe.ts docs/superpowers/specs/2026-09-16-maze-chest-probe-design.md docs/superpowers/plans/2026-09-16-maze-chest-probe.md`
  Commit message:
  ```
  feat(probe): add maze chest probe tool for map 28
  
  Co-Authored-By: Claude Code <noreply@anthropic.com>
  ```
