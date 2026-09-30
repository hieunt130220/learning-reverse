# Minigame Trúc Xanh Map 7: Chế Độ P2 Luôn Thua (Feeder Bot) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triển khai cơ chế chơi nhường điểm có chủ đích (Feeder Bot) cho tài khoản thứ 2 (`account-id-2`) trong minigame Trúc Xanh, đảm bảo Account 1 luôn luôn thắng và Account 2 luôn luôn thua.

**Architecture:** Mở rộng `TrucXanhMemory` với phương thức `findKnownDifferentCard` để tìm thẻ có hình ảnh khác biệt. Nâng cấp `TrucXanhGameRunner` hỗ trợ 2 vai trò `winner` (Account 1 ăn điểm tối đa) và `feeder` (Account 2 mở bài thăm dò rồi cố tình chọn thẻ thứ 2 lệch hình để trượt cặp, nhường lượt cho Account 1 thu hoạch điểm).

**Tech Stack:** TypeScript, Node.js, `GameClient`, `TrucXanhMemory`, `TrucXanhGameRunner`.

**Spec:** `docs/superpowers/specs/2026-09-30-trucxanh-p2-feeder-design.md`

## Global Constraints
- Không tạo test files (tuân thủ nghiêm ngặt nguyên tắc **KHÔNG TDD** của dự án).
- Khi có 2 tài khoản tham gia (`--two-players` hoặc `--account-id-2`), Account 2 mặc định nhận vai trò `feeder` và Account 1 nhận vai trò `winner`.
- P2 tuyệt đối không được gọi `findKnownPair()` để ăn cặp bài.
- Thao tác lật thẻ duy trì delay cấu hình (`delayMs`) để máy chủ xử lý ổn định.

---

### Task 1: Bổ sung phương thức tìm thẻ khác biệt trong TrucXanhMemory

**Files:**
- Modify: `avatar-web/server/src/tools/trucxanh-probe.ts`

**Interfaces:**
- Consumes: `this.cardImages`, `this.removedCards`.
- Produces: `findKnownDifferentCard(excludeCardId: number, diffImg: number): number | null`.

- [ ] **Step 1: Viết phương thức findKnownDifferentCard trong TrucXanhMemory**

```typescript
  findKnownDifferentCard(excludeCardId: number, diffImg: number): number | null {
    for (const [cId, img] of this.cardImages.entries()) {
      if (cId !== excludeCardId && img !== diffImg && !this.isRemoved(cId)) {
        return cId;
      }
    }
    return null;
  }
```

- [ ] **Step 2: Commit Task 1**

```bash
git add avatar-web/server/src/tools/trucxanh-probe.ts
git commit -m "feat(probe): add findKnownDifferentCard to TrucXanhMemory"
```

---

### Task 2: Cài đặt thuật toán Feeder Turn cho P2 trong TrucXanhGameRunner

**Files:**
- Modify: `avatar-web/server/src/tools/trucxanh-probe.ts`

**Interfaces:**
- Consumes: `findKnownDifferentCard`, `pickUnknownCard`, `flipCard`.
- Produces: `executeFeederTurn(): Promise<void>`, thuộc tính `role: 'winner' | 'feeder'`.

- [ ] **Step 1: Thêm thuộc tính role và nhánh rẽ executeTurn**

Cập nhật constructor của `TrucXanhGameRunner`:
```typescript
  constructor(
    private readonly client: GameClient,
    private readonly delayMs: number,
    private readonly username: string = '',
    memory?: TrucXanhMemory,
    readonly tag: string = 'P1',
    readonly role: 'winner' | 'feeder' = 'winner',
  ) {
    this.memory = memory ?? new TrucXanhMemory();
  }
```

Trong `executeTurn()`:
```typescript
  private async executeTurn(): Promise<void> {
    if (this.role === 'feeder') {
      await this.executeFeederTurn();
    } else {
      await this.executeWinnerTurn();
    }
  }
```

- [ ] **Step 2: Viết hàm executeFeederTurn thực hiện mở thăm dò và cố ý trượt cặp**

```typescript
  private async executeFeederTurn(): Promise<void> {
    if (this.turnLock || !this.isPlaying || !this.isMyTurn) return;
    this.turnLock = true;
    try {
      while (this.isPlaying && this.isMyTurn) {
        this.turnCount++;
        console.log(`\n👉 --- [${this.tag} FEEDER LƯỢT #${this.turnCount}] ĐẾN LƯỢT P2 (NHƯỜNG ĐIỂM) ---`);
        await new Promise((r) => setTimeout(r, this.delayMs));
        if (!this.isPlaying || !this.isMyTurn) break;

        // 1. Thẻ 1: Mở ô chưa biết để lấy thông tin cho P1
        let card1 = this.memory.pickUnknownCard();
        if (card1 === null) {
          // Nếu toàn bộ ô đều đã biết hình, chọn ô bất kỳ chưa bị removed
          for (let i = 0; i < this.memory.totalCards; i++) {
            if (!this.memory.isRemoved(i)) {
              card1 = i;
              break;
            }
          }
        }
        if (card1 === null) break;

        console.log(`🔍 [${this.tag} FEEDER] Mở thăm dò thẻ 1: Ô #${card1}`);
        const opened1 = await this.flipCard(card1);
        await new Promise((r) => setTimeout(r, this.delayMs));
        if (!this.isPlaying) break;

        // 2. Thẻ 2: Tìm thẻ CỐ TÌNH KHÁC HÌNH để trượt điểm 100%
        let card2 = this.memory.findKnownDifferentCard(card1, opened1.img);
        if (card2 === null) {
          // Chưa có thẻ nào khác hình được biết (chỉ ở lượt đầu tiên)
          card2 = this.memory.pickUnknownCard(card1);
        }
        if (card2 === null) {
          for (let i = 0; i < this.memory.totalCards; i++) {
            if (i !== card1 && !this.memory.isRemoved(i)) {
              card2 = i;
              break;
            }
          }
        }
        if (card2 === null) break;

        console.log(`🎯 [${this.tag} FEEDER] Chọn thẻ 2 lệch hình để nhường lượt: Ô #${card2}`);
        const opened2 = await this.flipCard(card2);
        if (!opened2.isMatch) {
          console.log(`✅ [${this.tag} FEEDER] Đã cố tình trượt cặp thành công! Chuyển lượt về cho P1.`);
          break; // Trượt cặp thành công -> Chuyển lượt về cho P1
        }
        // Trường hợp ngẫu nhiên trùng ở lượt 1, tiếp tục vòng lặp nhường
      }
    } catch (err) {
      console.error(`❌ [${this.tag}] Lỗi thực thi lượt Feeder: ${(err as Error).message}`);
    } finally {
      this.turnLock = false;
    }
  }
```

- [ ] **Step 3: Commit Task 2**

```bash
git add avatar-web/server/src/tools/trucxanh-probe.ts
git commit -m "feat(probe): implement feeder turn logic to guarantee P2 loses"
```

---

### Task 3: Kết nối vai trò P2 Feeder vào hàm khởi chạy chính runTrucXanhProbe

**Files:**
- Modify: `avatar-web/server/src/tools/trucxanh-probe.ts`

**Interfaces:**
- Consumes: `args.twoPlayers`, `args.accountId2`, `TrucXanhGameRunner`.
- Produces: Gán `role: 'feeder'` cho `runner2`.

- [ ] **Step 1: Khởi tạo runner2 với role = 'feeder'**

```typescript
    const runner1 = new TrucXanhGameRunner(client1, args.delayMs, account1.gameUser, sharedMemory, 'P1', 'winner');
    let runner2: TrucXanhGameRunner | undefined;
    if (client2 && account2) {
      runner2 = new TrucXanhGameRunner(client2, args.delayMs, account2.gameUser, sharedMemory, 'P2', 'feeder');
    }
```

- [ ] **Step 2: Commit Task 3**

```bash
git add avatar-web/server/src/tools/trucxanh-probe.ts
git commit -m "feat(probe): wire feeder role to P2 runner in probe entry point"
```

---

### Task 4: Chạy kiểm chứng ván đấu 2 tài khoản trên Live Server

**Files:**
- Execute: `avatar-web/server/src/tools/trucxanh-probe.ts`

- [ ] **Step 1: Chạy lệnh probe với cờ --two-players**

```bash
npx --prefix avatar-web/server tsx --env-file=avatar-web/server/.env avatar-web/server/src/tools/trucxanh-probe.ts --two-players
```

- [ ] **Step 2: Ghi nhận nhật ký ván đấu, kiểm tra kết quả P1 thắng và P2 thua**

- [ ] **Step 3: Cập nhật tài liệu protocol và kế hoạch**

```bash
git add docs/protocol/avatar-map7-castle-minigame-protocol.md docs/superpowers/plans/2026-09-30-trucxanh-p2-feeder.md
git commit -m "docs: record P2 feeder live verification results"
```
