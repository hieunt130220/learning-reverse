# AvatarHD Maze Chest Respawn Cycle Probe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bổ sung chế độ `--watch-cycle` vào công cụ `maze-probe.ts` để tự động giám sát và đo lường khoảng thời gian hồi sinh rương trong Mê Cung (Map 28) sau khi mở sạch rương trong khu vực.

**Architecture:** Mở rộng `ProbeArgs` với các cờ `--watch-cycle` và `--watch-timeout <seconds>`. Sau khi kết thúc đợt mở rương hoặc khi số rương trống chạm mốc 0, ghi nhận $T_{\text{empty}}$ và chuyển sang chế độ lắng nghe liên tục các gói `RX 48` / `RX -38` / `RX 80`. Khi phát hiện rương trống mới, ghi nhận $T_{\text{respawn}}$, tính toán độ trễ chu kỳ $\Delta T = T_{\text{respawn}} - T_{\text{empty}}$, và (tuỳ chọn) kích hoạt vòng mở tiếp theo.

**Tech Stack:** TypeScript, Node.js, `tsx`, `avatar-web-server` internal protocol & GameClient session.

**Spec:** `docs/superpowers/specs/2026-09-17-maze-cycle-probe-design.md`

## Global Constraints
- Tuân thủ quy tắc KHÔNG TDD theo `CLAUDE.md`: Không tạo test files, không viết test trước.
- Không sửa đổi cấu trúc gói tin lõi đã được kiểm chứng hoạt động.
- Giữ nhịp kiểm tra 1000ms trong vòng lặp theo dõi chu kỳ để đảm bảo độ chính xác thời gian và tiết kiệm CPU.

---

### Task 1: Cập Nhật Argument Parser & Kiểu Dữ Liệu Quan Sát Chu Kỳ

**Files:**
- Modify: `avatar-web/server/src/tools/maze-probe.ts:27-185`

**Interfaces:**
- Consumes: `ProbeArgs`, `parseArgs`
- Produces: `ProbeArgs.watchCycle`, `ProbeArgs.watchTimeout`, `CycleObservation`

- [x] **Step 1: Khai báo kiểu `CycleObservation` và mở rộng `ProbeArgs`**
  Thêm `watchCycle: boolean` và `watchTimeout: number` vào `interface ProbeArgs`.
  Thêm `cycleObservation?: CycleObservation` vào `interface MazeProbeResult`.

- [x] **Step 2: Thêm cờ `--watch-cycle` và `--watch-timeout` vào `parseArgs`**
  Xử lý cờ boolean `--watch-cycle` (mặc định false).
  Xử lý cờ `--watch-timeout <N>` với validation số nguyên 10..1800 (mặc định 600).

- [x] **Step 3: Kiểm tra biên dịch**
  Run: `npm --prefix avatar-web/server run typecheck`
  Expected: Exit code 0.

---

### Task 2: Triển Khai Logic Giám Sát Chu Kỳ Hồi Sinh Sau Khi Hết Rương

**Files:**
- Modify: `avatar-web/server/src/tools/maze-probe.ts:1000-1170`

**Interfaces:**
- Consumes: `currentSpecials`, `isChest`, `observeFor`, `dialogMessages`
- Produces: `CycleObservation`, tự động đo lường thời gian $\Delta T$

- [x] **Step 1: Lắng nghe thông báo hệ thống và bắt gói reset rương**
  Lắng nghe sự kiện gói tin `RX -38` (thông báo sự kiện map/server) và lưu vào mảng `announcements`.
  Theo dõi các thay đổi trong `currentSpecials` khi `RX 48` cập nhật rương có `name === ""`.

- [x] **Step 2: Khối logic theo dõi chu kỳ hồi sinh (`watchCycle`)**
  Sau khi khối `autoNavigate` hoàn thành (hoặc kiểm tra ngay nếu không bật di chuyển):
  - Đếm số rương trống còn lại: `const emptyCount = chests.filter(c => !c.name).length`.
  - Nếu `emptyCount > 0` và bật `autoNavigate`: Tiếp tục mở hết các rương còn trống.
  - Khi `emptyCount === 0`:
    - Ghi nhận `emptyTimestamp = Date.now()`.
    - In log: `[WATCH] Đã hết toàn bộ rương trống trong khu vực. Bắt đầu theo dõi chu kỳ hồi sinh...`
    - Vòng lặp `while (Date.now() - emptyTimestamp < watchTimeoutMs && !abort.signal.aborted)`:
      - Chờ `await observeFor(1000)`.
      - Kiểm tra `chests.filter(c => !c.name && !state.removedChestIds.has(c.id))`.
      - Nếu phát hiện rương trống (`respawnedCount > 0`):
        - Ghi nhận `respawnTimestamp = Date.now()`.
        - Tính `durationSeconds = Math.round((respawnTimestamp - emptyTimestamp) / 1000)`.
        - Ghi nhận `cycleObservation`.
        - In thông báo: `[CYCLE] ĐÃ PHÁT HIỆN RƯƠNG HỒI SINH! Chu kỳ: ${durationSeconds} giây.`
        - Nếu bật `autoNavigate`: Tiếp tục chạy mở các rương mới này.
        - Thoát vòng lặp chờ.

- [x] **Step 3: Cập nhật định dạng báo cáo kết quả**
  In thông tin chu kỳ hồi sinh trong console output và cấu trúc JSON.

- [x] **Step 4: Kiểm tra biên dịch & Build**
  Run: `npm --prefix avatar-web/server run typecheck && npm --prefix avatar-web/server run build`
  Expected: Exit code 0.

---

### Task 3: Kiểm Thử Live Đo Chu Kỳ & Tạo Commit

**Files:**
- Verify: `avatar-web/server/src/tools/maze-probe.ts`

- [x] **Step 1: Chạy kiểm thử live với chế độ `--watch-cycle`**
  Run: `cd avatar-web/server && ./node_modules/.bin/tsx --env-file=.env src/tools/maze-probe.ts --account-id 3 --area 5 --auto-navigate --watch-cycle --watch-timeout 300`
  Expected: Tool tự động mở hết các rương trống còn lại trong khu vực, sau đó giữ kết nối theo dõi và phát hiện thời điểm rương mới hồi sinh.

- [x] **Step 2: Khởi động lại server avatar-web**
  Run: `cd avatar-web/server && nohup npm run dev > /dev/null 2>&1 &`

- [x] **Step 3: Kiểm tra git diff & Tạo Commit**
  Run: `git commit -am "feat(maze): add respawn cycle observation mode to maze probe"`
