# Maze Pathfinding & Auto Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng module tìm đường A* (`mazePathfinding.ts`), bổ sung các phương thức di chuyển (`TX 84`) / nhặt quà (`TX 47`) vào `ParkService`, và tích hợp cờ `--auto-navigate` vào `maze-probe.ts` để tự động tiếp cận và mở rương trong Mê cung.

**Architecture:** Xây dựng thuật toán tìm đường trên lưới ô vuông 24px né vật cản (`tile type = 4`). Mở rộng `ParkService` với opcode `TX 84` (`doMove`) và opcode `TX 47` (`doPickupGift`). Tích hợp luồng điều hướng vào `maze-probe.ts`, gửi từng bước di chuyển nhịp nhàng tới rương và tự động nhặt quà khi rớt sàn.

**Tech Stack:** TypeScript, Node.js (v20+), thuật toán tìm đường đồ thị (A* / Breadth-First Search).

**Spec:** `docs/superpowers/specs/2026-09-16-maze-pathfinding-design.md`

## Global Constraints
- Không tạo test files mới (tuân thủ nguyên tắc KHÔNG TDD trong `CLAUDE.md`).
- Tuân thủ quy tắc GitNexus (`gitnexus_impact` trước khi sửa, `gitnexus_detect_changes()` trước khi commit).
- Mặc định an toàn: Di chuyển chỉ kích hoạt khi có cờ rõ ràng `--auto-navigate`. Tốc độ gửi lệnh `TX 84` tuân thủ nhịp bước đi tự nhiên (250–300ms / bước), chống anti-spam của server.

---

### Task 1: Xây dựng Module Tìm Đường `mazePathfinding.ts`

**Files:**
- Create: `avatar-web/server/src/game/mazePathfinding.ts`

**Interfaces:**
- Consumes: Toạ độ pixel Avatar `(x, y)` và kích thước tile 24×24px.
- Produces:
  - `Point { x: number, y: number }`
  - `PathfindingResult { reachable: boolean, waypoints: Point[], distance: number }`
  - `findMazePath(start: Point, target: Point, isObstacle: (tileX: number, tileY: number) => boolean): PathfindingResult`
  - `getMovementDirection(from: Point, to: Point): number` (`0=Right, 1=Down, 2=Left, 3=Up`)

- [x] **Step 1: Viết mã nguồn `avatar-web/server/src/game/mazePathfinding.ts`**
  Triển khai:
  - Chuyển đổi qua lại giữa toạ độ pixel và toạ độ tile (`Math.floor(x / 24)`).
  - Thuật toán A* với heuristic khoảng cách Manhattan.
  - Hàm tính hướng di chuyển `0=Phải, 1=Xuống, 2=Trái, 3=Lên` khớp hoàn toàn với `Base.direct` trong client native.
  - Làm mịn đường đi (loại bỏ các điểm thẳng hàng không cần thiết để tạo waypoints gãy gọn).

- [x] **Step 2: Kiểm tra Typecheck**
  Run: `npm --prefix avatar-web/server run typecheck`
  Expected: Typecheck pass không có lỗi.

---

### Task 2: Mở rộng `ParkService` với Opcode `TX 84` và `TX 47`

**Files:**
- Modify: `avatar-web/server/src/game/parkService.ts`

**Interfaces:**
- Consumes: Session socket.
- Produces:
  - `ParkService.doMove(x: number, y: number, direct: number): void`
  - `ParkService.doPickupGift(idGift: number): void`

- [x] **Step 1: Phân tích Impact với GitNexus trước khi sửa `parkService.ts`**
  Run: `gitnexus_impact({ target: "ParkService", direction: "upstream" })`

- [x] **Step 2: Thêm hằng số và phương thức vào `parkService.ts`**
  - Thêm `CMD_AVATAR_MOVE = 84` (`TX 84 [i16 x, i16 y, i8 direct]`).
  - Thêm `CMD_AVATAR_GIFT = 47` (subType `11` = nhặt quà `[i8 11, i32 idGift]`).
  - Bổ sung 2 phương thức `doMove(x, y, direct)` và `doPickupGift(idGift)`.

- [x] **Step 3: Kiểm tra Typecheck và Test Suite**
  Run: `npm --prefix avatar-web/server run typecheck && npm --prefix avatar-web/server run test`
  Expected: Toàn bộ 275 test hiện tại đều pass, 0 lỗi biên dịch.

---

### Task 3: Tích hợp Điều Hướng Tự Động vào `maze-probe.ts`

**Files:**
- Modify: `avatar-web/server/src/tools/maze-probe.ts`

**Interfaces:**
- Consumes: `findMazePath`, `getMovementDirection` từ `mazePathfinding.ts`, và `doMove`, `doPickupGift`.
- Produces: Cờ CLI `--auto-navigate` cho phép nhân vật tự tìm đường tới rương và nhặt quà.

- [x] **Step 1: Cập nhật Argument Parser & Allowlist**
  - Thêm cờ `--auto-navigate` vào `parseArgs`.
  - Cập nhật allowlist gói tin cho phép gửi `TX 84` (di chuyển) và `TX 47` (nhặt quà) trong phase park khi có cờ điều hướng.

- [x] **Step 2: Triển khai Luồng Tự Động Di Chuyển Tới Rương**
  - Khi Mê cung mở cửa và phát hiện rương:
    - Tìm đường từ vị trí hiện tại `(57, 209)` tới rương mục tiêu.
    - Lần lượt gửi `TX 84` qua từng waypoint với khoảng nghỉ 250ms giữa các bước.
    - Khi tới cự ly tương tác (< 36px), gửi lệnh mở rương `TX 48`.
    - Lắng nghe gói `RX 47 subType 0`, nếu có quà rơi ra sàn, tự động bước tới toạ độ `(xDrop, yDrop)` và gửi `TX 47 [11, idGift]`.

- [x] **Step 3: Kiểm tra Typecheck và Build**
  Run: `npm --prefix avatar-web/server run typecheck && npm --prefix avatar-web/server run build`
  Expected: Compilation exit 0.

---

### Task 4: Kiểm Thử Live Read-Only & Tạo Commit

**Files:**
- Verify: `avatar-web/server/src/tools/maze-probe.ts`
- Commit: `feat(maze): add pathfinding navigation and auto-chest runner`

- [x] **Step 1: Chạy Probe kiểm thử trên Map 28 đóng cửa**
  Run: `cd avatar-web/server && node --env-file=.env --import tsx src/tools/maze-probe.ts --account-id 3 --area 0 --auto-navigate`
  Expected: Kết nối thành công, nhận diện map đóng cửa và thoát an toàn mà không crash.

- [x] **Step 2: Kiểm tra GitNexus Scope & Tạo Commit**
  Run: `gitnexus_detect_changes()`
  Run: `git commit -m "feat(maze): add pathfinding navigation and auto-chest runner"`
