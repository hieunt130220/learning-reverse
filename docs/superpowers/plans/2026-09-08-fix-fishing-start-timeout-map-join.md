# Fix Fishing Start Timeout & Map 14 Join Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khắc phục lỗi timeout 8 giây "server từ chối: hết giờ chờ bắt đầu câu" bằng cách chuẩn hóa tọa độ native Map 14 và thay thế cơ chế vào map mù bằng xác thực snapshot RX 80 có phát hiện lỗi server tức thì.

**Architecture:** Cập nhật tọa độ Map 14 trong `parkService.ts` thành `(460, 97)` theo đúng native binary; trong `runFishingLoop` (`avatarSession.ts`), gắn listener `client.waitForWorldSnapshot` và listener `dialog` trước khi gửi `joinPark`, đảm bảo xác nhận vào map thành công trước khi gửi `TX 45`.

**Tech Stack:** TypeScript, Node.js, EventEmitter, AbortSignal

**Spec:** `docs/superpowers/specs/2026-09-08-fix-fishing-start-timeout-map-join-design.md`

## Global Constraints
- Không viết test trước (no TDD) theo quy định bắt buộc của CLAUDE.md.
- Mọi khoảng chờ async PHẢI sử dụng hoặc kế thừa `AbortSignal` (`signal`) để có thể hủy tức thời khi user dừng hoặc chuyển mode.
- Tuân thủ quy tắc GitNexus (`gitnexus_impact` trước khi sửa, `gitnexus_detect_changes` trước khi commit).

---

### Task 1: Cập nhật tọa độ chuẩn native cho Map 14

**Files:**
- Modify: `avatar-web/server/src/game/parkService.ts:34-52`

**Interfaces:**
- Consumes: None
- Produces: `NATIVE_PARK_JOIN_POSITIONS[14] = { x: 460, y: 97 }`

- [x] **Step 1: Cập nhật tọa độ Map 14 trong `parkService.ts`**
  Sửa dòng 34 và 48 trong `parkService.ts`:
  ```typescript
  // 14: Khu cá rô (460, 97) — verified from native bot bs_0.java & live traffic
  ...
  14: Object.freeze({ x: 460, y: 97 }),
  ```

- [x] **Step 2: Kiểm tra biên dịch**
  Run: `npm run build -w avatar-web/server`
  Expected: Build thành công không có lỗi type.

---

### Task 2: Tích hợp `waitForWorldSnapshot` và Bắt Dialog Lỗi vào `runFishingLoop`

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts:1740-1760`

**Interfaces:**
- Consumes: `client.waitForWorldSnapshot`, `client.on('dialog')`, `client.joinPark`
- Produces: Xác nhận vào Map 14 an toàn qua `RX 80` trước khi gọi `client.startFishing()` (`TX 45`), reject tức thì nếu server từ chối vào map.

- [x] **Step 1: Thay thế blind delay bằng cơ chế xác thực snapshot**
  Trong `avatarSession.ts` hàm `runFishingLoop`:
  1. Gửi `client.enterParkContext()` và chờ delay 800ms.
  2. Khởi tạo `pendingSnapshot = client.waitForWorldSnapshot(signal, 6000, { map, area })`.
  3. Khởi tạo `dialogErrorPromise`: lắng nghe sự kiện `dialog` từ client; nếu reason khác `PARK_ALREADY_IN_AREA_DIALOG` thì reject ngay lập tức với thông báo `server từ chối vào map: ${reason}`.
  4. Gửi `client.joinPark(map, area)`.
  5. Chờ `await Promise.race([pendingSnapshot, dialogErrorPromise])`.
  6. Nếu bị lỗi hoặc server từ chối: set `status = 'rejected'`, ghi log, cập nhật runtime error và dừng loop.
  7. Nếu thành công: ghi log `[câu cá] đã vào khu vực câu cá map ${map}` và tiếp tục gọi `client.startFishing()`.

- [x] **Step 2: Kiểm tra biên dịch**
  Run: `npm run build -w avatar-web/server`
  Expected: Server build thành công 100%.

---

### Task 3: Kiểm tra GitNexus, Xác Minh Live trên Tài Khoản 3 & Commit

**Files:**
- Modify: `avatar-web/server/src/game/parkService.ts`
- Modify: `avatar-web/server/src/session/avatarSession.ts`

- [x] **Step 1: Chạy `gitnexus_detect_changes()`**
  Xác minh chỉ các file và symbol trong phạm vi bị ảnh hưởng.

- [x] **Step 2: Test live trực tiếp trên account 3**
  1. Bật chế độ `auto_fishing` qua API:
     `POST /api/accounts/3/automation/start {"mode": "auto_fishing"}`.
  2. Theo dõi traffic và session logs:
     - Gói `TX 80` được gửi với `x=460, y=97`.
     - Nhận gói `RX 80` từ server xác nhận vào Map 14.
     - Gửi `TX 45` và nhận ngay gói `RX 45 len=1 hex=01` (không còn lỗi timeout 8 giây).
     - Bot tiến hành quăng cần `TX 41`, đợi cá cắn `RX 79`, giải challenge `TX 43` và thu cá `TX 44`.
  3. Dừng auto fishing an toàn qua API:
     `POST /api/accounts/3/automation/stop`.

- [x] **Step 3: Commit code**
  Commit message: `fix(fishing): correct map 14 coordinates and wait for world snapshot before starting fishing`
