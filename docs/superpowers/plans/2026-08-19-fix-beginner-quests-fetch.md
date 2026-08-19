# Sửa Lỗi Chưa Lấy Được Nhiệm Vụ Tân Thủ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khắc phục triệt để lỗi không lấy được dữ liệu Nhiệm Vụ Tân Thủ khi tương tác với game hoặc nhấn làm mới trên web avatar-web.

**Architecture:** Bổ sung việc gửi lệnh `getInfoUpgradeFarm(3, 1)` (yêu cầu Nhiệm Vụ Tân Thủ) và `getInfoUpgradeFarm(3, 0)` (yêu cầu Nhiệm Vụ Nhà Nông) trong `client.ts`; đồng thời sửa lỗi lệch 4 byte giải mã phần thưởng trong `action = 3` và nhận diện đúng `screenType = 1` trong `action = 1` của `progressQuests.ts`. Cập nhật web UI `QuestsPanel.tsx` tự động kích hoạt tải dữ liệu khi xem tab.

**Tech Stack:** TypeScript, Node.js, Express, React, Vite, AvatarHD IL2CPP Binary Protocol

**Spec:** `docs/superpowers/specs/2026-08-19-fix-beginner-quests-fetch-design.md`

## Global Constraints
- Tuân thủ cấu trúc nhị phân gói tin `Cmd 104` theo ground truth IL2CPP (`0x5fa3a4`, `0x866c04`).
- Không tạo test files do project không dùng TDD workflow.
- Giữ nguyên cấu trúc dữ liệu `ProgressQuestChain` và `ProgressQuestReward` để tương thích UI và backend.

---

### Task 1: Sửa Lỗi Giải Mã Gói Tin Tiến Trình Trong `progressQuests.ts`

**Files:**
- Modify: `avatar-web/server/src/game/progressQuests.ts:186-408`

**Interfaces:**
- Consumes: `MyReader`, `ProgressQuestReward`, `ProgressQuestCondition`, `ProgressQuestChain`
- Produces: `decodeProgressQuestPacket(data: Buffer, mappings?: readonly ProgressQuestMapping[])`

- [ ] **Step 1: Sửa decode nhánh `action === 2 || action === 3` và `action === 1` trong `progressQuests.ts`**
  1. Trong vòng lặp giải mã phần thưởng của `action = 2 | 3`, chỉ đọc `idFarm` bằng `r.readInt()` khi `type === 7` hoặc `type === 9`. Khi `type` khác (như `6` Xu, `10` EXP, `8` Lượng), gán `idFarm = 0` và đọc tiếp `request` và `inStorage`.
  2. Trong `action === 1`:
     - Nhận diện `screenType`: `screenType === 1` đặt `kind: 'beginner'`, `title: 'Nhiệm Vụ Tân Thủ'`; `screenType === 0` đặt `kind: 'farmer'`, `title: 'Nhiệm Vụ Nhà Nông'`.
     - Phân giải động các hạng mục `itemType` (Cấp nông trại, Ô đất, Bếp nấu, Chuồng trại, Ao cá, Xu, Lượng, Nông sản, Thuốc) thành các điều kiện `ProgressQuestCondition` thực tế thay vì hardcode 200 cà chua / 200 cà rốt.

- [ ] **Step 2: Kiểm tra giải mã gói tin mẫu**
  Chạy script giải mã với chuỗi hex từ người dùng:
  `0101177800010032000a00140002000a14010000001e0000000102000000300000000803000000030000000104000000140000000a050000000a0000000206000f4240000016c308000001f4000000640900001260000000010000000007000000ce000000140000000007000000cd000000140000000007000000da00000014000000000700000111000000140000000007000000d4000000140000000007000001130000001400000000070000011f00000014000000000700000119000000140000000007000001180000001400000000070000011c000000140000000007000001160000001400000000070000011d0000001400000000`
  Xác nhận trả về `kind: 'beginner'` với danh sách điều kiện tương ứng.

---

### Task 2: Cập Nhật Luồng Gửi Yêu Cầu Nhiệm Vụ Trong `client.ts`

**Files:**
- Modify: `avatar-web/server/src/game/client.ts:477-505`

**Interfaces:**
- Consumes: `FarmService.getInfoUpgradeFarm(type: number, idType?: number)`
- Produces: `GameClient.refreshProgressQuests(force?: boolean)`

- [ ] **Step 1: Cập nhật hàm `refreshProgressQuests()`**
  Gửi theo trình tự:
  1. `this.farm.getInfoUpgradeFarm(3, 1)`: Yêu cầu lấy thông tin Nhiệm Vụ Tân Thủ.
  2. `this.farm.getInfoUpgradeFarm(3, 0)`: Yêu cầu lấy thông tin Nhiệm Vụ Nhà Nông.
  3. `this.farm.communicate(-1)` & `this.farm.doMenuOption(-1, 0, 0)`: Tương tác NPC Lái buôn trong trang trại để lấy thêm dialog nhiệm vụ.
  4. `this.farm.getInfoUpgradeFarm(1)`: Yêu cầu thông tin nâng cấp nông trại cấp 2.

- [ ] **Step 2: Đảm bảo xử lý phản hồi `case 104`**
  Trong `client.ts` `onMessage` case 104:
  - Khi `res.state.kind === 'beginner'`, cập nhật `this.beginnerQuestState = res.state`.
  - Khi `res.state.kind === 'farmer'`, cập nhật `this.farmerQuestState = res.state`.
  - Phát sinh sự kiện `this.emit('quests')`.

---

### Task 3: Cải Thiện UX Tải Dữ Liệu Trên Giao Diện Web

**Files:**
- Modify: `avatar-web/web/src/accounts/panels/QuestsPanel.tsx:20-60`

**Interfaces:**
- Consumes: `apiPost('/api/accounts/${accountId}/quests/progress/refresh')`
- Produces: Hiển thị tab Tân Thủ / Nhà Nông khi người dùng chuyển đổi tab.

- [ ] **Step 1: Tự động tải tiến trình khi mở tab nếu dữ liệu đang rỗng**
  Khi người dùng chuyển sang tab `beginner` mà `beginner === null`, hoặc `farmer` mà `farmer === null`, tự động kích hoạt `handleRefreshProgress()` 1 lần để người dùng không phải bấm thủ công nút "Tải Nhiệm Vụ Tân Thủ từ game".

- [ ] **Step 2: Build và kiểm tra type check**
  Chạy type check và build trên `avatar-web/server` và `avatar-web/web`.
