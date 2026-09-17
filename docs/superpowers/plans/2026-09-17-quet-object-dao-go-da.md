# Kế Hoạch Thực Thi — Truy Vết Map Con & Quét Đối Tượng Khai Thác Gỗ/Đá (AvatarHD 3.4.4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gửi lệnh `TX -51` lấy danh sách cổng LinkMap chuẩn của Map 17, sau đó join vào các map con để trích xuất toàn bộ danh mục đối tượng khai thác `ItemMapSpecial` (cây gỗ, tảng đá, mỏ khoáng sản).

**Architecture:** Bổ sung tính năng `--get-linkmap` và `--scan-submap` vào công cụ `avatar-web/server/src/tools/maplink-probe.ts`. Tái sử dụng `GameClient`, whitelist gói tin an toàn (`-1, -51, 80`), decode cấu trúc `RX -51` (LinkMap layout) và `RX 80` (`ItemMapSpecial`). Không sửa đổi bất kỳ file production nào.

**Tech Stack:** Node.js + TypeScript ESM, `tsx`, `GameClient.sendRaw`, Binary Big-endian `Message` / `MyReader`.

**Spec:** `docs/superpowers/specs/2026-09-17-quet-object-dao-go-da-design.md`

## Global Constraints
- **KHÔNG TDD, không tạo test files** (tuân thủ nguyên tắc bắt buộc trong `CLAUDE.md`).
- **Safety Guards:**
  - Whitelist TX nghiêm ngặt: `-1, -51, 80` (+ `-94` ping). Mọi opcode khác throw lỗi và hủy phiên.
  - Cooldown giữa các lượt join ≥ 2000ms.
  - Mỗi phiên live chỉ thực hiện 1 thao tác ghi (1 lượt request hoặc 1 lượt join probe).
  - Tự động dừng và logout an toàn khi nhận phản hồi lạ, dialog `-40` hoặc ngắt kết nối.
- Không commit git trong phiên làm việc.

---

### Task 1: Mở rộng `maplink-probe.ts` hỗ trợ tải LinkMap (`TX -51`)

**Files:**
- Modify: `avatar-web/server/src/tools/maplink-probe.ts:25-90`

**Interfaces:**
- Consumes: `GameClient.sendRaw`, `GameClient.waitForMessage`, `MyReader`
- Produces: Danh sách cổng LinkMap gồm `[x1, y1, x2, y2, idMapTo]` in ra stdout dưới dạng JSON redacted.

- [x] **Step 1: Bổ sung cờ `--get-linkmap <mapId>` và logic decode `RX -51` trong `maplink-probe.ts`**
  - Chuyển sang Handler 8: `TX -1 [8]`.
  - Gửi yêu cầu dữ liệu LinkMap: `TX -51 [i8 24, i16 mapId - 1]`.
  - Đón nhận gói `RX -51`: đọc `subType (24)`, `idMap`, kích thước `wMap, hMap`, số lượng cổng `linkCount` và duyệt từng cổng `(x1, y1, x2, y2, idMapTo)`.

- [x] **Step 2: Kiểm tra biên dịch & Typecheck**
  Run: `cd avatar-web/server && npm run typecheck`
  Expected: Không có lỗi TypeScript.

- [x] **Step 3: Chạy live thử nghiệm lấy LinkMap của Map 17**
  Run: `set -a; source avatar-web/server/.env; set +a; npx --prefix avatar-web/server tsx src/tools/maplink-probe.ts --account-id 3 --get-linkmap 17`
  Expected: Thu được danh sách các cổng của Map 17 và dest roomID của từng cổng.

---

### Task 2: Quét đối tượng khai thác (`ItemMapSpecial`) trong map con

**Files:**
- Modify: `avatar-web/server/src/tools/maplink-probe.ts`

**Interfaces:**
- Consumes: Dest roomID thu được từ Task 1, decoder `ItemMapSpecial` từ `mining-probe.ts`
- Produces: Danh mục các đối tượng `ItemMapSpecial` (ID, tên, loại, tọa độ, menu tương tác) in ra stdout.

- [x] **Step 1: Tích hợp bộ giải mã `ItemMapSpecial` cho `RX 80` của map con**
  - Đọc trường `specialCount` trong payload `RX 80`.
  - Đọc thông tin chi tiết từng đối tượng: `id`, `name`, `type`, `imageCount`, `menuIds`.

- [x] **Step 2: Chạy live join map con khai thác gỗ và map con khai thác đá**
  Run: `set -a; source avatar-web/server/.env; set +a; npx --prefix avatar-web/server tsx src/tools/maplink-probe.ts --account-id 3 --probe-submap <destRoomId>`
  Expected: Trích xuất thành công danh sách cây gỗ / mỏ đá trong map con.

---

### Task 3: Ghi nhận kết quả vào Evidence Document

**Files:**
- Modify: `docs/protocol/khu-ngoai-o-cong-map-con-evidence-2026-09-17.md`

- [x] **Step 1: Cập nhật bảng bằng chứng thực tế**
  - Ghi nhận thông số cổng chính thức (tọa độ, roomID đích).
  - Ghi nhận danh sách các đối tượng khai thác quét được (Object ID, tên, menu đào).
