# Dọn bớt log ACK và tinh gọn nhật ký cây trồng AutoFarm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dọn sạch các log thô cmd 64/66 và tinh gọn nhật ký cây trồng theo Phương án B (2 dòng súc tích/ô: thu hoạch + làm đất ở Pha 1, trồng hạt ở Pha 3).

**Architecture:** Gỡ bỏ dòng emit log hex debug cho Cmd 64 và Cmd 66 trong `GameClient.onMessage`. Rút gọn log trong `autoFarm.ts` để mỗi ô thu hoạch hiển thị 1 dòng `[cây] ô X: thu hoạch (+Y), làm đất` và khi gieo hạt hiển thị `[cây] ô X: trồng #Z`.

**Tech Stack:** TypeScript, Node.js EventEmitter.

**Spec:** `docs/superpowers/specs/2026-09-16-clean-autofarm-tree-ack-logs-design.md` — user chọn Phương án B ngày 2026-09-16.

## Global Constraints

- Không TDD, không tạo test file. Chạy test sẵn có sau khi sửa code.
- Giữ nguyên toàn bộ logic xử lý nghiệp vụ, không thay đổi timing, không đổi wire protocol.
- Giữ nguyên việc decode và emit typed events `farm-harvest-reply` và `farm-plant-reply`.
- Chạy impact trước khi sửa, `detect_changes` trước khi commit.

---

### Task 1: Gỡ bỏ log debug hex cmd 64/66 trong `client.ts`

**Files:**
- Modify: `avatar-web/server/src/game/client.ts:1596-1607`

**Interfaces:**
- Consumes: `msg.getData()`, `decodeHarvestReply`, `decodePlantReply`.
- Produces: Vẫn emit `farm-harvest-reply` và `farm-plant-reply`, loại bỏ emit `log` thô.

- [ ] **Step 1: Impact analysis GameClient.onMessage.**

Run:
```bash
gitnexus_impact({target: "onMessage", direction: "upstream", repo: "learning-reverse"})
```

- [ ] **Step 2: Sửa `client.ts`.**

Gỡ bỏ `this.emit('log', ...)` trong case 64 và case 66:
```ts
      case 64: {
        const reply = decodeHarvestReply(msg.getData());
        if (reply) this.emit('farm-harvest-reply', reply);
        break;
      }
      case 66: {
        const reply = decodePlantReply(msg.getData());
        if (reply) this.emit('farm-plant-reply', reply);
        break;
      }
```

- [ ] **Step 3: Verify & Commit Task 1.**

Run:
```bash
cd avatar-web/server && npm run typecheck && node --import tsx --test src/game/farmData.test.ts src/game/client.test.ts
```
Expected: Typecheck sạch, 32/32 tests pass.
Commit: `git commit -m "chore(game): remove raw hex debug logs for cmd 64 and cmd 66"`

---

### Task 2: Tinh gọn log cây trồng trong `autoFarm.ts`

**Files:**
- Modify: `avatar-web/server/src/autoFarm.ts:1084-1094` (Pha 1) và `:1158-1163` (Pha 3)

**Interfaces:**
- Consumes: `HarvestReply`, `PlantReply`, `note()`.
- Produces: Log súc tích theo Phương án B.

- [ ] **Step 1: Sửa log Pha 1 (Thu hoạch & Làm đất).**

Thay thế 2 dòng log riêng rẽ bằng 1 dòng gộp:
```ts
          if (result.status === 'confirmed') {
            // Gửi clearCell ngay — server xử lý nội bộ, không trả ACK
            if (this.client.farm.clearCell) this.client.farm.clearCell(idFarm, c.index);
            else this.client.farm.plantSeed(idFarm, c.index, -1);
            sent += 1;
            note(`[cây] ô ${c.index}: thu hoạch (+${result.value.quantity}), làm đất`);
            pendingClearCells.push({ index: c.index, previousTreeId: c.idTree });
            await tick();
          }
```

- [ ] **Step 2: Sửa log Pha 3 (Gieo hạt).**

Rút gọn thông điệp trồng hạt thành công:
```ts
        if (plantResult.status === 'confirmed') {
          seedInventory.set(plannedSeedId, (seedInventory.get(plannedSeedId) ?? 0) - 1);
          note(`[cây] ô ${entry.index}: trồng #${plannedSeedId}`);
          plantedIndices.add(entry.index);
        }
```

- [ ] **Step 3: Verify & Commit Task 2.**

Run:
```bash
cd avatar-web/server && npm run typecheck && node --import tsx --test src/game/farmData.test.ts src/game/client.test.ts
```
Expected: Typecheck sạch, 32/32 tests pass.
Run: `gitnexus_detect_changes({scope: "staged"})`.
Commit: `git commit -m "chore(farm): concise per-cell harvest and replant logs"`
