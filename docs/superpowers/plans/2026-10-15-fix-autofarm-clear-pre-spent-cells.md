# Fix AutoFarm Clear Pre-spent Cells Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khắc phục lỗi AutoFarm không trồng được cây trên các ô đất đã thu hoạch từ trước (`time = -1`, `idTree !== -1`) do chưa được gửi lệnh làm đất (`clearCell`) dọn gốc cây cũ.

**Architecture:** Mở rộng Pha 1 trong vòng lặp AutoFarm để quét thêm các ô pre-spent (`idTree !== -1 && (isCellSpent || time === -1)`), gửi lệnh `clearCell` và đẩy vào `pendingClearCells`. Đồng thời siết chặt Pha 2 chỉ cho phép các ô thực sự trống (`idTree === -1`) được đưa trực tiếp vào `readyToPlant`, buộc mọi ô có gốc cây cũ phải qua snapshot xác nhận đã sạch trước khi gieo hạt ở Pha 3.

**Tech Stack:** TypeScript, Node.js Test Runner, GitNexus.

**Spec:** `docs/superpowers/specs/2026-10-15-fix-autofarm-clear-pre-spent-cells-design.md`

## Global Constraints
- Tuân thủ quy tắc GitNexus: chạy `impact` trước khi sửa file và `detect_changes` trước khi commit.
- Không sửa cấu trúc hay opcode các gói tin trên wire (`cmd 64, 65, 66`).
- Đảm bảo toàn bộ 275+ tests hiện tại trong `avatar-web/server` tiếp tục pass.
- Quy tắc Không TDD: Thực hiện sửa production code trước, sau đó bổ sung test case để verify hồi quy.

---

### Task 1: Xử lý Làm Đất Cho Ô Pre-spent và Siết Chặt Pha 2

**Files:**
- Modify: `avatar-web/server/src/autoFarm.ts:1094-1108`

**Interfaces:**
- Consumes: `this.client.farm.clearCell(idFarm, cellIndex)`, `isCellSpent(cell)`, `pendingClearCells`
- Produces: `pendingClearCells` chứa cả ô vừa thu hoạch lẫn ô pre-spent; `readyToPlant` chỉ chứa ô thực sự trống (`idTree === -1`)

- [x] **Step 1: Thêm vòng lặp làm đất cho ô pre-spent ở cuối Pha 1**
  Ngay sau vòng lặp thu hoạch ô chín trong Pha 1 của `autoFarm.ts`, thêm đoạn quét các ô pre-spent:
  ```typescript
  // Dọn các ô đã spent từ trước (thu hoạch thủ công hoặc từ vòng trước bị ngắt)
  for (const initialCell of farm.cells) {
    guard();
    if (this.client.status !== 'online' || this.client.farmState?.idFarm !== idFarm) {
      throw new Error('farm hoặc kết nối đã thay đổi — dừng vòng');
    }
    const currentCell = this.client.farmState.cells.find(cell => cell.index === initialCell.index);
    if (!currentCell) continue;
    const c = currentCell;
    if (c.idTree !== -1 && (isCellSpent(c) || c.time === -1) && !pendingClearCells.some(p => p.index === c.index)) {
      if (this.client.farm.clearCell) this.client.farm.clearCell(idFarm, c.index);
      else this.client.farm.plantSeed(idFarm, c.index, -1);
      sent += 1;
      const treeName = c.idTree !== -1 ? nameOf(c.idTree) : '';
      note(`[cây] ô ${c.index}: làm đất dọn cây cũ${treeName ? ` (${treeName})` : ''}`);
      pendingClearCells.push({ index: c.index, previousTreeId: c.idTree });
      await tick();
    }
  }
  ```

- [x] **Step 2: Siết chặt điều kiện `readyToPlant` trong Pha 2**
  Sửa điều kiện tại Pha 2 của `autoFarm.ts`:
  ```typescript
  // --- Pha 2: Snapshot Verification Gate ----------------------------------
  // Thu thập ô vốn đã trống sẵn có (thực sự không còn cây, không qua thu hoạch/làm đất vòng này)
  const readyToPlant: PendingClearCell[] = [];
  for (const c of farm.cells) {
    if (c.idTree === -1) {
      if (!pendingClearCells.some(p => p.index === c.index)) {
        readyToPlant.push({ index: c.index, previousTreeId: -1 });
      }
    }
  }
  ```

- [x] **Step 3: Kiểm tra biên dịch**
  Run: `npm run build` trong `avatar-web/server`
  Expected: Biên dịch TypeScript thành công, không có lỗi typecheck.

---

### Task 2: Viết Unit Test Xác Minh Ô Pre-spent Được Làm Đất Trước Khi Trồng

**Files:**
- Modify: `avatar-web/server/src/autoFarm.test.ts`

**Interfaces:**
- Consumes: `FakeClient`, `runOneCycle`, `cell`
- Produces: Test case mới đảm bảo ô `idTree !== -1 && time === -1` luôn được gọi `clearCell` trước `plantSeed`

- [x] **Step 1: Thêm unit test mới trong `autoFarm.test.ts`**
  ```typescript
  test('ô pre-spent (time=-1, idTree!= -1) phải được làm đất dọn cây cũ trước khi trồng mới', async () => {
    const client = new FakeClient({
      idFarm: 1,
      cells: [cell(7, { idTree: 2, time: -1 }), cell(10, { idTree: 2, time: -1 })],
      animals: [],
      updatedAt: 0,
    });
    client.trees = [tree(2, { name: 'Khóm' })];
    client.inventory = [{ id: 2, num: 10 }];

    const auto = await runOneCycle(client, { seedId: 2, harvest: true });

    // Phải gọi clearCell trước khi trồng
    assert.ok(client.calls.includes('clearCell:7'), 'phải làm đất ô 7');
    assert.ok(client.calls.includes('clearCell:10'), 'phải làm đất ô 10');
    assert.ok(client.calls.includes('plantSeed:7:2'), 'phải trồng lại hạt #2 vào ô 7');
    assert.ok(client.calls.includes('plantSeed:10:2'), 'phải trồng lại hạt #2 vào ô 10');

    // Thứ tự lệnh: clearCell phải đứng trước plantSeed
    const clear7Idx = client.calls.indexOf('clearCell:7');
    const plant7Idx = client.calls.indexOf('plantSeed:7:2');
    assert.ok(clear7Idx < plant7Idx, 'làm đất ô 7 phải trước khi trồng');

    const actions = auto.state().lastActions;
    assert.ok(actions.some(l => l.includes('ô 7') && l.includes('làm đất dọn cây cũ')));
    assert.ok(actions.some(l => l.includes('ô 10') && l.includes('làm đất dọn cây cũ')));
  });
  ```

- [x] **Step 2: Chạy test suite**
  Run: `npm test` trong `avatar-web/server`
  Expected: Toàn bộ 276 tests pass 100%.

---

### Task 3: Phân Tích Đồ Thị Thay Đổi và Hoàn Tất Commit

**Files:**
- Analysis: `avatar-web/server/src/autoFarm.ts`, `avatar-web/server/src/autoFarm.test.ts`

- [x] **Step 1: Chạy `detect_changes` của GitNexus**
  Run: `detect_changes({scope: "all"})`
  Expected: Xác nhận không có rủi ro hoặc tác dụng phụ ngoài dự kiến.

- [x] **Step 2: Tạo git commit**
  Run: `git commit -m "fix(farm): clear pre-spent cells before replanting in autofarm"`
