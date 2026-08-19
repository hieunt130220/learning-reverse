# Tự Động Làm Đất Phá Bỏ Cây Cũ Trước Khi Trồng Cây Mới Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm hành động làm đất / phá bỏ cây cũ (`doPlantSeed` với `idSeed = -1`) vào chu kỳ AutoFarm sau khi thu hoạch để ô đất sạch cây cũ và gieo trồng lại cây mới thành công.

**Architecture:** Sử dụng opcode `cmd 66` với `idSeed = -1` đã được phân tích từ binary IL2CPP để gửi lệnh làm đất cho ô vừa thu hoạch/spent, sau đó gửi `cmd 66` với `plannedSeedId` để gieo trồng hạt mới. Cập nhật `FarmService`, `AutoFarm`, và tài liệu protocol `farm.md`.

**Tech Stack:** TypeScript, Node.js, Socket Binary Message Protocol.

**Spec:** `docs/superpowers/specs/2026-08-19-fix-farm-clear-spent-tree-before-planting-design.md`

## Global Constraints
- Tuân thủ quy tắc không TDD (không tạo test files mới trừ khi được yêu cầu).
- Sử dụng `cmd 66` (`PLANT_SEED`) với `idSeed = -1` (byte `0xFF`) cho thao tác làm đất.
- Đảm bảo logic kiểm tra kho và `autoBuy` vẫn hoạt động trơn tru cùng bước làm đất.

---

### Task 1: Bổ sung phương thức `clearCell` trong `FarmService`

**Files:**
- Modify: `avatar-web/server/src/game/farmService.ts:70-75`

**Interfaces:**
- Produces: `clearCell(idFarm: number, indexCell: number): void` gửi `cmd 66` với `idSeed = -1`.

- [ ] **Step 1: Thêm hàm `clearCell` vào `FarmService`**
```typescript
  /**
   * doPlantSeed @0x5d1290 với idSeed = -1 (0xFF) — làm đất / phá bỏ cây cũ,
   * đưa ô đã thu hoạch / cây tàn về trạng thái trống sạch.
   */
  clearCell(idFarm: number, indexCell: number): void {
    this.plantSeed(idFarm, indexCell, -1);
  }
```

- [ ] **Step 2: Kiểm tra biên dịch**
Run: `npm run build` trong `avatar-web/server`
Expected: Biên dịch TypeScript thành công không có lỗi.

---

### Task 2: Cập nhật AutoFarm để thực hiện làm đất trước khi trồng cây mới

**Files:**
- Modify: `avatar-web/server/src/autoFarm.ts:770-870`

**Interfaces:**
- Consumes: `FarmService.clearCell(idFarm, cellIndex)`, `FarmService.plantSeed(idFarm, cellIndex, seedId)`
- Produces: Luồng xử lý giai đoạn cây tự động làm đất khi gặp ô `time === -1` hoặc vừa thu hoạch trước khi gieo hạt.

- [ ] **Step 1: Cập nhật logic giai đoạn cây trong `AutoFarm.runCycle`**
- Nhận diện ô cần làm đất: `c.idTree !== -1 && (isCellSpent(c) || c.time === -1)`.
- Khi cần làm đất:
  - Gửi lệnh `this.client.farm.clearCell(idFarm, c.index)`.
  - Ghi nhận `did.push('làm đất')`.
  - Chờ xác nhận `await confirm(66, "làm đất ô ${c.index}")` và nhịp `await tick()`.
  - Cập nhật trạng thái `c.idTree = -1`.
- Sau khi ô đã trống (`c.idTree === -1`), nếu có `plannedSeedId` hợp lệ và đủ hạt trong kho:
  - Gửi lệnh `this.client.farm.plantSeed(idFarm, c.index, plannedSeedId)`.
  - Ghi nhận `did.push("trồng #${plannedSeedId}")`.
  - Chờ xác nhận `await confirm(66, "trồng #${plannedSeedId} ô ${c.index}")` và nhịp `await tick()`.
  - Trừ hạt trong kho và cập nhật trạng thái `c.idTree = plannedSeedId; c.time = 0; c.hervestPer = 0;`.

- [ ] **Step 2: Chạy kiểm tra test có sẵn**
Run: `npm test` trong `avatar-web/server`
Expected: Toàn bộ test suite pass.

---

### Task 3: Cập nhật tài liệu kỹ thuật `avatar-re/notes/farm.md`

**Files:**
- Modify: `avatar-re/notes/farm.md:21-25`, `avatar-re/notes/farm.md:345-350`, `avatar-re/notes/farm.md:380-398`

**Interfaces:**
- Ghi nhận opcode `cmd 66` với `idSeed = -1` là lệnh làm đất / dọn cây cũ.

- [ ] **Step 1: Cập nhật các mục ghi chú trong `avatar-re/notes/farm.md`**
- Bổ sung ghi chú `idSeed = -1` cho `doPlantSeed` (cmd 66).
- Cập nhật mục "Cách làm ô trống trở lại" đã được giải mã chính xác qua binary `libil2cpp.so`.

- [ ] **Step 2: Kiểm tra lại toàn bộ thay đổi**
Run: `git status` và `git diff`
Expected: Code gọn gàng, tài liệu đầy đủ và chính xác.
