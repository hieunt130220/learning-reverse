# AvatarHD Maze Multi-Chest Sequential Runner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nâng cấp công cụ `maze-probe.ts` thành vòng lặp tự động tìm và mở liên tiếp nhiều rương kho báu trong cùng một phiên kết nối Mê cung (Map 28).

**Architecture:** Mở rộng `ProbeArgs` với cờ `--max-chests <N>`. Thay thế khối điều hướng đơn điểm trong `maze-probe.ts` bằng vòng lặp `while` đa điểm: liên tục chọn rương trống (`name === ""`) gần nhất từ toạ độ hiện tại, tìm đường A*, di chuyển qua từng waypoint, gửi `TX 48` mở rương, ghi nhận kết quả và lặp lại từ toạ độ vừa đến cho tới khi hết rương khả dụng hoặc đạt giới hạn.

**Tech Stack:** TypeScript, Node.js, `tsx`, `better-sqlite3`, `avatar-web-server` internal protocol & pathfinding (`findMazePath`).

**Spec:** `docs/superpowers/specs/2026-09-17-maze-multi-chest-runner-design.md`

## Global Constraints
- Tuân thủ quy tắc KHÔNG TDD theo `CLAUDE.md`: Không tạo test files, không viết test trước.
- Giữ nguyên các cơ chế an toàn: cờ allowlist kiểm duyệt các gói gửi đi, tự động đóng kết nối khi có sự cố.
- Giữ khoảng nghỉ 250ms giữa các bước di chuyển (TX 84) để tránh bị server kick vì spam toạ độ.

---

### Task 1: Cập Nhật CLI Argument Parser và Khai Báo Kiểu Dữ Liệu

**Files:**
- Modify: `avatar-web/server/src/tools/maze-probe.ts:27-175`

**Interfaces:**
- Consumes: `ProbeArgs`, `parseArgs`
- Produces: `ProbeArgs.maxChests`, xử lý cờ `--max-chests <N>`

- [x] **Step 1: Mở rộng `ProbeArgs`**
  Thêm trường `maxChests?: number` vào `interface ProbeArgs`.
  Thêm trường `multiChestHistory?: Array<{ chestId: number; pos: { x: number; y: number }; steps: number; result: string; dialog?: string }>` vào `MazeProbeResult`.

- [x] **Step 2: Thêm cờ `--max-chests` vào `parseArgs`**
  Hỗ trợ `--max-chests <N>` với validation số nguyên dương 1..50 (mặc định 34).

- [x] **Step 3: Kiểm tra biên dịch**
  Run: `npm --prefix avatar-web/server run typecheck`
  Expected: Không có lỗi TypeScript.

---

### Task 2: Chuyển Đổi Khối Điều Hướng Sang Vòng Lặp Đa Rương Tuần Tự

**Files:**
- Modify: `avatar-web/server/src/tools/maze-probe.ts:840-985`

**Interfaces:**
- Consumes: `findMazePath`, `currentSpecials`, `currentAvatarPos`, `isChest`
- Produces: Vòng lặp `while` tự động mở liên tiếp các rương còn trống

- [x] **Step 1: Xây dựng vòng lặp tuần tự**
  Khởi tạo `visitedChestIds = new Set<number>()` và danh sách lịch sử `openedList`.
  Vòng lặp `while (openedList.filter(o => o.success).length < maxChests && !abort.signal.aborted)`:
  - Lọc rương ứng viên: `isChest(c) && !c.name && !visitedChestIds.has(c.id) && !state.removedChestIds.has(c.id)`.
  - Nếu không còn rương ứng viên: break.
  - Sắp xếp chọn rương gần `currentAvatarPos` nhất.
  - Đánh dấu `visitedChestIds.add(targetChest.id)`.
  - Tìm đường A* từ `currentAvatarPos` tới `targetChest`.
  - Nếu không tìm được đường (`!path.reachable`): ghi nhận `unreachable` và `continue`.
  - Di chuyển lần lượt qua `path.waypoints`, cập nhật `currentAvatarPos` sau mỗi bước (`observeFor(250)`).
  - Khi tiếp cận cự ly <= 36px:
    - Xoá `dialogMessages`.
    - Gửi `TX 48 [i8 3, i32 id, i8 actionIndex]`.
    - Chờ 1500ms quan sát phản hồi.
    - Đọc thoại phản hồi: nếu chứa "Chúc mừng" hoặc rương được server cập nhật tên nhân vật -> `success`.
    - Ghi nhận vào `openedList`.

- [x] **Step 2: Cập nhật format in kết quả tổng kết**
  In bảng danh sách các rương đã tiếp cận, số bước đi, kết quả mở và thông báo nhận thưởng.

- [x] **Step 3: Kiểm tra biên dịch & Build**
  Run: `npm --prefix avatar-web/server run typecheck && npm --prefix avatar-web/server run build`
  Expected: Exit code 0.

---

### Task 3: Kiểm Thử Live & Tạo Commit

**Files:**
- Verify: `avatar-web/server/src/tools/maze-probe.ts`

- [x] **Step 1: Tạm dừng avatar-web nếu đang chạy**
  Run: `kill $(lsof -t -i :8787) 2>/dev/null || true`

- [x] **Step 2: Chạy kiểm thử live mở 3 rương liên tiếp**
  Run: `cd avatar-web/server && ./node_modules/.bin/tsx --env-file=.env src/tools/maze-probe.ts --account-id 3 --area 5 --auto-navigate --max-chests 3`
  Expected: Nhân vật di chuyển mượt mà qua từng rương và gửi lệnh mở lần lượt trong cùng 1 kết nối.

- [x] **Step 3: Khởi động lại server avatar-web**
  Run: `cd avatar-web/server && nohup npm run dev > /dev/null 2>&1 &`

- [x] **Step 4: Kiểm tra git status & Tạo Commit**
  Run: `git commit -am "feat(maze): support sequential multi-chest opening in maze probe"`
