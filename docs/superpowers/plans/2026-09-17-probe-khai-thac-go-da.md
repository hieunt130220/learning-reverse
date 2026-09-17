# Kế Hoạch Thực Thi — Thử Nghiệm Giao Thức Khai Thác Mỏ Đá & Mỏ Gỗ (AvatarHD 3.4.4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thực hiện probe 1 lần có kiểm soát gửi `TX -59` chạm mỏ đá và `TX -61` chọn menu đào tại Room 26, sau đó quét các khu vực của Room 22 để ghi nhận toàn diện cơ chế khai thác đá và gỗ.

**Architecture:** Mở rộng công cụ `avatar-web/server/src/tools/maplink-probe.ts` bổ sung tính năng `--mine-rock <objectId> --menu <idMenu>` (gửi chuỗi TX -59 chạm mỏ, chờ RX menu, gửi TX -61 đào, bắt RX -40 dialog/RX 48/RX 70) và `--scan-areas <count>` cho Room 22. Không sửa file production nào.

**Tech Stack:** Node.js + TypeScript ESM, `tsx`, `GameClient.sendRaw`, Binary Big-endian `Message` / `MyReader`.

**Spec:** `docs/superpowers/specs/2026-09-17-probe-khai-thac-go-da-design.md`

## Global Constraints
- **KHÔNG TDD, không tạo test files** (theo `CLAUDE.md`).
- **Safety Guards:**
  - Whitelist TX: `-1, 80, -59, -61, 70` (+ `-94` ping).
  - Tối đa 1 lần gửi `TX -59` và 1 lần gửi `TX -61` trong toàn bộ phiên probe.
  - Cooldown giữa các lượt join ≥ 2000ms.
  - Tự động bắt sự kiện `dialog`, `temporary-rejection`, `closed` và ngắt kết nối an toàn.
- Không commit git trong phiên làm việc.

---

### Task 1: Bổ sung tính năng tương tác khai thác mỏ đá vào `maplink-probe.ts`

**Files:**
- Modify: `avatar-web/server/src/tools/maplink-probe.ts`

**Interfaces:**
- Consumes: `objectId = 2000000028`, `idMenu = 1207`
- Produces: JSON log ghi nhận gói tin `RX -62 / -101` (menu runtime) và `RX -40 / 48 / 70` (kết quả đào đá).

- [x] **Step 1: Thêm tùy chọn `--mine-rock <objectId>` và `--menu <idMenu>` vào `maplink-probe.ts`**
  - Join Room 26 khu 0.
  - Gửi `TX -59 [i32 objectId]`.
  - Chờ nhận danh sách menu (`RX -62` hoặc `-101`) trong 5s.
  - Gửi `TX -61 [i32 objectId, i8 idMenu, i8 -1]`.
  - Chờ nhận phản hồi kết quả trong 5s (dialog thông báo, cập nhật object hoặc thay đổi kho).
  - Rời về Map 17 an toàn và logout.

- [x] **Step 2: Typecheck**
  Run: `cd avatar-web/server && npm run typecheck`
  Expected: Pass, không có lỗi.

- [x] **Step 3: Chạy live thử nghiệm đào mỏ đá tại Room 26 (đúng 1 lần)**
  Run: `set -a; source .env; set +a; npx tsx src/tools/maplink-probe.ts --account-id 3 --probe-submap 26 --mine-rock 2000000028 --menu 1207`
  Expected: Bắt được menu runtime và thông điệp server khi đào mỏ đá.

---

### Task 2: Khảo sát các khu vực rừng gỗ tại Room 22

**Files:**
- Modify: `avatar-web/server/src/tools/maplink-probe.ts`

**Interfaces:**
- Consumes: `targetRoomId = 22`, số khu cần quét (`10`)
- Produces: JSON thống kê số lượng `ItemMapSpecial` hoặc trạng thái của từng khu 0..9 trong Room 22.

- [x] **Step 1: Bổ sung cờ `--scan-areas <count>` cho chế độ `probe-submap`**
  - Duyệt tuần tự qua các khu 0..count-1 (cooldown ≥ 2000ms).
  - Chụp snapshot `RX 80` của từng khu.

- [x] **Step 2: Chạy live quét 10 khu của Room 22**
  Run: `set -a; source .env; set +a; npx tsx src/tools/maplink-probe.ts --account-id 3 --probe-submap 22 --scan-areas 10`
  Expected: Xác định khu nào có đối tượng động hoặc xác nhận cây gỗ là tilemap thuần túy.

---

### Task 3: Ghi nhận kết quả vào Evidence Document

**Files:**
- Modify: `docs/protocol/khu-ngoai-o-cong-map-con-evidence-2026-09-17.md`

- [x] **Step 1: Cập nhật kết quả đào đá và khảo sát rừng gỗ vào file evidence**
