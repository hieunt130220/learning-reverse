# Thu hoạch → Làm đất → Trồng lại: Quy trình 3 pha Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Loại bỏ 23/24 lần JOIN dư thừa trong chu kỳ thu hoạch bằng quy trình 3 pha: Thu hoạch & Làm đất tuần tự → 1 lần Snapshot xác nhận → Trồng & Chăm sóc.

**Architecture:** Tách vòng lặp cây (`for (const initialCell of farm.cells)`) hiện có thành 3 pha tuần tự. Pha 1 thu hoạch và gửi clearCell ngay (không chờ ACK). Pha 2 JOIN farm đúng 1 lần. Pha 3 trồng hạt theo danh sách ô snapshot xác nhận trống. Giữ nguyên `waitFarmEvent`, `refreshFarmSnapshot`, `plantCommand` đã có; chỉ xoá lời gọi `plantCommand(-1)` đang gây 24 lần timeout.

**Tech Stack:** TypeScript, Node.js EventEmitter, Buffer, tsx, GitNexus.

**Spec:** `docs/superpowers/specs/2026-09-15-harvest-clear-confirmation-amendment-design.md` — user duyệt ngày 2026-09-16.

## Global Constraints

- Branch: `codex/harvest-replant-ack`. Commits trước đã có `waitFarmEvent`, `refreshFarmSnapshot`, `plantCommand`, decoders ACK Cmd 64/66, và sự kiện `farm-snapshot` / `farm-harvest-reply` / `farm-plant-reply`.
- Không TDD, không tạo test file. Chạy test sẵn có sau sửa production code.
- Giữ nguyên wire TX (`harvest`, `clearCell`, `plantSeed`), kế hoạch cây (`planByCell`), auto-buy, ngân sách, `stepDelayMs`, vật nuôi/bếp và API UI.
- Không tăng timeout hoặc bỏ kiểm tra xác nhận để che vấn đề.
- Không sửa `farmData.ts` hoặc `client.ts` — decoders và event emitters không đổi.
- Chạy impact trước mỗi symbol thay đổi; `detect_changes` trước commit.
- Giữ unrelated dirty work: AGENTS.md, CLAUDE.md. Không commit/push files ngoài phạm vi.

---

### Task 1: Tách vòng lặp cây thành 3 pha trong `autoFarm.ts`

**Files:**
- Modify: `avatar-web/server/src/autoFarm.ts` — vùng `GIAI ĐOẠN CÂY` (dòng ~1049–1170 trên branch)

**Interfaces:**
- Consumes: `waitFarmEvent<HarvestReply>`, `waitFarmEvent<PlantReply>`, `refreshFarmSnapshot`, `plantCommand` (sẽ extract thành standalone), `cellRipe`, `isCellSpent`, `planByCell`, `seedId`, `knownSeeds`, `seedInventory`, `farm.cells`, `idFarm`, `generation`.
- Produces: Luồng xử lý mới 3 pha; chuẩn hóa log; giảm JOIN từ N xuống 1.

- [ ] **Step 1: Impact analysis `runCycle` và vùng GIAI ĐOẠN CÂY.**

Run:
```bash
# Trên branch codex/harvest-replant-ack
gitnexus_impact({target: "runCycle", direction: "upstream", repo: "learning-reverse"})
```
Báo blast radius, callers. Nếu HIGH/CRITICAL, báo trước khi sửa.

- [ ] **Step 2: Tái cấu trúc vùng `GIAI ĐOẠN CÂY` thành 3 pha.**

Thay thế vòng `for (const initialCell of farm.cells)` hiện có bằng cấu trúc:

```ts
// --- GIAI ĐOẠN CÂY — PHA 1: Thu hoạch & Làm đất tuần tự --------
// Thu hoạch chờ ACK Cmd 64. Nhận ACK -> gửi clearCell ngay, không
// chờ ACK seed=-1 (server không gửi — đã chứng minh bằng disasm
// FarmScr$$onPlantSeed RVA 0x63AB28 và FarmScr$$onHarvestTree
// RVA 0x63B08C, và 24/24 ô trong log live).
interface PendingClearCell {
  index: number;
  previousTreeId: number;
}
const pendingClearCells: PendingClearCell[] = [];

for (const initialCell of farm.cells) {
  guard();
  if (this.client.status !== 'online' || this.client.farmState?.idFarm !== idFarm) {
    throw new Error('farm hoặc kết nối đã thay đổi — dừng vòng');
  }
  const currentCell = this.client.farmState.cells.find(
    cell => cell.index === initialCell.index,
  );
  if (!currentCell) continue;
  const c = currentCell;

  if (!harvest || !cellRipe(c)) continue;

  const result = await this.waitFarmEvent<HarvestReply>(
    'farm-harvest-reply',
    value => value.cellIndex === c.index
      && this.client.farmState?.idFarm === idFarm,
    () => { this.client.farm.harvest(idFarm, c.index); sent += 1; },
    generation, this.commandTimeoutMs,
  );
  guard();
  if (result.status === 'cancelled') throw new AutoFarmStoppedError();
  await tick();

  if (result.status === 'confirmed') {
    did.push(`[cây] ô ${c.index}: thu hoạch xác nhận qua ACK (+${result.value.quantity})`);
    note(`[cây] ô ${c.index}: thu hoạch xác nhận qua ACK (+${result.value.quantity})`);
    // Gửi clearCell ngay — server xử lý đồng bộ, không trả ACK
    if (c.idTree !== -1) {
      if (this.client.farm.clearCell) {
        this.client.farm.clearCell(idFarm, c.index);
      } else {
        this.client.farm.plantSeed(idFarm, c.index, -1);
      }
      sent += 1;
      note(`[cây] ô ${c.index}: đã gửi làm đất (chờ xác nhận snapshot)`);
      pendingClearCells.push({ index: c.index, previousTreeId: c.idTree });
    } else {
      // Ô đã trống sẵn (spent/time=-1), chỉ cần trồng lại
      pendingClearCells.push({ index: c.index, previousTreeId: c.idTree });
    }
    await tick();
  } else {
    // Harvest timeout — không gửi clearCell, tránh phá cây chưa chứng minh đã thu
    note(`[cây] ô ${c.index}: thu hoạch chưa xác nhận — bỏ qua ô này`);
  }
}

// --- GIAI ĐOẠN CÂY — PHA 2: Snapshot Verification Gate -----------
// Một lần JOIN duy nhất xác nhận tất cả ô đã làm đất thực sự trống.
// Bổ sung cả các ô trống sẵn có (idTree === -1 hoặc spent) từ đầu vòng.
const readyToPlant: Array<{ index: number; previousTreeId: number }> = [];

// Thu thập ô trống sẵn có (không cần thu hoạch, không cần clearCell)
for (const c of farm.cells) {
  if (c.idTree === -1 || isCellSpent(c) || c.time === -1) {
    // Chỉ thêm nếu chưa nằm trong pendingClearCells
    if (!pendingClearCells.some(p => p.index === c.index)) {
      readyToPlant.push({ index: c.index, previousTreeId: c.idTree });
    }
  }
}

if (pendingClearCells.length > 0) {
  guard();
  const snapshot = await this.refreshFarmSnapshot(idFarm, generation);
  let confirmed = 0;
  let failed = 0;
  for (const pending of pendingClearCells) {
    const freshCell = snapshot.cells.find(sc => sc.index === pending.index);
    if (freshCell && freshCell.idTree === -1) {
      readyToPlant.push(pending);
      confirmed += 1;
    } else {
      note(`[cây] ô ${pending.index}: snapshot cho thấy chưa trống (idTree=${freshCell?.idTree ?? '?'}) — bỏ trồng`);
      failed += 1;
    }
  }
  note(`[nông trại] snapshot xác nhận ${confirmed} ô đất trống sẵn sàng trồng` +
    (failed > 0 ? ` (${failed} ô chưa sạch)` : ''));
}

// --- GIAI ĐOẠN CÂY — PHA 3: Gieo hạt & Chăm sóc -----------------
for (const entry of readyToPlant) {
  guard();
  if (this.client.status !== 'online' || this.client.farmState?.idFarm !== idFarm) {
    throw new Error('farm hoặc kết nối đã thay đổi — dừng vòng');
  }
  const plan = planByCell.get(entry.index);
  const plannedSeedId = plan?.action === 'seed'
    ? plan.seedId
    : (seedId ?? (entry.previousTreeId !== -1 && knownSeeds.has(entry.previousTreeId)
        ? entry.previousTreeId
        : undefined));

  if (plan?.action === 'skip') {
    did.push(`[cây] ô ${entry.index}: bỏ qua theo kế hoạch`);
    continue;
  }
  if (plannedSeedId === undefined) continue;
  if (!knownSeeds.has(plannedSeedId)) {
    did.push(`[cây] ô ${entry.index}: bỏ qua hạt #${plannedSeedId} — không có trong catalog cây`);
    continue;
  }
  if ((seedInventory.get(plannedSeedId) ?? 0) <= 0) {
    did.push(`[cây] ô ${entry.index}: bỏ qua — thiếu hạt #${plannedSeedId} trong kho`);
    continue;
  }

  const plantResult = await this.waitFarmEvent<PlantReply>(
    'farm-plant-reply',
    value => value.idUser === idFarm
      && value.cellIndex === entry.index
      && value.seedId === plannedSeedId
      && this.client.farmState?.idFarm === idFarm,
    () => {
      if (this.client.farmState?.idFarm !== idFarm) {
        throw new Error('farm đã thay đổi — dừng vòng');
      }
      this.client.farm.plantSeed(idFarm, entry.index, plannedSeedId);
      sent += 1;
    },
    generation, this.commandTimeoutMs,
  );
  guard();
  if (plantResult.status === 'cancelled') throw new AutoFarmStoppedError();
  await tick();

  if (plantResult.status === 'confirmed') {
    seedInventory.set(plannedSeedId, (seedInventory.get(plannedSeedId) ?? 0) - 1);
    did.push(`[cây] ô ${entry.index}: trồng #${plannedSeedId} xác nhận qua ACK`);
    note(`[cây] ô ${entry.index}: trồng #${plannedSeedId} xác nhận qua ACK`);
  } else {
    // Trồng timeout — không gửi lại, đồng bộ kho cuối vòng sẽ chỉnh
    note(`[cây] ô ${entry.index}: trồng #${plannedSeedId} chưa xác nhận — bỏ qua`);
    did.push(`[cây] ô ${entry.index}: trồng #${plannedSeedId} chưa xác nhận`);
  }
}

// --- Chăm sóc (tưới/nhổ cỏ/bắt sâu/bón phân) ---
// Duyệt toàn bộ ô với dữ liệu mới nhất (snapshot Pha 2 đã cập nhật farmState),
// chỉ chăm sóc ô KHÔNG nằm trong readyToPlant (ô vừa trồng mới không cần chăm).
const plantedIndices = new Set(readyToPlant.map(e => e.index));
for (const initialCell of farm.cells) {
  guard();
  if (plantedIndices.has(initialCell.index)) continue;
  const currentCell = this.client.farmState?.cells.find(
    cell => cell.index === initialCell.index,
  );
  if (!currentCell || currentCell.idTree === -1 || isCellSpent(currentCell)) continue;
  const c = currentCell;
  // Chăm sóc: tưới, nhổ cỏ, bắt sâu, bón phân (giữ nguyên logic hiện có)
  if (c.isArid && waterItemId !== undefined) {
    this.client.farm.useItem(idFarm, c.index, waterItemId);
    sent += 1;
    did.push(`[cây] ô ${c.index}: tưới #${waterItemId}`);
    await confirm(65, `tưới #${waterItemId} ô ${c.index}`);
    await tick();
  }
  if (c.isGrass && grassItemId !== undefined) {
    this.client.farm.useItem(idFarm, c.index, grassItemId);
    sent += 1;
    did.push(`[cây] ô ${c.index}: nhổ cỏ #${grassItemId}`);
    await confirm(65, `nhổ cỏ #${grassItemId} ô ${c.index}`);
    await tick();
  }
  if (c.isWorm && wormItemId !== undefined) {
    this.client.farm.useItem(idFarm, c.index, wormItemId);
    sent += 1;
    did.push(`[cây] ô ${c.index}: bắt sâu #${wormItemId}`);
    await confirm(65, `bắt sâu #${wormItemId} ô ${c.index}`);
    await tick();
  }
  if (cfg.fertilizeCells && c.vitalityPer < cfg.minVitality && c.idTree !== -1) {
    this.client.farm.useItem(idFarm, c.index, ITEM_FERTILIZER);
    sent += 1;
    did.push(`[cây] ô ${c.index}: bón phân`);
    await confirm(65, `bón phân ô ${c.index}`);
    await tick();
  }
}
```

Chú ý khi implement:
1. Biến `did` tổng hợp; không dùng pattern `seen`/`did` cũ vì bây giờ mỗi pha có log riêng.
2. `tick()`, `guard()`, `confirm()`, `note()` giữ nguyên định nghĩa hiện có.
3. `cellRipe` helper đã có trong file.
4. Vòng chăm sóc bón phân cần kiểm tra `cfg.fertilizeCells` tồn tại.

- [ ] **Step 3: Xoá code cũ — khối `for (const initialCell of farm.cells)` hiện tại.**

Vùng code từ dòng ~1049 đến ~1170 trên branch (bao gồm `refreshCell`, `plantCommand` inline, `plantCommand(-1)` gây timeout, log `làm đất xác nhận` không chính xác) được thay thế hoàn toàn bằng 3 pha ở Step 2.

- [ ] **Step 4: Kiểm tra typecheck.**

Run:
```bash
cd avatar-web/server && npm run typecheck
```
Expected: Không có lỗi TypeScript.

- [ ] **Step 5: Chạy test sẵn có.**

Run:
```bash
cd avatar-web/server && node --import tsx --test src/game/farmData.test.ts src/game/client.test.ts
```
Expected: Tất cả test pass. Báo số pass/fail thực tế.

- [ ] **Step 6: `detect_changes` và commit.**

Run: `gitnexus_detect_changes({scope: "staged"})`.
Stage đúng `autoFarm.ts`. Xác nhận chỉ có file trong phạm vi.
Commit:
```bash
git commit -m "fix: eliminate 23 spurious farm JOINs by splitting harvest-clear-plant into 3 phases

Phase 1: harvest with per-cell ACK (Cmd 64), send clearCell immediately
          (no waiter — server never sends Cmd 66 seed=-1, proven by
          disasm RVA 0x63B08C/0x63AB28 and 24/24 live timeouts)
Phase 2: single snapshot JOIN verifies all cleared cells are empty
Phase 3: replant confirmed-empty cells with per-cell ACK (Cmd 66)

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: Cập nhật tài liệu kỹ thuật `avatar-re/notes/farm.md`

**Files:**
- Modify: `avatar-re/notes/farm.md` — thêm section mới về phát hiện clearCell

- [ ] **Step 1: Thêm phần ghi chú về clearCell không có ACK.**

Bổ sung vào cuối file `avatar-re/notes/farm.md`:

```markdown
## clearCell (doPlantSeed seed=-1) — không có ACK

### Phát hiện (2026-09-16)

Server xử lý `doPlantSeed(idFarm, indexCell, -1)` (Cmd 66 TX) như thao tác cập
nhật database nội bộ, **không gửi bất kỳ packet phản hồi nào** (không Cmd 66 RX
với seed=-1, không Cmd 100 INFO_CELL).

### Bằng chứng

1. **Client disassembly** (`FarmScr$$onHarvestTree` RVA `0x63B08C`):
   - Tại `0x63b2e4`: Gán local `cell.idTree = -1`, `hervestPer = 100`.
   - Tại `0x63b340`: Gọi ngay `FarmService$$doPlantSeed(idFarm, indexCell, -1)`.
   - Tại `0x63b364`: Nhảy thẳng sang `FarmScr$$setInfoCell` — không đăng ký
     handler chờ phản hồi.

2. **Client disassembly** (`FarmScr$$onPlantSeed` RVA `0x63AB28`):
   - Tại `0x63ac5c`: Gọi `Item$$getItemByList(idSeed)`. Với `idSeed = -1` (0xFF),
     hàm trả NULL → nhảy tới `0x63b010` gọi `Out$$logError` và return.
   - Client gốc không hỗ trợ nhận Cmd 66 mang seed = -1.

3. **Log thực nghiệm** (24/24 ô, tài khoản 1005161, 2026-09-15):
   - Sau mỗi Cmd 64 (harvest ACK), không có Cmd 66 seed=-1 hay Cmd 100.
   - Waiter chờ 2.500 ms đều timeout.
   - Snapshot JOIN ngay sau timeout xác nhận ô đã trống (47/48 ô có cây).

### Kết luận

AutoFarm không nên tạo waiter chờ ACK cho lệnh clearCell. Xác nhận trạng thái
đất trống phải dựa vào snapshot farm (Cmd 69 JOIN).
```

- [ ] **Step 2: Commit.**

```bash
git add avatar-re/notes/farm.md
git commit -m "docs: document clearCell has no server ACK (disasm + live evidence)

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: Cập nhật tham chiếu trong Spec gốc

**Files:**
- Modify: `docs/superpowers/specs/2026-09-15-harvest-replant-ack-design.md`

- [ ] **Step 1: Thêm ghi chú tham chiếu tại cuối file.**

Thêm vào cuối file:

```markdown

## Amendments

- `2026-09-15-harvest-clear-confirmation-amendment-design.md`: Phát hiện clearCell
  không có ACK từ server. Tách luồng thành 3 pha để loại bỏ 23/24 lần JOIN thừa.
  User duyệt 2026-09-16.
```

- [ ] **Step 2: Commit.**

```bash
git add docs/superpowers/specs/2026-09-15-harvest-replant-ack-design.md
git commit -m "docs: reference clearCell amendment in harvest-replant-ack spec

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```
