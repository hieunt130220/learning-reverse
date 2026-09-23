# AvatarHD Maze Chest Daily Limit Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ngắt ngay lập tức quá trình chạy probe Mê Cung (Map 28) khi nhận được thông báo chạm giới hạn nhận 30 hộp quà trong ngày từ game server.

**Architecture:** Bổ sung hàm `isDailyLimitMessage(text: string)`. Khi nhận gói phản hồi mở rương `TX 48` (qua thoại `RX -40` hoặc tab `RX -62`), nếu thông báo chứa nội dung giới hạn 30 hộp quà trong ngày, đánh dấu `dailyLimitReached = true`, gán kết quả rương là `daily_limit`, ngắt ngay vòng lặp mở rương tuần tự và bỏ qua toàn bộ giai đoạn chờ chu kỳ hồi sinh `--watch-cycle`.

**Tech Stack:** TypeScript, Node.js, `tsx`, `avatar-web-server`.

**Spec:** `docs/superpowers/specs/2026-09-22-maze-daily-limit-handling-design.md`

## Global Constraints
- Tuân thủ quy tắc KHÔNG TDD theo `CLAUDE.md`: Không tạo test files, không viết test trước.
- Giữ nguyên các cơ chế an toàn và luồng giao thức hiện có.

---

### Task 1: Cập Nhật Hàm Nhận Diện và Kiểu Dữ Liệu

**Files:**
- Modify: `avatar-web/server/src/tools/maze-probe.ts:80-120`
- Modify: `avatar-web/server/src/tools/maze-probe.ts:440-470`

**Interfaces:**
- Consumes: `MazeProbeResult`, `isMazeClosureMessage`
- Produces: `isDailyLimitMessage`, `MazeProbeResult.dailyLimitReached`, kiểu kết quả rương `'daily_limit'`

- [x] **Step 1: Mở rộng `MazeProbeResult`**
  Thêm trường `dailyLimitReached?: boolean` vào `MazeProbeResult`.
  Cập nhật kiểu kết quả `multiChestHistory[i].result` thành `'success' | 'taken_by_other' | 'unreachable' | 'daily_limit' | 'failed'`.

- [x] **Step 2: Thêm hàm `isDailyLimitMessage`**
  ```typescript
  function isDailyLimitMessage(text: string): boolean {
    const lower = text.toLowerCase();
    return (
      lower.includes('đủ 30 hộp quà') ||
      (lower.includes('30 hộp quà') && lower.includes('hôm nay'))
    );
  }
  ```

- [x] **Step 3: Kiểm tra biên dịch**
  Run: `npm --prefix avatar-web/server run typecheck`
  Expected: Exit code 0.

---

### Task 2: Tích Hợp Cơ Chế Ngắt Khi Chạm Giới Hạn Ngày

**Files:**
- Modify: `avatar-web/server/src/tools/maze-probe.ts:1040-1220`
- Modify: `avatar-web/server/src/tools/maze-probe.ts:1330-1370`

**Interfaces:**
- Consumes: `isDailyLimitMessage`, `multiChestHistory`, `args.watchCycle`
- Produces: Ngắt ngay lập tức khi phát hiện giới hạn 30 quà, bỏ qua watchCycle

- [x] **Step 1: Xử lý ngắt trong vòng lặp mở rương tuần tự**
  Khởi tạo biến cờ `let dailyLimitReached = false`.
  Trong khối kiểm tra phản hồi sau khi gửi `TX 48`:
  - Kiểm tra `dialogMessages.some(isDailyLimitMessage)` hoặc `isDailyLimitMessage(outcomeDialog)`.
  - Nếu đúng:
    - Gán `openOutcome = 'daily_limit'`.
    - Gán `dailyLimitReached = true`.
    - In log: `[LIMIT] Đã nhận đủ 30 hộp quà của ngày hôm nay! Dừng mở rương.`
    - Ghi nhận rương hiện tại vào `multiChestHistory`.
    - Gọi `break` để thoát ngay khỏi vòng lặp `while`.

- [x] **Step 2: Ngắt ở chế độ mở đơn lẻ `--open-chest <id>`**
  Nếu `dialogMessages.some(isDailyLimitMessage)` -> gán `dailyLimitReached = true`.

- [x] **Step 3: Bỏ qua giai đoạn `--watch-cycle` nếu đã đạt giới hạn ngày**
  Cập nhật điều kiện:
  ```typescript
  if (args.watchCycle && state.status === 'open' && !dailyLimitReached) { ... }
  ```
  Nếu `dailyLimitReached === true`, in cảnh báo: `[WATCH] Đã đạt giới hạn 30 hộp quà ngày, bỏ qua theo dõi chu kỳ hồi sinh.`

- [x] **Step 4: Cập nhật kết quả đầu ra & in tổng kết**
  Gán `result.dailyLimitReached = dailyLimitReached`.
  In dòng cảnh báo đỏ/vàng trên terminal nếu `dailyLimitReached === true`.

- [x] **Step 5: Kiểm tra biên dịch & Build**
  Run: `npm --prefix avatar-web/server run typecheck && npm --prefix avatar-web/server run build`
  Expected: Exit code 0.

---

### Task 3: Kiểm Tra Tính Đúng Đắn & Tạo Commit

**Files:**
- Verify: `avatar-web/server/src/tools/maze-probe.ts`

- [x] **Step 1: Kiểm tra logic nhận diện chuỗi**
  Chạy script node kiểm tra `isDailyLimitMessage("Bạn đã nhận đủ 30 hộp quà của ngày hôm nay rồi. Quay lại vào ngày khác nhé")`.
  Expected: `true`.

- [x] **Step 2: Kiểm tra git diff & Tạo Commit**
  Run: `git commit -am "feat(maze): stop probe when daily limit of 30 chests is reached"`
